import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteCredentials } from "@/features/calendar/services/credential-service";

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { supabase, userId } = await requireAuth();

    // Check ownership
    const { data: sub, error: subError } = await supabase
      .from('calendar_subscriptions')
      .select('vault_secret_id, user_id')
      .eq('id', id)
      .single();

    if (subError) return NextResponse.json({ error: subError.message }, { status: 404 });
    if (sub.user_id !== userId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

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
      .list(`${userId}/${id}`);
      
    if (folders && folders.length > 0) {
      for (const folder of folders) {
        const { data: files } = await admin.storage
          .from('calendar-attachments')
          .list(`${userId}/${id}/${folder.name}`);
        
        if (files && files.length > 0) {
          const filesToRemove = files.map(f => `${userId}/${id}/${folder.name}/${f.name}`);
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
