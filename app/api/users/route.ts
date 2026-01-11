import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';

/**
 * GET /api/users
 * Admin-only list of users (with roles). Supports pagination via limit/offset.
 */
export async function GET(req: NextRequest) {
  try {
    const { supabase, isAdmin } = await requireAuth();
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

    const { data, error, count } = await supabase
      .from('users_secure')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ items: data || [], count: count ?? null, limit, offset });
  } catch (e: any) {
    const msg = e?.message || 'Unexpected error';
    const status = msg === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
