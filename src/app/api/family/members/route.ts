import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/db";

// GET — list family members
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.familyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("family_members")
      .select("*")
      .eq("family_id", session.user.familyId)
      .order("role")
      .order("display_name");

    if (error) throw error;
    return NextResponse.json({ members: data || [] });
  } catch (error) {
    console.error("[Family/Members] Error:", error);
    return NextResponse.json(
      { error: "Failed to list members" },
      { status: 500 }
    );
  }
}

// POST — add a family member
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.familyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { display_name, role } = body as {
      display_name: string;
      role: "adult" | "kid";
    };

    const { data, error } = await supabaseAdmin
      .from("family_members")
      .insert({
        family_id: session.user.familyId,
        display_name,
        role,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ member: data });
  } catch (error) {
    console.error("[Family/Members] Error:", error);
    return NextResponse.json(
      { error: "Failed to add member" },
      { status: 500 }
    );
  }
}

// DELETE — remove a family member
export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.familyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const memberId = url.searchParams.get("id");
    if (!memberId) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    await supabaseAdmin
      .from("family_members")
      .delete()
      .eq("id", memberId)
      .eq("family_id", session.user.familyId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Family/Members] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete member" },
      { status: 500 }
    );
  }
}
