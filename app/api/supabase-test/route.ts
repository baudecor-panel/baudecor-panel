import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const supabase = createClient(
      "https://cnhdxdhipbfljvwnnlkv.supabase.co",
      "sb_publishable_A1tto0YYoslAkIDYrwqFOw_I5pVzsbk"
    );

    const { data, error } = await supabase
      .from("products")
      .select("id, name, price");

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          type: "supabase_error",
          message: error.message,
          details: error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      count: data?.length || 0,
      data,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        type: "fetch_error",
        message: err?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}