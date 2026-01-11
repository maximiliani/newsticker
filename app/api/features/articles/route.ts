import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { Article, CreateArticleData } from "@/types/article";

/**
 * GET /api/features/newspaper/articles
 * - Authenticated users: list their own articles
 * - Admins: may pass ?scope=all to list all articles, or ?userId=... to filter by user
 */
export async function GET(req: NextRequest) {
  try {
    const { supabase, userId, isAdmin } = await requireAuth();
    const { searchParams } = new URL(req.url);
    const scope = (searchParams.get("scope") || "current").toLowerCase();
    const filterUserId = searchParams.get("userId");

    let query = supabase.from("articles").select("*").order("created_at", { ascending: false }) as any;

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

/**
 * POST /api/features/newspaper/articles
 * Create a new article for the authenticated user.
 */
export async function POST(req: NextRequest) {
  try {
    const { supabase, userId } = await requireAuth();
    const body = (await req.json()) as CreateArticleData;

    if (!body?.title || !body?.description || !body?.content) {
      return NextResponse.json({ error: "Missing required fields: title, description, content" }, { status: 400 });
    }

    const payload: any = {
      title: body.title,
      description: body.description,
      content: body.content,
      json_content: body.json_content ?? null,
      visibility_from: body.visibility_from,
      visibility_to: body.visibility_to ?? null,
      media_urls: body.media_urls ?? null,
      user_id: userId,
    };

    const { data, error } = await supabase.from("articles").insert(payload).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data as Article, { status: 201 });
  } catch (e: any) {
    const msg = e?.message || "Unexpected error";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
