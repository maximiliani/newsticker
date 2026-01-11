import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";

/**
 * GET /api/features/instagram/posts
 * List Instagram posts.
 * - Authenticated non-admins: only their own accounts' posts.
 * - Admins: may pass ?scope=all to list all; also filter by ?accountId= or ?userId=<auth user id> (owner of IG account).
 */
export async function GET(req: NextRequest) {
  try {
    const { supabase, userId, isAdmin } = await requireAuth();
    const { searchParams } = new URL(req.url);
    const scope = (searchParams.get("scope") || "current").toLowerCase();
    const accountId = searchParams.get("accountId");
    const ownerUserId = searchParams.get("userId");

    let query = supabase.from("instagram_posts").select("*").order("posted_at", { ascending: false }) as any;

    // If accountId is provided, filter by it directly
    if (accountId) {
      query = query.eq("user_id", Number(accountId));
    } else if (isAdmin && scope === "all") {
      // Optional filter by auth user owner (map to account ids)
      if (ownerUserId) {
        const { data: accs, error: accErr } = await supabase
          .from("instagram_accounts")
          .select("id")
          .eq("user_id", ownerUserId);
        if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 });
        const ids = (accs || []).map((a: any) => a.id);
        if (ids.length > 0) query = query.in("user_id", ids);
        else return NextResponse.json({ items: [] });
      }
    } else {
      // Restrict to current user's accounts
      const { data: accs, error: accErr } = await supabase
        .from("instagram_accounts")
        .select("id")
        .eq("user_id", userId);
      if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 });
      const ids = (accs || []).map((a: any) => a.id);
      if (ids.length > 0) query = query.in("user_id", ids);
      else return NextResponse.json({ items: [] });
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ items: data || [] });
  } catch (e: any) {
    const msg = e?.message || "Unexpected error";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
