import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/db";

const CODE_LENGTH = 6;
const EXPIRES_MINUTES = 15;

/**
 * POST — generate a one-time WhatsApp link code for the current user.
 * User sends this code in a WhatsApp message to link their number.
 */
export async function POST() {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete any existing codes for this user
    await supabaseAdmin
      .from("whatsapp_link_codes")
      .delete()
      .eq("user_id", session.user.id);

    const code = Array.from({ length: CODE_LENGTH }, () =>
      Math.floor(Math.random() * 10)
    ).join("");
    const expiresAt = new Date(Date.now() + EXPIRES_MINUTES * 60 * 1000);

    await supabaseAdmin.from("whatsapp_link_codes").insert({
      code,
      user_id: session.user.id,
      expires_at: expiresAt.toISOString(),
    });

    return NextResponse.json({ code, expiresIn: EXPIRES_MINUTES });
  } catch (error) {
    console.error("[WhatsApp/code] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate code" },
      { status: 500 }
    );
  }
}
