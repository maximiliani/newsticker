import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";

/**
 * GET /api/features/instagram/accounts
 * - Authenticated users: list their own accounts
 * - Admins: may pass ?scope=all to list all accounts, or ?userId=... to filter by user
 */
export async function GET(req: NextRequest) {
  try {
    const { supabase, userId, isAdmin } = await requireAuth();
    const { searchParams } = new URL(req.url);
    const scope = (searchParams.get("scope") || "current").toLowerCase();
    const filterUserId = searchParams.get("userId");

    let query = supabase
      .from("instagram_accounts")
      .select("id, username, profile_image_url, user_id") as any;

    if (isAdmin && scope === "all") {
      if (filterUserId) query = query.eq("user_id", filterUserId);
    } else {
      query = query.eq("user_id", userId);
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
