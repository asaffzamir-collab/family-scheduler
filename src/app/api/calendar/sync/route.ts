import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/db";
import { ensureFamilyCalendar } from "@/lib/google-calendar";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { selectedCalendarIds } = body as {
      selectedCalendarIds: { id: string; name: string; account?: string | null }[];
    };

    // Ensure "Family - Master" calendar exists
    const masterCalId = await ensureFamilyCalendar(
      session.user.accessToken,
      session.user.refreshToken
    );

    // Clear previous selections
    await supabaseAdmin
      .from("user_calendars")
      .delete()
      .eq("user_id", session.user.id);

    // Insert read calendars (account_email: null = main account, else linked account email)
    const readInserts = selectedCalendarIds.map((c) => ({
      user_id: session.user.id,
      google_calendar_id: c.id,
      name: c.name,
      role: "read" as const,
      selected_for_sync: true,
      account_email: c.account && c.account !== session.user.email ? c.account : null,
    }));

    // Insert write calendar
    const writeInsert = {
      user_id: session.user.id,
      google_calendar_id: masterCalId,
      name: "Family - Master",
      role: "write" as const,
      selected_for_sync: true,
    };

    await supabaseAdmin
      .from("user_calendars")
      .insert([...readInserts, writeInsert]);

    return NextResponse.json({
      success: true,
      masterCalendarId: masterCalId,
    });
  } catch (error) {
    console.error("[Calendar/Sync] Error:", error);
    return NextResponse.json(
      { error: "Failed to sync calendars" },
      { status: 500 }
    );
  }
}
