import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/db";

// GET — list reminder rules
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.familyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("reminder_rules")
      .select("*")
      .eq("family_id", session.user.familyId);

    if (error) throw error;
    return NextResponse.json({ rules: data || [] });
  } catch (error) {
    console.error("[ReminderRules] Error:", error);
    return NextResponse.json(
      { error: "Failed to load rules" },
      { status: 500 }
    );
  }
}

// PUT — update reminder rules
export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.familyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { rules } = body as {
      rules: { category: string; offsets: unknown[] }[];
    };

    for (const rule of rules) {
      await supabaseAdmin
        .from("reminder_rules")
        .upsert(
          {
            family_id: session.user.familyId,
            category: rule.category,
            offsets: rule.offsets,
          },
          { onConflict: "family_id,category" }
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ReminderRules] Error:", error);
    return NextResponse.json(
      { error: "Failed to update rules" },
      { status: 500 }
    );
  }
}
