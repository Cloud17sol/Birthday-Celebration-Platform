import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { error } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      status: "ok",
      supabase: "connected",
    });
  } catch (error) {
    console.error("Supabase health check failed:", error);

    return NextResponse.json(
      {
        status: "error",
        supabase: "disconnected",
      },
      { status: 500 }
    );
  }
}