import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db";

/**
 * OAuth callback for linking an additional Google account.
 * Exchanges the code for tokens and stores them in linked_accounts.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const userId = url.searchParams.get("state");

    if (!code || !userId) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/settings?error=missing_code`
      );
    }

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/link/callback`,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();

    if (!tokens.access_token) {
      console.error("[LinkAccount] Token exchange failed:", tokens);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/settings?error=token_failed`
      );
    }

    // Get the email of the linked account
    const profileRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    const profile = await profileRes.json();
    const email = profile.email;

    if (!email) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/settings?error=no_email`
      );
    }

    // Store in linked_accounts (upsert by user_id + email)
    const { error } = await supabaseAdmin.from("linked_accounts").upsert(
      {
        user_id: userId,
        email,
        google_access_token: tokens.access_token,
        google_refresh_token: tokens.refresh_token || null,
      },
      { onConflict: "user_id,email" }
    );

    if (error) {
      console.error("[LinkAccount] DB error:", error);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/settings?error=db_error`
      );
    }

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/settings?linked=${encodeURIComponent(email)}`
    );
  } catch (error) {
    console.error("[LinkAccount] Error:", error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/settings?error=unknown`
    );
  }
}
