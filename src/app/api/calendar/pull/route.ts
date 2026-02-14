import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/db";
import { listEvents } from "@/lib/google-calendar";
import { addDays, startOfDay } from "date-fns";

/**
 * Pull events from selected Google Calendars into the local DB.
 * Pulls from BOTH the main account AND any linked accounts (e.g. work email).
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id || !session?.user?.familyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const daysAhead = (body as { days?: number }).days || 30;

    // Get user's selected read calendars (account_email = which Google account to use)
    const { data: calendars } = await supabaseAdmin
      .from("user_calendars")
      .select("id, google_calendar_id, name, account_email")
      .eq("user_id", session.user.id)
      .eq("role", "read")
      .eq("selected_for_sync", true);

    if (!calendars || calendars.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No calendars selected for sync. Go to Settings to select calendars.",
        synced: 0,
      });
    }

    const now = startOfDay(new Date());
    const timeMin = now.toISOString();
    const timeMax = addDays(now, daysAhead).toISOString();
    let totalSynced = 0;

    // Build a list of token sets: main account + linked accounts
    const tokenSets: { accessToken: string; refreshToken: string; label: string }[] = [
      {
        accessToken: session.user.accessToken,
        refreshToken: session.user.refreshToken,
        label: session.user.email || "main",
      },
    ];

    // Add linked accounts
    const { data: linkedAccounts } = await supabaseAdmin
      .from("linked_accounts")
      .select("email, google_access_token, google_refresh_token")
      .eq("user_id", session.user.id);

    for (const linked of linkedAccounts || []) {
      if (linked.google_access_token) {
        tokenSets.push({
          accessToken: linked.google_access_token,
          refreshToken: linked.google_refresh_token || "",
          label: linked.email,
        });
      }
    }

    // For each calendar, use the token set that matches its account (or try all if no account_email)
    for (const cal of calendars) {
      const tokenSetsToTry =
        cal.account_email != null
          ? tokenSets.filter((t) => t.label === cal.account_email)
          : tokenSets;
      let synced = false;
      for (const tokens of tokenSetsToTry) {
        if (synced) break;
        try {
          const googleEvents = await listEvents(
            tokens.accessToken,
            tokens.refreshToken,
            cal.google_calendar_id,
            timeMin,
            timeMax
          );

          for (const ge of googleEvents) {
            if (!ge.id || !ge.summary) continue;

            // Check if we already have this event
            const { data: existing } = await supabaseAdmin
              .from("events")
              .select("id")
              .eq("google_event_id", ge.id)
              .eq("family_id", session.user.familyId)
              .limit(1);

            if (existing && existing.length > 0) continue;

            const startTime = ge.start?.dateTime || ge.start?.date;
            const endTime = ge.end?.dateTime || ge.end?.date;
            if (!startTime || !endTime) continue;

            const allDay = !ge.start?.dateTime;

            // Guess category from title
            const titleLower = (ge.summary || "").toLowerCase();
            let category = "other";
            if (/test|exam|quiz|midterm|final/.test(titleLower)) category = "test";
            else if (/class|lesson|course|practice|training/.test(titleLower)) category = "class";
            else if (/doctor|dentist|meeting|appointment|gym/.test(titleLower)) category = "personal";

            await supabaseAdmin.from("events").insert({
              family_id: session.user.familyId,
              google_event_id: ge.id,
              calendar_id: cal.id,
              title: ge.summary,
              start_time: allDay
                ? new Date(startTime + "T00:00:00").toISOString()
                : new Date(startTime).toISOString(),
              end_time: allDay
                ? new Date(endTime + "T00:00:00").toISOString()
                : new Date(endTime).toISOString(),
              all_day: allDay,
              category,
              priority: "medium",
              notes: ge.description || null,
              created_from: "manual",
            });

            totalSynced++;
          }
          synced = true; // This token set worked for this calendar
        } catch {
          // This token set can't access this calendar, try next
        }
      }
    }

    return NextResponse.json({ success: true, synced: totalSynced });
  } catch (error) {
    console.error("[CalendarPull] Error:", error);
    return NextResponse.json(
      { error: "Failed to pull calendar events" },
      { status: 500 }
    );
  }
}
