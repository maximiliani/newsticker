import { NextRequest, NextResponse } from "next/server";
import { allowInternalOrAdmin } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncAllSubscriptions } from "@/features/calendar/services/calendar-sync-service";

export async function POST(req: NextRequest) {
  try {
    const { isAdmin } = await allowInternalOrAdmin(req);
    
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const results = await syncAllSubscriptions(admin);
    
    return NextResponse.json(results);
  } catch (e: any) {
    console.error('Sync all calendars error:', e);
    return NextResponse.json({ error: e.message || "Failed to sync calendars" }, { status: 500 });
  }
}
