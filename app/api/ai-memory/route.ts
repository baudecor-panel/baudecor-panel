import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from("ai_memory")
    .select("id, category, key, value, updated_at")
    .order("category")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ memories: data || [] });
}

export async function POST(req: NextRequest) {
  const { category, key, value } = await req.json();

  if (!category || !key || !value) {
    return NextResponse.json({ error: "Eksik alan" }, { status: 400 });
  }

  // Aynı key varsa güncelle, yoksa ekle
  const { data: existing } = await supabase
    .from("ai_memory")
    .select("id")
    .eq("category", category)
    .eq("key", key)
    .single();

  if (existing) {
    const { error } = await supabase
      .from("ai_memory")
      .update({ value, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase
      .from("ai_memory")
      .insert([{ category, key, value }]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  const { error } = await supabase.from("ai_memory").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
