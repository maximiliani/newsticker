import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { createClient as createSupabaseServerClient } from "@supabase/supabase-js";

/**
 * GET /api/features/instagram/posts/:id
 */
export async function GET(_req: NextRequest, context: { params: { id: string } }) {
  try {
    const { supabase, userId, isAdmin } = await requireAuth();
    const id = Number(context.params?.id);
    if (!id) return NextResponse.json({ error: "Post ID is required" }, { status: 400 });

    // Fetch the post
    const { data: post, error } = await supabase
      .from("instagram_posts")
      .select("*")
      .eq("id", id)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // // Ownership check for non-admins: ensure their account owns the post
    // if (!isAdmin) {
    //   const { data: acc, error: accErr } = await supabase
    //     .from("instagram_accounts")
    //     .select("user_id")
    //     .eq("id", post.user_id)
    //     .single();
    //   if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 });
    //   if (!acc || acc.user_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // }

    return NextResponse.json(post);
  } catch (e: any) {
    const msg = e?.message || "Unexpected error";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

/**
 * DELETE /api/features/instagram/posts/:id
 * Deletes the post and associated storage files. Admins can delete any post; non-admins can delete only their own.
 */
export async function DELETE(_req: NextRequest, context: { params: { id: string } }) {
  try {
    const { supabase, userId, isAdmin } = await requireAuth();
    const id = Number(context.params?.id);
    if (!id) return NextResponse.json({ error: "Post ID is required" }, { status: 400 });

    // Fetch the post to get owning account id
    const { data: post, error: postErr } = await supabase
      .from("instagram_posts")
      .select("id, user_id")
      .eq("id", id)
      .single();
    if (postErr) return NextResponse.json({ error: postErr.message }, { status: 500 });
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Ownership check for non-admins via account owner
    if (!isAdmin) {
      const { data: acc, error: accErr } = await supabase
        .from("instagram_accounts")
        .select("user_id")
        .eq("id", post.user_id)
        .single();
      if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 });
      if (!acc || acc.user_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Use service-role for storage deletion and DB delete to avoid RLS issues
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Supabase service credentials not configured" }, { status: 500 });
    }
    const admin = createSupabaseServerClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // Clean storage: list files under `${accountId}/` and remove those starting with `${postId}-`
    try {
      const { data: files } = await admin.storage.from("instagram-media").list(`${post.user_id}`);
      const toRemove = (files || [])
        .filter((f: any) => f.name && f.name.startsWith(`${id}-`))
        .map((f: any) => `${post.user_id}/${f.name}`);
      if (toRemove.length > 0) {
        await admin.storage.from("instagram-media").remove(toRemove);
      }
    } catch {}

    // Delete DB post (will cascade to media rows)
    const { error: delErr } = await admin.from("instagram_posts").delete().eq("id", id);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message || "Unexpected error";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
