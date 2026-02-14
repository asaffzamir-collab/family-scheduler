import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/db";

/**
 * GET — check if the current user has linked WhatsApp.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data } = await supabaseAdmin
      .from("whatsapp_links")
      .select("id")
      .eq("user_id", session.user.id)
      .limit(1);

    return NextResponse.json({ linked: (data?.length ?? 0) > 0 });
  } catch (error) {
    console.error("[WhatsApp/status] Error:", error);
    return NextResponse.json(
      { error: "Failed to check status" },
      { status: 500 }
    );
  }
}
