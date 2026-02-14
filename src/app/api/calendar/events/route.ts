import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/db";
import { detectConflicts, setConflictFlag } from "@/lib/conflicts";
import {
  ensureFamilyCalendar,
  createGoogleEvent,
} from "@/lib/google-calendar";

// GET — list events for the user's family
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.familyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    const category = url.searchParams.get("category");
    const personId = url.searchParams.get("person");

    let query = supabaseAdmin
      .from("events")
      .select("*, family_members:person_id(id, display_name)")
      .eq("family_id", session.user.familyId)
      .order("start_time");

    if (start) query = query.gte("start_time", start);
    if (end) query = query.lte("start_time", end);
    if (category) query = query.eq("category", category);
    if (personId) query = query.eq("person_id", personId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ events: data || [] });
  } catch (error) {
    console.error("[Events/GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to load events" },
      { status: 500 }
    );
  }
}

// POST — create a new event
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.familyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      title,
      start_time,
      end_time,
      all_day,
      person_id,
      category,
      priority,
      notes,
      rrule,
      created_from,
    } = body;

    // Create in Google Calendar
    let googleEventId: string | null = null;
    try {
      const calId = await ensureFamilyCalendar(
        session.user.accessToken,
        session.user.refreshToken
      );
      const googleEvent = await createGoogleEvent(
        session.user.accessToken,
        session.user.refreshToken,
        calId,
        {
          title,
          start: new Date(start_time),
          end: new Date(end_time),
          allDay: all_day || false,
          recurrence: rrule ? [rrule] : undefined,
        }
      );
      googleEventId = googleEvent.id || null;
    } catch (e) {
      console.error("[Events/POST] Google Calendar error:", e);
      // Continue — store locally even if Google fails
    }

    // Check for conflicts
    const conflicts = await detectConflicts(
      session.user.familyId,
      person_id,
      start_time,
      end_time
    );

    // Insert event
    const { data: event, error } = await supabaseAdmin
      .from("events")
      .insert({
        family_id: session.user.familyId,
        google_event_id: googleEventId,
        title,
        start_time,
        end_time,
        all_day: all_day || false,
        rrule: rrule || null,
        person_id: person_id || null,
        category: category || "other",
        priority: priority || "medium",
        notes: notes || null,
        created_from: created_from || "manual",
        conflict_flag: conflicts.length > 0,
      })
      .select()
      .single();

    if (error) throw error;

    // Flag conflicting events too
    for (const c of conflicts) {
      await setConflictFlag(c.id, true);
    }

    return NextResponse.json({
      event,
      conflicts:
        conflicts.length > 0
          ? conflicts.map((c) => ({ id: c.id, title: c.title }))
          : [],
    });
  } catch (error) {
    console.error("[Events/POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to create event" },
      { status: 500 }
    );
  }
}
