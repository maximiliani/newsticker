import { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { SyncResult, CalendarSubscription, ParsedCalendarEvent } from '@/types/calendar';
import { fetchPublicICal, parseICalText } from './ical-parser';
import { fetchCalendarICalTexts } from './caldav-client';
import { readCredentials } from './credential-service';
import { downloadAndStoreAttachments, deleteAttachments } from './attachment-service';
import { isSafeUrl, escapeHtml } from '@/lib/security';

/**
 * Synchronizes a single calendar subscription.
 * Fetches the calendar feed (iCal or CalDAV), parses events, and updates
 * the corresponding articles in the database.
 *
 * @param subscriptionId UUID of the subscription to sync
 * @param admin Supabase admin client
 * @returns Result of the synchronization process
 */
export async function syncSubscription(subscriptionId: string, admin: SupabaseClient): Promise<SyncResult> {
  const { data: sub, error: subError } = await admin
    .from('calendar_subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .single();

  if (subError) throw subError;
  const subscription = sub as CalendarSubscription;

  let icalTexts: string[] = [];
  let newEtag: string | undefined = subscription.etag || undefined;
  let newCtag: string | undefined = subscription.ctag || undefined;

  try {
    if (subscription.auth_type === 'public' && subscription.ical_url) {
      const { icalText, newEtag: etag, notModified } = await fetchPublicICal(subscription.ical_url, subscription.etag || undefined);
      if (notModified) return { subscriptionId, status: 'not_modified', added: 0, updated: 0, deleted: 0 };
      if (icalText) icalTexts = [icalText];
      newEtag = etag;
    } else if (subscription.caldav_calendar_url && subscription.vault_secret_id) {
      const credentials = await readCredentials(admin, subscription.vault_secret_id);
      const { texts, ctag } = await fetchCalendarICalTexts(
        subscription.caldav_server_url!,
        subscription.caldav_calendar_url,
        subscription.auth_type,
        credentials
      );
      if (ctag && ctag === subscription.ctag) return { subscriptionId, status: 'not_modified', added: 0, updated: 0, deleted: 0 };
      icalTexts = texts;
      newCtag = ctag;
    } else {
      throw new Error('Invalid subscription configuration');
    }

    // Define the sync window based on subscription settings
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - subscription.visibility_days_before);
    const windowEnd = new Date();
    windowEnd.setDate(windowEnd.getDate() + subscription.visibility_days_after);

    const allParsedEvents: ParsedCalendarEvent[] = [];
    for (const text of icalTexts) {
      allParsedEvents.push(...parseICalText(text, windowStart, windowEnd));
    }

    // Get existing events for this subscription within the sync window.
    // We only care about events in the window to avoid deleting events
    // that are outside our current synchronization scope.
    const { data: existingEvents, error: eventsError } = await admin
      .from('calendar_events')
      .select('*')
      .eq('subscription_id', subscriptionId)
      .gte('event_start', windowStart.toISOString())
      .lte('event_start', windowEnd.toISOString());

    if (eventsError) throw eventsError;

    const existingEventsMap = new Map(existingEvents?.map(e => [e.event_uid, e]));
    const seenUids = new Set<string>();

    let added = 0;
    let updated = 0;

    // Get user's name for author string
    const { data: userData } = await admin.auth.admin.getUserById(subscription.user_id);
    const userName = (userData?.user?.user_metadata?.full_name as string) || 'User';

    for (const event of allParsedEvents) {
      seenUids.add(event.uid);
      const sourceHash = computeSourceHash(event);
      const existing = existingEventsMap.get(event.uid);

      // Skip if the user has manually modified the event in our system
      if (existing && existing.locally_modified) continue;
      // Skip if the event hasn't changed since the last sync
      if (existing && existing.source_hash === sourceHash) continue;

      let processedAttachments: { url: string; filename: string; path: string; mimeType?: string }[] = [];

      try {
        // Download attachments
        processedAttachments = await downloadAndStoreAttachments(
            event.attachments,
            subscriptionId,
            event.uid,
            subscription.user_id,
            admin
        );
      } catch (e) {
        console.error(e);
      }

      try {
        const content = generateArticleContent(event, subscription, userName, processedAttachments);

        const dateStr = event.dtstart.toLocaleString();
        let articleId = existing?.article_id;
        const articleData: any = {
          user_id: subscription.user_id,
          title: event.summary,
          description: `${dateStr} - ${event.description.substring(0, 160)}`,
          content: content.html,
          html_content: content.html,
          json_content: content.json,
          custom_author_name: content.author,
          visibility_from: content.visibilityFrom.toISOString(),
          visibility_to: content.visibilityTo.toISOString(),
        };

        if (articleId) {
          const { error: updateError } = await admin.from('articles').update(articleData).eq('id', articleId);
          if (updateError) throw updateError;
          updated++;
        } else {
          const { data: newArticle, error: createError } = await admin
            .from('articles')
            .insert(articleData)
            .select('id')
            .single();
          if (createError) throw createError;
          articleId = newArticle.id;
          added++;
        }

        await admin.from('calendar_events').upsert({
          subscription_id: subscriptionId,
          user_id: subscription.user_id,
          event_uid: event.uid,
          article_id: articleId,
          event_start: event.dtstart.toISOString(),
          source_hash: sourceHash,
          last_synced_at: new Date().toISOString()
        }, { onConflict: 'subscription_id, event_uid' });
      } catch (err) {
        // Cleanup orphaned attachments if the article write fails
        console.error(`Failed to write article for event ${event.uid}, cleaning up attachments:`, err);
        await deleteAttachments(processedAttachments.map(a => a.path), admin);
        throw err;
      }
    }

    // Handle deleted events
    let deleted = 0;
    for (const [uid, event] of Array.from(existingEventsMap.entries())) {
      if (!seenUids.has(uid)) {
        if (!event.locally_modified && event.article_id) {
          await admin.from('articles').delete().eq('id', event.article_id);
          deleted++;
        }
        await admin.from('calendar_events').delete().eq('id', event.id);
      }
    }

    await admin.from('calendar_subscriptions').update({
      last_synced_at: new Date().toISOString(),
      etag: newEtag,
      ctag: newCtag
    }).eq('id', subscriptionId);

    return { subscriptionId, status: 'success', added, updated, deleted };
  } catch (error: any) {
    console.error(`Sync failed for subscription ${subscriptionId}:`, error);
    return { subscriptionId, status: 'error', added: 0, updated: 0, deleted: 0, error: error.message };
  }
}

function computeSourceHash(event: ParsedCalendarEvent): string {
  const content = `${event.summary}|${event.description}|${event.dtstart.getTime()}|${event.dtend.getTime()}|${event.location}|${event.url}`;
  return createHash('sha256').update(content).digest('hex');
}

function getAttachmentType(filename: string, mimeType?: string): 'image' | 'video' | 'audio' | 'pdf' | 'other' {
  if (mimeType) {
    const mime = mimeType.toLowerCase();
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    if (mime === 'application/pdf') return 'pdf';
  }

  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return 'other';

  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'];
  const videoExts = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'flv', 'wmv'];
  const audioExts = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac', 'wma'];

  if (imageExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  if (audioExts.includes(ext)) return 'audio';
  if (ext === 'pdf') return 'pdf';

  return 'other';
}

/**
 * Generates the HTML and JSON content and metadata for an article based on a calendar event.
 */
function generateArticleContent(
  event: ParsedCalendarEvent,
  subscription: CalendarSubscription,
  userName: string,
  attachments: { url: string; filename: string; mimeType?: string }[]
) {
  const author = escapeHtml(`${subscription.name} by ${userName}`);

  const dateStr = event.dtstart.toLocaleString();

  // Build HTML
  let html = `<p><strong>Event:</strong> ${escapeHtml(event.summary)}</p>`;
  html += `<p><strong>Time:</strong> ${dateStr}</p>`;
  if (event.location) {
    const osmUrl = `https://www.openstreetmap.org/search?query=${encodeURIComponent(event.location)}`;
    html += `<p><strong>Location:</strong> <a href="${osmUrl}" target="_blank"><strong>${escapeHtml(event.location)}</strong></a></p>`;
    html += `<iframe width="425" height="350" src="https://www.openstreetmap.org/export/embed.html?query=${encodeURIComponent(event.location)}&amp;layer=mapnik" style="border: 1px solid black"></iframe><br/>`
  }
  if (event.description) html += `<p>${escapeHtml(event.description).replace(/\n/g, '<br>')}</p>`;

  if (event.url && (event.url.startsWith('http://') || event.url.startsWith('https://'))) {
    html += `<p><a href="${escapeHtml(event.url)}" target="_blank">${escapeHtml(event.url)}</a></p>`;
  }

  if (attachments.length > 0) {
    html += '<p><strong>Attachments:</strong></p><ul>';
    attachments.forEach((att) => {
      html += `<li><a href="${att.url}" target="_blank">${escapeHtml(att.filename)}</a></li>`;
    });
    html += '</ul>';
  }

  // Build a simple Plate-compatible JSON structure
  const jsonContent: any = [
    {
      type: 'p',
      children: [
        { bold: true, text: 'Event: ' },
        { text: event.summary }
      ]
    },
    {
      type: 'p',
      children: [
        { bold: true, text: 'Time: ' },
        { text: dateStr }
      ]
    }
  ];

  if (event.location) {
    jsonContent.push({
      type: 'p',
      children: [
        { bold: true, text: 'Location: ' },
        { text: event.location }
      ]
    });
  }

  if (event.description) {
    const lines = event.description.split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        jsonContent.push({
          type: 'p',
          children: [{ text: line }]
        });
      }
    });
  }

  if (event.url && (event.url.startsWith('http://') || event.url.startsWith('https://'))) {
    jsonContent.push({
      type: 'p',
      children: [
        {
          type: 'a',
          url: event.url,
          children: [{ text: event.url }]
        }
      ]
    });
  }

  if (attachments.length > 0) {
    html += '<p><strong>Attachments:</strong></p>';
    attachments.forEach((att) => {
      const type = getAttachmentType(att.filename, att.mimeType);
      const escapedFilename = escapeHtml(att.filename);
      const escapedUrl = escapeHtml(att.url);

      if (type === 'image') {
        html += `
<div class="attachment-embed attachment-image" style="margin-bottom: 1.5rem;">
  <p style="margin-bottom: 0.25rem;"><a href="${escapedUrl}" target="_blank">${escapedFilename}</a><p>
  <img src="${escapedUrl}" alt="${escapedFilename}" style="max-width: 100%; height: auto; border-radius: 8px; display: block; border: 1px solid #e2e8f0;" />
</div>`;
      } else if (type === 'video') {
        html += `
<div class="attachment-embed attachment-video" style="margin-bottom: 1.5rem;">
  <p style="margin-bottom: 0.25rem;"><a href="${escapedUrl}" target="_blank">${escapedFilename}</a></p>
  <video src="${escapedUrl}" controls style="max-width: 100%; border-radius: 8px; display: block; border: 1px solid #e2e8f0;"></video>
</div>`;
      } else if (type === 'audio') {
        html += `
<div class="attachment-embed attachment-audio" style="margin-bottom: 1.5rem;">
  <p style="margin-bottom: 0.25rem;"><a href="${escapedUrl}" target="_blank">${escapedFilename}</a></p>
  <audio src="${escapedUrl}" controls style="width: 100%; max-width: 400px; display: block;"></audio>
</div>`;
      } else if (type === 'pdf') {
        html += `
<div class="attachment-embed attachment-pdf" style="margin-bottom: 1.5rem;">
  <p style="margin-bottom: 0.25rem;"><a href="${escapedUrl}" target="_blank">${escapedFilename}</a></p>
  <iframe src="${escapedUrl}" width="100%" height="500px" style="border: 1px solid #e2e8f0; border-radius: 8px;"></iframe>
</div>`;
      } else {
        html += `<p style="margin-bottom: 0.5rem;">📄 <a href="${escapedUrl}" target="_blank"><strong>${escapedFilename}</strong></a></p>`;
      }
    });
  }


  const visibilityFrom = new Date(event.dtstart);
  visibilityFrom.setDate(visibilityFrom.getDate() - subscription.visibility_days_before);

  const visibilityTo = new Date(event.dtstart);
  visibilityTo.setDate(visibilityTo.getDate() + subscription.visibility_days_after);

  return { html, json: jsonContent, author, visibilityFrom, visibilityTo };
}

/**
 * Synchronizes all calendar subscriptions for a specific user.
 * Runs syncs in parallel for better performance.
 */
export async function syncAllForUser(userId: string, admin: SupabaseClient): Promise<SyncResult[]> {
  const { data: subs, error } = await admin
    .from('calendar_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('active', true);

  if (error) throw error;

  const results = await Promise.allSettled(subs.map(sub => syncSubscription(sub.id, admin)));
  return results.map(r => r.status === 'fulfilled' ? r.value : {
    subscriptionId: 'unknown',
    status: 'error',
    added: 0,
    updated: 0,
    deleted: 0,
    error: String((r as PromiseRejectedResult).reason)
  });
}

/**
 * Synchronizes all calendar subscriptions in the system.
 * This is typically triggered by a cron job or administrative action.
 */
export async function syncAllSubscriptions(admin: SupabaseClient): Promise<SyncResult[]> {
  const { data: subs, error } = await admin
    .from('calendar_subscriptions')
    .select('id')
    .eq('active', true);

  if (error) throw error;

  const results = await Promise.allSettled(subs.map(sub => syncSubscription(sub.id, admin)));
  return results.map(r => r.status === 'fulfilled' ? r.value : {
    subscriptionId: 'unknown',
    status: 'error',
    added: 0,
    updated: 0,
    deleted: 0,
    error: String((r as PromiseRejectedResult).reason)
  });
}
