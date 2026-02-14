import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

/**
 * Get the current user session (server-side).
 * Returns null if not authenticated.
 */
export async function getSession() {
  return getServerSession(authOptions);
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
