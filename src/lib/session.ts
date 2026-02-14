import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

/**
 * Get the current user session (server-side).
 * Returns null if not authenticated or if session lookup fails (e.g. missing env vars).
 */
export async function getSession() {
  try {
    return await getServerSession(authOptions);
  } catch (e) {
    console.error("[Session] Error (check env: NEXTAUTH_SECRET, Supabase, Google OAuth):", e);
    return null;
  }
}

/**
 * Require authentication — throws redirect if not authenticated.
 */
export async function requireSession() {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}
