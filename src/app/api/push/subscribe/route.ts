import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { endpoint, keys, userAgent } = body as {
      endpoint: string;
      keys: { p256dh: string; auth: string };
      userAgent?: string;
    };

    // Upsert subscription (endpoint is unique)
    const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
      {
        user_id: session.user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        user_agent: userAgent || null,
      },
      { onConflict: "endpoint" }
    );

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Push/Subscribe] Error:", error);
    return NextResponse.json(
      { error: "Failed to subscribe" },
      { status: 500 }
    );
  }
}
