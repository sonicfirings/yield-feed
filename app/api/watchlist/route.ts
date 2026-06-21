import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ watchlist: [] });

  const { data, error } = await supabase
    .from("watchlist")
    .select("*")
    .eq("user_id", DEMO_USER_ID)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ watchlist: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  const { opportunityId } = await request.json();
  if (!opportunityId) return NextResponse.json({ error: "opportunityId is required" }, { status: 400 });
  if (!supabase) return NextResponse.json({ saved: true, localOnly: true });

  const { data, error } = await supabase
    .from("watchlist")
    .upsert({ user_id: DEMO_USER_ID, opportunity_id: opportunityId }, { onConflict: "user_id,opportunity_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ saved: true, item: data });
}

export async function DELETE(request: Request) {
  const supabase = getSupabaseAdmin();
  const { opportunityId } = await request.json();
  if (!opportunityId) return NextResponse.json({ error: "opportunityId is required" }, { status: 400 });
  if (!supabase) return NextResponse.json({ removed: true, localOnly: true });

  const { error } = await supabase
    .from("watchlist")
    .delete()
    .eq("user_id", DEMO_USER_ID)
    .eq("opportunity_id", opportunityId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ removed: true });
}
