import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { storeCredentials } from "@/features/calendar/services/credential-service";
import { syncSubscription } from "@/features/calendar/services/calendar-sync-service";
import { fetchPublicICal, parseCalendarMetadata } from "@/features/calendar/services/ical-parser";

export async function GET() {
  try {
    const { supabase, userId, isAdmin } = await requireAuth();

    let query;
    if (isAdmin) {
      query = supabase
        .from('calendar_subscriptions')
        .select(`
          id, user_id, name, ical_url, auth_type, caldav_server_url, caldav_calendar_url, color,
          visibility_days_before, visibility_days_after, last_synced_at, active, created_at,
          user:users_secure(full_name, email)
        `);
    } else {
      query = supabase
        .from('calendar_subscriptions')
        .select('id, user_id, name, ical_url, auth_type, caldav_server_url, caldav_calendar_url, color, visibility_days_before, visibility_days_after, last_synced_at, active, created_at')
        .eq('user_id', userId);
    }

    const { data, error } = await query;
    console.log(data);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { supabase, userId } = await requireAuth();
    const body = await req.json();
    const { name, ical_url, auth_type, caldav_server_url, caldav_calendar_url, username, secret, color, visibility_days_before, visibility_days_after } = body;

    let finalName = name;
    let finalColor = color;

    if (ical_url && (!auth_type || auth_type === 'public')) {
      try {
        const { icalText } = await fetchPublicICal(ical_url);
        if (icalText) {
          const metadata = parseCalendarMetadata(icalText);
          if (!finalName) finalName = metadata.name;
          if (!finalColor) finalColor = metadata.color;
        }
      } catch (e) {
        console.warn('Failed to fetch calendar metadata:', e);
      }
    }

    const { data: sub, error: subError } = await supabase
      .from('calendar_subscriptions')
      .insert({
        user_id: userId,
        name: finalName || 'New Calendar',
        ical_url,
        auth_type: auth_type || 'public',
        caldav_server_url,
        caldav_calendar_url,
        color: finalColor || '#3B82F6',
        visibility_days_before: visibility_days_before ?? 14,
        visibility_days_after: visibility_days_after ?? 14
      })
      .select()
      .single();

    if (subError) return NextResponse.json({ error: subError.message }, { status: 500 });

    const admin = createAdminClient();
    let finalSub = sub;
    if (auth_type !== 'public' && secret) {
      try {
        const vaultId = await storeCredentials(admin, sub.id, username, secret);
        const { data: updatedSub } = await admin
          .from('calendar_subscriptions')
          .update({ vault_secret_id: vaultId })
          .eq('id', sub.id)
          .select()
          .single();
        if (updatedSub) finalSub = updatedSub;
      } catch (err) {
        // Cleanup the orphaned subscription if credential storage fails
        await admin.from('calendar_subscriptions').delete().eq('id', sub.id);
        throw err;
      }
    }

    // Wait for the first sync so the user sees articles immediately.
    try {
      await syncSubscription(sub.id, admin);
    } catch (err) {
      console.error(`Initial sync failed for subscription ${sub.id}:`, err);
    }

    return NextResponse.json(finalSub, { status: 201 });
  } catch (e: any) {
    console.error('Create subscription error:', e);
    return NextResponse.json({ error: e.message || "Failed to create subscription" }, { status: 500 });
  }
}
