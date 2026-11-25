import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

// Relocated endpoint: POST /api/features/instagram/refresh-tokens
// The database function refreshes every account, so this endpoint is admin-only.
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

    if (!isAdminData) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }
    const admin = createAdminClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await admin.rpc("refresh_instagram_tokens");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, scope: "all", result: data ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
