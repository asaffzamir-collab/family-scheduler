import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/db";

/**
 * GET — return the user's currently saved calendar selection (for pre-checking in Settings).
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("user_calendars")
      .select("google_calendar_id, account_email")
      .eq("user_id", session.user.id)
      .eq("role", "read")
      .eq("selected_for_sync", true);

    if (error) throw error;

    return NextResponse.json({
      selection: (data || []).map((r) => ({
        google_calendar_id: r.google_calendar_id,
        account_email: r.account_email ?? null,
      })),
    });
  } catch (error) {
    console.error("[Calendar/Selection] Error:", error);
    return NextResponse.json(
      { error: "Failed to load selection" },
      { status: 500 }
    );
  }
}
