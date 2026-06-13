import { NextRequest, NextResponse } from "next/server";
import { allowInternalOrAdmin } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncSubscription } from "@/features/calendar/services/calendar-sync-service";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { isAdmin, supabase } = await allowInternalOrAdmin(req);
    
    if (!isAdmin && supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      
      const { data: sub } = await supabase
        .from('calendar_subscriptions')
        .select('user_id')
        .eq('id', id)
        .single();
        
      if (!sub || sub.user_id !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const result = await syncSubscription(id, admin);
    
    return NextResponse.json(result);
  } catch (e: any) {
    console.error('Sync subscription error:', e);
    return NextResponse.json({ error: e.message || "Failed to sync subscription" }, { status: 500 });
  }
}
