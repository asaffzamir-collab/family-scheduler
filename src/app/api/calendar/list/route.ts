import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/db";
import { listCalendars } from "@/lib/google-calendar";

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get calendars from main account
    const mainCalendars = await listCalendars(
      session.user.accessToken,
      session.user.refreshToken
    );

    const results = mainCalendars.map((c) => ({
      id: c.id,
      summary: c.summary,
      primary: c.primary || false,
      backgroundColor: c.backgroundColor,
      accessRole: c.accessRole,
      account: session.user.email,
    }));

    // Get calendars from linked accounts
    const { data: linkedAccounts } = await supabaseAdmin
      .from("linked_accounts")
      .select("email, google_access_token, google_refresh_token")
      .eq("user_id", session.user.id);

    for (const linked of linkedAccounts || []) {
      if (!linked.google_access_token) continue;
      try {
        const linkedCals = await listCalendars(
          linked.google_access_token,
          linked.google_refresh_token || ""
        );
        // Only show calendars the user owns (not coworkers' calendars shared with them)
        for (const c of linkedCals) {
          if (c.accessRole !== "owner") continue;
          results.push({
            id: c.id,
            summary: c.summary,
            primary: c.primary || false,
            backgroundColor: c.backgroundColor,
            accessRole: c.accessRole,
            account: linked.email,
          });
        }
      } catch (err) {
        console.error(`[Calendar/List] Error loading calendars for ${linked.email}:`, err);
      }
    }

    return NextResponse.json({ calendars: results });
  } catch (error) {
    console.error("[Calendar/List] Error:", error);
    return NextResponse.json(
      { error: "Failed to list calendars" },
      { status: 500 }
    );
  }
}
