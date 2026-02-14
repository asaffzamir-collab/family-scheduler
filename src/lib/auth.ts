import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { supabaseAdmin } from "./db";

// Ensure NEXTAUTH_URL and AUTH_TRUST_HOST are set on Vercel before any auth logic runs
if (typeof process !== "undefined" && process.env.VERCEL === "1") {
  if (!process.env.NEXTAUTH_URL && process.env.VERCEL_URL) {
    process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
  }
  process.env.AUTH_TRUST_HOST = "true";
}

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
      if (!account || !profile?.email) {
        console.error("[SignIn] Missing account or profile email");
        return false;
      }

      try {
        // Upsert user in Supabase
        const { data: existingUser, error: fetchError } = await supabaseAdmin
          .from("users")
          .select("id, family_id")
          .eq("email", profile.email)
          .limit(1)
          .single();

        if (fetchError && fetchError.code !== "PGRST116") {
          // PGRST116 = no rows returned (new user)
          console.error("[SignIn] Database query error:", fetchError);
          return false;
        }

        if (existingUser) {
          // Update tokens - only update refresh_token if we have a new one
          const updateData: {
            google_access_token?: string;
            google_refresh_token?: string;
            name: string;
          } = {
            google_access_token: account.access_token,
            name: profile.name || "",
          };

          // Only update refresh_token if we received a new one from Google
          if (account.refresh_token) {
            updateData.google_refresh_token = account.refresh_token;
          }

          const { error: updateError } = await supabaseAdmin
            .from("users")
            .update(updateData)
            .eq("id", existingUser.id);

          if (updateError) {
            console.error("[SignIn] Failed to update user:", updateError);
            return false;
          }
        } else {
          // Create family + user + family_member
          const { data: family, error: familyError } = await supabaseAdmin
            .from("families")
            .insert({ name: "Our Family" })
            .select("id")
            .single();

          if (familyError || !family) {
            console.error("[SignIn] Failed to create family:", familyError);
            return false;
          }

          const { data: newUser, error: userError } = await supabaseAdmin
            .from("users")
            .insert({
              email: profile.email,
              name: profile.name || "",
              family_id: family.id,
              google_access_token: account.access_token,
              google_refresh_token: account.refresh_token,
            })
            .select("id")
            .single();

          if (userError || !newUser) {
            console.error("[SignIn] Failed to create user:", userError);
            return false;
          }

          // Create default family member for this adult
          const { error: memberError } = await supabaseAdmin
            .from("family_members")
            .insert({
              family_id: family.id,
              user_id: newUser.id,
              role: "adult",
              display_name: profile.name || profile.email,
            });

          if (memberError) {
            console.error("[SignIn] Failed to create family member:", memberError);
            // Don't fail sign-in for this, just log it
          }

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

          const { error: rulesError } = await supabaseAdmin
            .from("reminder_rules")
            .insert(defaultRules);

          if (rulesError) {
            console.error("[SignIn] Failed to create reminder rules:", rulesError);
            // Don't fail sign-in for this, just log it
          }
        }

        return true;
      } catch (error) {
        console.error("[SignIn] Unexpected error during sign-in:", error);
        return false;
      }
    },

    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
      }
      // Fetch user id and family_id from DB
      if (token.email) {
        try {
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
        } catch (e) {
          console.error("[JWT callback] Supabase query failed:", e);
          // Don't throw — keep whatever data is already in the token
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
