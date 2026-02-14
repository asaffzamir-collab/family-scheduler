import { supabaseAdmin } from "./db";

/**
 * Check for conflicts when adding/updating an event.
 * Returns overlapping events for the same person.
 */
export async function detectConflicts(
  familyId: string,
  personId: string | null,
  startTime: string,
  endTime: string,
  excludeEventId?: string
): Promise<{ id: string; title: string; start_time: string; end_time: string }[]> {
  if (!personId) return [];

  let query = supabaseAdmin
    .from("events")
    .select("id, title, start_time, end_time")
    .eq("family_id", familyId)
    .eq("person_id", personId)
    .lt("start_time", endTime)
    .gt("end_time", startTime);

  if (excludeEventId) {
    query = query.neq("id", excludeEventId);
  }

  const { data } = await query;
  return data || [];
}

/**
 * Flag an event as having conflicts.
 */
export async function setConflictFlag(
  eventId: string,
  hasConflict: boolean
) {
  await supabaseAdmin
    .from("events")
    .update({ conflict_flag: hasConflict })
    .eq("id", eventId);
}
