import { NextRequest, NextResponse } from "next/server";
<<<<<<< ours
import { allowInternalOrAdmin } from "@/lib/api/auth";
=======
import { requireAuth, allowInternalOrAdmin } from "@/lib/api/auth";
>>>>>>> theirs
import { createAdminClient } from "@/lib/supabase/admin";
import { syncSubscription } from "@/features/calendar/services/calendar-sync-service";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
<<<<<<< ours
    const { isAdmin, supabase } = await allowInternalOrAdmin(req);
    
    if (!isAdmin && supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
=======
    
    // Check if this is an internal/cron call or an admin session
    const { isAdmin: isInternalOrAdmin, supabase: sessionSupabase } = await allowInternalOrAdmin(req);
    
    if (!isInternalOrAdmin) {
      // If not internal/admin, we require a regular authenticated user who owns the subscription
      const { supabase, userId } = await requireAuth();
>>>>>>> theirs
      
      const { data: sub } = await supabase
        .from('calendar_subscriptions')
        .select('user_id')
        .eq('id', id)
        .single();
<<<<<<< ours

      if (!sub || sub.user_id !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
=======
        
      if (!sub || sub.user_id !== userId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
>>>>>>> theirs
    }

    const admin = createAdminClient();
    const result = await syncSubscription(id, admin);
<<<<<<< ours

=======
    
>>>>>>> theirs
    return NextResponse.json(result);
  } catch (e: any) {
    console.error('Sync subscription error:', e);
    return NextResponse.json({ error: e.message || "Failed to sync subscription" }, { status: 500 });
  }
}
