import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/db";
import { sendPush } from "@/lib/web-push-util";

export async function POST() {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", session.user.id);

    if (!subs || subs.length === 0) {
      return NextResponse.json(
        { error: "No push subscriptions found. Enable notifications first." },
        { status: 404 }
      );
    }

    let sent = 0;
    for (const sub of subs) {
      const ok = await sendPush(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        {
          title: "Test Notification",
          body: "If you see this, phone notifications are working!",
          url: "/dashboard",
        }
      );
      if (ok) sent++;
    }

    return NextResponse.json({ success: true, sent });
  } catch (error) {
    console.error("[Push/Test] Error:", error);
    return NextResponse.json(
      { error: "Failed to send test push" },
      { status: 500 }
    );
  }
}
