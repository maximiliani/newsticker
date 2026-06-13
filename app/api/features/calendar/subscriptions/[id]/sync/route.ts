import { NextRequest, NextResponse } from "next/server";
import { requireAuth, allowInternalOrAdmin } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncSubscription } from "@/features/calendar/services/calendar-sync-service";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    // Check if this is an internal/cron call or an admin session
    const { isAdmin: isInternalOrAdmin, supabase: sessionSupabase } = await allowInternalOrAdmin(req);

    if (!isInternalOrAdmin) {
      // If not internal/admin, we require a regular authenticated user who owns the subscription
      const { supabase, userId } = await requireAuth();

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
