import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/db";
import { parseMessage } from "@/lib/parser";
import { ensureFamilyCalendar, createGoogleEvent } from "@/lib/google-calendar";
import { detectConflicts, setConflictFlag } from "@/lib/conflicts";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.familyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { text } = body as { text: string };

    // Get family members for parser
    const { data: members } = await supabaseAdmin
      .from("family_members")
      .select("id, display_name")
      .eq("family_id", session.user.familyId);

    const personNames = (members || []).map((m) => m.display_name);

    // Parse
    const parsed = parseMessage(text, personNames);
    if (!parsed) {
      return NextResponse.json(
        { error: "Could not parse the text into an event" },
        { status: 400 }
      );
    }

    // Find person_id
    let personId: string | null = null;
    if (parsed.person && members) {
      const match = members.find(
        (m) => m.display_name.toLowerCase() === parsed.person!.toLowerCase()
      );
      if (match) personId = match.id;
    }

    // Create in Google Calendar
    let googleEventId: string | null = null;
    try {
      const calId = await ensureFamilyCalendar(
        session.user.accessToken,
        session.user.refreshToken
      );
      const gEvent = await createGoogleEvent(
        session.user.accessToken,
        session.user.refreshToken,
        calId,
        {
          title: parsed.title,
          start: parsed.start,
          end: parsed.end,
          allDay: parsed.all_day,
          recurrence: parsed.rrule ? [parsed.rrule] : undefined,
        }
      );
      googleEventId = gEvent.id || null;
    } catch (e) {
      console.error("[QuickAdd] Google Calendar error:", e);
    }

    // Check conflicts
    const conflicts = await detectConflicts(
      session.user.familyId,
      personId,
      parsed.start.toISOString(),
      parsed.end.toISOString()
    );

    // Store event
    const { data: event, error } = await supabaseAdmin
      .from("events")
      .insert({
        family_id: session.user.familyId,
        google_event_id: googleEventId,
        title: parsed.title,
        start_time: parsed.start.toISOString(),
        end_time: parsed.end.toISOString(),
        all_day: parsed.all_day,
        rrule: parsed.rrule || null,
        person_id: personId,
        category: parsed.category,
        priority: "medium",
        created_from: "manual",
        conflict_flag: conflicts.length > 0,
      })
      .select()
      .single();

    if (error) throw error;

    for (const c of conflicts) {
      await setConflictFlag(c.id, true);
    }

    return NextResponse.json({
      event,
      parsed,
      conflicts: conflicts.map((c) => ({ id: c.id, title: c.title })),
    });
  } catch (error) {
    console.error("[QuickAdd] Error:", error);
    return NextResponse.json(
      { error: "Failed to quick-add event" },
      { status: 500 }
    );
  }
}
