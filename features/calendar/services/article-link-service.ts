import { SupabaseClient } from '@supabase/supabase-js';

export async function markLocallyModified(
  articleId: string,
  userDisplayName: string,
  admin: SupabaseClient
): Promise<void> {
  const { data: event, error: eventError } = await admin
    .from('calendar_events')
    .select('id')
    .eq('article_id', articleId)
    .single();

  // If no linked calendar event, just return
  if (eventError && eventError.code === 'PGRST116') return;
  if (eventError) throw eventError;

  if (event) {
    const { error: updateEventError } = await admin
      .from('calendar_events')
      .update({ locally_modified: true })
      .eq('id', event.id);

    if (updateEventError) throw updateEventError;

    const { error: updateArticleError } = await admin
      .from('articles')
      .update({ custom_author_name: userDisplayName })
      .eq('id', articleId);

    if (updateArticleError) throw updateArticleError;
  }
}
