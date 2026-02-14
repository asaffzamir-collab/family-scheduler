import { cookies } from "next/headers";
import { getServerSession, type Session } from "next-auth";
import { decode } from "next-auth/jwt";
import { authOptions } from "./auth";
import { supabaseAdmin } from "./db";

/**
 * Get the current user session (server-side).
 *
 * Primary: getServerSession (standard NextAuth v4).
 * Fallback: decode the JWT directly from the session cookie. This ensures
 * compatibility with Next.js 15+ / 16 where async cookies() can cause
 * getServerSession to silently return null.
 */
export async function getSession(): Promise<Session | null> {
  /* ── 1. Try getServerSession ────────────────────────────────────────── */
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.id) return session;
  } catch {
    // getServerSession may fail on Next.js 15+; fall through to manual decode
  }

  /* ── 2. Fallback: decode JWT from cookie ────────────────────────────── */
  try {
    const cookieStore = await cookies();
    const tokenValue = cookieStore.get("next-auth.session-token")?.value;
    if (!tokenValue) return null;

    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error("[Session] NEXTAUTH_SECRET is not set");
      return null;
    }

    const token = await decode({ token: tokenValue, secret });
    if (!token?.email) return null;

    // userId & familyId are baked into the JWT by the jwt callback at sign-in
    let userId = token.userId as string | undefined;
    let familyId = (token.familyId as string | null) ?? null;
    let accessToken = (token.accessToken as string) || "";
    let refreshToken = (token.refreshToken as string) || "";

    // If userId wasn't in the token, look it up from Supabase
    if (!userId) {
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("id, family_id, google_access_token, google_refresh_token")
        .eq("email", token.email)
        .limit(1)
        .single();

      if (!user) return null;

      userId = user.id;
      familyId = user.family_id || null;
      accessToken = user.google_access_token || "";
      refreshToken = user.google_refresh_token || "";
    }

    return {
      user: {
        id: userId,
        familyId,
        accessToken,
        refreshToken,
        name: (token.name as string) ?? null,
        email: token.email ?? null,
        image: (token.picture as string) ?? null,
      },
      expires: token.exp
        ? new Date(token.exp * 1000).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    } as Session;
  } catch (e) {
    console.error("[Session] All session resolution methods failed:", e);
    return null;
  }
}

/**
 * Require authentication — throws if not authenticated.
 */
export async function requireSession() {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}
