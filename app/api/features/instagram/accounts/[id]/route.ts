import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { createClient as createSupabaseServerClient } from "@supabase/supabase-js";

/**
 * GET /api/features/instagram/accounts/:id
 * Returns account metadata if the caller is the owner or an admin.
 */
export async function GET(_req: NextRequest, context: { params: { id: string } }) {
  try {
    const { supabase, userId, isAdmin } = await requireAuth();
    const accountId = context.params?.id;
    if (!accountId) return NextResponse.json({ error: "Account ID is required" }, { status: 400 });

    // Fetch account
    const { data: acc, error } = await supabase
      .from("instagram_accounts")
      .select("id, username, profile_image_url, user_id")
      .eq("id", accountId)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!acc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!isAdmin && acc.user_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    return NextResponse.json(acc);
  } catch (e: any) {
    const msg = e?.message || "Unexpected error";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

/**
 * DELETE /api/features/instagram/accounts/:id
 * Owner or admin can delete. Also attempts to remove related storage objects using service role.
 */
export async function DELETE(_req: NextRequest, context: { params: { id: string } }) {
  try {
    const { supabase, userId, isAdmin } = await requireAuth();
    const accountId = context.params?.id;
    if (!accountId) return NextResponse.json({ error: "Account ID is required" }, { status: 400 });

    // Fetch account to check ownership
    const { data: acc, error: accErr } = await supabase
      .from("instagram_accounts")
      .select("id, user_id")
      .eq("id", accountId)
      .single();
    if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 });
    if (!acc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!isAdmin && acc.user_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Best-effort: remove storage files using service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceKey) {
      const admin = createSupabaseServerClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

      // Remove instagram-media files by prefix `${accountId}/`
      const { data: mediaFiles } = await admin.storage.from("instagram-media").list(accountId + "/");
      if (Array.isArray(mediaFiles) && mediaFiles.length > 0) {
        const paths = mediaFiles.map((f) => `${accountId}/${f.name}`);
        await admin.storage.from("instagram-media").remove(paths);
      }
      // Remove profile images by prefix `instagram-${accountId}-`
      const { data: profileFiles } = await admin.storage.from("instagram-profiles").list("");
      const toRemove = (profileFiles || []).filter((f) => f.name.startsWith(`instagram-${accountId}-`)).map((f) => f.name);
      if (toRemove.length > 0) {
        await admin.storage.from("instagram-profiles").remove(toRemove);
      }
    }

    // Delete account (will cascade to posts and media rows)
    const { error: delErr } = await supabase.from("instagram_accounts").delete().eq("id", accountId);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message || "Unexpected error";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
