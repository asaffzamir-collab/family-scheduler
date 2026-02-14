import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { supabaseAdmin } from "./db";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    async signIn({ account, profile }) {
      if (!account || !profile?.email) return false;

      // Upsert user in Supabase
      const { data: existingUser } = await supabaseAdmin
        .from("users")
        .select("id, family_id")
        .eq("email", profile.email)
        .limit(1)
        .single();

      if (existingUser) {
        // Update tokens
        await supabaseAdmin
          .from("users")
          .update({
            google_access_token: account.access_token,
            google_refresh_token:
              account.refresh_token || existingUser.family_id ? undefined : account.refresh_token,
            name: profile.name || "",
          })
          .eq("id", existingUser.id);
      } else {
        // Create family + user + family_member
        const { data: family } = await supabaseAdmin
          .from("families")
          .insert({ name: "Our Family" })
          .select("id")
          .single();

        const { data: newUser } = await supabaseAdmin
          .from("users")
          .insert({
            email: profile.email,
            name: profile.name || "",
            family_id: family?.id,
            google_access_token: account.access_token,
            google_refresh_token: account.refresh_token,
          })
          .select("id")
          .single();

        if (newUser && family) {
          // Create default family member for this adult
          await supabaseAdmin.from("family_members").insert({
            family_id: family.id,
            user_id: newUser.id,
            role: "adult",
            display_name: profile.name || profile.email,
          });

          // Create default reminder rules
          const defaultRules = [
            {
              family_id: family.id,
              category: "test",
              offsets: [
                { value: 7, unit: "days", label: "7 days before" },
                { value: 2, unit: "days", label: "2 days before" },
                { value: 0, unit: "days", label: "morning-of" },
              ],
            },
            {
              family_id: family.id,
              category: "class",
              offsets: [
                { value: 2, unit: "hours", label: "2 hours before" },
                { value: 15, unit: "minutes", label: "15 minutes before" },
              ],
            },
            {
              family_id: family.id,
              category: "personal",
              offsets: [
                { value: 1, unit: "days", label: "1 day before" },
                { value: 1, unit: "hours", label: "1 hour before" },
              ],
            },
          ];
          await supabaseAdmin.from("reminder_rules").insert(defaultRules);
        }
      }

      return true;
    },

    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
      }
      // Fetch user id and family_id from DB
      if (token.email) {
        const { data: user } = await supabaseAdmin
          .from("users")
          .select("id, family_id, google_access_token, google_refresh_token")
          .eq("email", token.email)
          .limit(1)
          .single();
        if (user) {
          token.userId = user.id;
          token.familyId = user.family_id;
          token.accessToken = user.google_access_token;
          token.refreshToken = user.google_refresh_token;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as Record<string, unknown>).id = token.userId;
        (session.user as Record<string, unknown>).familyId = token.familyId;
        (session.user as Record<string, unknown>).accessToken = token.accessToken;
        (session.user as Record<string, unknown>).refreshToken = token.refreshToken;
      }
      return session;
    },
  },

  pages: {
    signIn: "/signin",
    error: "/signin",
  },
};

// ─── TypeScript augmentation for session ─────
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      familyId: string | null;
      accessToken: string;
      refreshToken: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    familyId?: string | null;
    accessToken?: string;
    refreshToken?: string;
  }
}
