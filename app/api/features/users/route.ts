import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { Paged } from "@/types/api";
import { UserWithRoleDTO } from "@/types/users";

/**
 * GET /api/features/users
 * Admin-only: list users with roles. Supports optional limit/offset query params.
 */
export async function GET(req: NextRequest) {
  try {
    const { supabase, isAdmin } = await requireAuth();
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);

    // Prefer a secured table or view that exposes user & role info
    const { data, error } = await supabase
      .from("users_secure")
      .select("*")
      .range(offset, offset + limit - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const items: UserWithRoleDTO[] = (data || []).map((u: any) => ({
      id: u.id,
      email: u.email || "",
      full_name: u.full_name || "",
      avatar_url: u.avatar_url,
      is_admin: !!u.is_admin,
      created_at: u.created_at,
    }));

    const result: Paged<UserWithRoleDTO> = { items, limit, offset };
    return NextResponse.json(result);
  } catch (e: any) {
    const msg = e?.message || "Unexpected error";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
