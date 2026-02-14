import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/db";
import {
  ensureFamilyCalendar,
  createGoogleEvent,
} from "@/lib/google-calendar";
import { addHours } from "date-fns";

export async function POST() {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const calId = await ensureFamilyCalendar(
      session.user.accessToken,
      session.user.refreshToken
    );

    const now = new Date();
    const start = addHours(now, 1);
    const end = addHours(now, 2);

    const googleEvent = await createGoogleEvent(
      session.user.accessToken,
      session.user.refreshToken,
      calId,
      {
        title: "Test Event from Family Scheduler",
        start,
        end,
        allDay: false,
        description: "This is a test event. You can delete it.",
      }
    );

    // Also store in our DB
    await supabaseAdmin.from("events").insert({
      family_id: session.user.familyId,
      google_event_id: googleEvent.id,
      title: "Test Event from Family Scheduler",
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      all_day: false,
      category: "other",
      priority: "low",
      created_from: "manual",
      notes: "Test event — feel free to delete.",
    });

    return NextResponse.json({
      success: true,
      eventLink: googleEvent.htmlLink,
    });
  } catch (error) {
    console.error("[Calendar/TestEvent] Error:", error);
    return NextResponse.json(
      { error: "Failed to create test event" },
      { status: 500 }
    );
  }
}
