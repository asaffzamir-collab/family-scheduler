import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

/**
 * Redirects user to Google OAuth to link an additional account.
 * This is separate from the main sign-in — it just captures tokens
 * for a second Google account (e.g. work email).
 */
export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/link/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope:
      "openid email profile https://www.googleapis.com/auth/calendar.readonly",
    access_type: "offline",
    prompt: "consent",
    state: session.user.id, // pass user ID so callback knows who to link
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  return NextResponse.redirect(url);
}
