import { NextRequest, NextResponse } from "next/server";
import { requireAuth, allowInternalOrAdmin } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncSubscription } from "@/features/calendar/services/calendar-sync-service";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    let isInternalOrAdmin = false;
    let supabase;
    let userId;

    const secretHeader = req.headers.get("x-internal-secret");
    const internalSecret = process.env.INTERNAL_ADMIN_SECRET;

    if (internalSecret && secretHeader && internalSecret === secretHeader) {
      isInternalOrAdmin = true;
    } else {
      const auth = await requireAuth();
      supabase = auth.supabase;
      userId = auth.userId;
      isInternalOrAdmin = auth.isAdmin;
    }

    if (!isInternalOrAdmin) {
      if (!supabase || !userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { data: sub } = await supabase
        .from('calendar_subscriptions')
        .select('user_id')
        .eq('id', id)
        .single();

      if (!sub || sub.user_id !== userId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const admin = createAdminClient();
    const result = await syncSubscription(id, admin);

    return NextResponse.json(result);
  } catch (e: any) {
    console.error('Sync subscription error:', e);
    return NextResponse.json({ error: e.message || "Failed to sync subscription" }, { status: 500 });
  }
}
