import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";
<<<<<<< ours
import { deleteCredentials } from "@/features/calendar/services/credential-service";
=======
import { storeCredentials, readCredentials, deleteCredentials } from "@/features/calendar/services/credential-service";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { supabase, userId, isAdmin } = await requireAuth();
    const body = await req.json();

    // Check ownership
    const { data: sub, error: subError } = await supabase
      .from('calendar_subscriptions')
      .select('user_id, vault_secret_id')
      .eq('id', id)
      .single();

    if (subError) return NextResponse.json({ error: subError.message }, { status: 404 });
    if (!isAdmin && sub.user_id !== userId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const admin = createAdminClient();
    const updateData: any = {
      name: body.name,
      color: body.color,
      visibility_days_before: body.visibility_days_before,
      visibility_days_after: body.visibility_days_after,
      active: body.active,
      ical_url: body.ical_url,
      caldav_server_url: body.caldav_server_url,
      caldav_calendar_url: body.caldav_calendar_url,
      auth_type: body.auth_type
    };

    // Remove undefined fields
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    // Handle credentials if provided
    if (body.secret) {
      // If secret is provided, update or create vault entry
      const vaultId = await storeCredentials(admin, id, body.username, body.secret);
      updateData.vault_secret_id = vaultId;
    } else if (body.username !== undefined && sub.vault_secret_id) {
       // If only username changed but secret didn't, we need to preserve the old secret
       const existing = await readCredentials(admin, sub.vault_secret_id);
       if (existing.username !== body.username) {
         const vaultId = await storeCredentials(admin, id, body.username, existing.secret);
         updateData.vault_secret_id = vaultId;
       }
    }

    const { error: updateError } = await supabase
      .from('calendar_subscriptions')
      .update(updateData)
      .eq('id', id);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Update subscription error:', e);
    return NextResponse.json({ error: e.message || "Failed to update subscription" }, { status: 500 });
  }
}
>>>>>>> theirs

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
<<<<<<< ours
    const { supabase, userId } = await requireAuth();
=======
    const { supabase, userId, isAdmin } = await requireAuth();
>>>>>>> theirs

    // Check ownership
    const { data: sub, error: subError } = await supabase
      .from('calendar_subscriptions')
      .select('vault_secret_id, user_id')
      .eq('id', id)
      .single();

    if (subError) return NextResponse.json({ error: subError.message }, { status: 404 });
<<<<<<< ours
    if (sub.user_id !== userId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
=======
    if (!isAdmin && sub.user_id !== userId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
>>>>>>> theirs

    const admin = createAdminClient();
    
    // Delete credentials from Vault if any
    if (sub.vault_secret_id) {
      await deleteCredentials(admin, sub.vault_secret_id);
    }

    // Get article IDs to delete before deleting events
    const { data: events } = await admin
      .from('calendar_events')
      .select('article_id')
      .eq('subscription_id', id);
      
    if (events) {
      const articleIds = (events.map(e => e.article_id).filter(Boolean) as string[]);
      if (articleIds.length > 0) {
        await admin.from('articles').delete().in('id', articleIds);
      }
    }

    // Delete from storage
    const { data: folders } = await admin.storage
      .from('calendar-attachments')
<<<<<<< ours
      .list(`${userId}/${id}`);
=======
      .list(`${sub.user_id}/${id}`);
>>>>>>> theirs
      
    if (folders && folders.length > 0) {
      for (const folder of folders) {
        const { data: files } = await admin.storage
          .from('calendar-attachments')
<<<<<<< ours
          .list(`${userId}/${id}/${folder.name}`);
        
        if (files && files.length > 0) {
          const filesToRemove = files.map(f => `${userId}/${id}/${folder.name}/${f.name}`);
=======
          .list(`${sub.user_id}/${id}/${folder.name}`);
        
        if (files && files.length > 0) {
          const filesToRemove = files.map(f => `${sub.user_id}/${id}/${folder.name}/${f.name}`);
>>>>>>> theirs
          await admin.storage.from('calendar-attachments').remove(filesToRemove);
        }
      }
    }

    const { error: deleteError } = await supabase
      .from('calendar_subscriptions')
      .delete()
      .eq('id', id);

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Delete subscription error:', e);
    return NextResponse.json({ error: e.message || "Failed to delete subscription" }, { status: 500 });
  }
}
