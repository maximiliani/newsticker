import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { UpdateArticleData } from "@/types/article";

/**
 * GET /api/features/newspaper/articles/:id
 * Owner or admin may view the article.
 */
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, userId, isAdmin } = await requireAuth();
    const { id } = await context.params;
    if (!id) return NextResponse.json({ error: "Article ID is required" }, { status: 400 });

    const { data, error } = await supabase.from("articles").select("*").eq("id", id).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!isAdmin && data.user_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    return NextResponse.json(data);
  } catch (e: any) {
    const msg = e?.message || "Unexpected error";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

/**
 * PATCH /api/features/newspaper/articles/:id
 * Owner or admin may update the article.
 */
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, userId, isAdmin } = await requireAuth();
    const { id } = await context.params;
    if (!id) return NextResponse.json({ error: "Article ID is required" }, { status: 400 });

    // Ensure ownership before updating
    const { data: existing, error: fetchErr } = await supabase
      .from("articles")
      .select("user_id")
      .eq("id", id)
      .single();
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!isAdmin && existing.user_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await req.json()) as UpdateArticleData;
    const update: any = { ...body };
    delete update.id;

    const { data, error } = await supabase
      .from("articles")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e: any) {
    const msg = e?.message || "Unexpected error";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

/**
 * DELETE /api/features/newspaper/articles/:id
 * Owner or admin may delete the article.
 * Note: storage media cleanup should be handled by service layer or background job.
 */
export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, userId, isAdmin } = await requireAuth();
    const { id } = await context.params;
    if (!id) return NextResponse.json({ error: "Article ID is required" }, { status: 400 });

    // Ownership check
    const { data: existing, error: fetchErr } = await supabase
      .from("articles")
      .select("user_id")
      .eq("id", id)
      .single();
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!isAdmin && existing.user_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { error } = await supabase.from("articles").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message || "Unexpected error";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
