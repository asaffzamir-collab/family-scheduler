import { NextResponse } from "next/server";
import { processReminders, sendDailySummary } from "@/lib/reminder-engine";

export async function POST(req: Request) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get("authorization");
    const expected = `Bearer ${process.env.CRON_SECRET}`;
    if (!process.env.CRON_SECRET || authHeader !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "summary") {
      await sendDailySummary();
      return NextResponse.json({ success: true, action: "summary" });
    }

    // Default: process reminders
    const result = await processReminders();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[Cron/Reminders] Error:", error);
    return NextResponse.json(
      { error: "Reminder processing failed" },
      { status: 500 }
    );
  }
}

// Also allow GET for easy testing
export async function GET(req: Request) {
  return POST(req);
}
