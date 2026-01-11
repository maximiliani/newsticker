import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Relocated endpoint: POST /api/features/instagram/refresh-tokens
// Triggers the DB function refresh_instagram_tokens. Admin => all; user => current.
export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user?.id || null;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: isAdminData, error: isAdminErr } = await supabase.rpc("check_is_admin");
    if (isAdminErr) {
      return NextResponse.json({ error: isAdminErr.message }, { status: 500 });
    }

    const scope = isAdminData ? "all" : "current";

    const { data, error } = await supabase.rpc("refresh_instagram_tokens");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, scope, result: data ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
