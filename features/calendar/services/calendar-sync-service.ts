import { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { SyncResult, CalendarSubscription, ParsedCalendarEvent } from '@/types/calendar';
import { fetchPublicICal, parseICalText } from './ical-parser';
import { fetchCalendarICalTexts } from './caldav-client';
import { readCredentials } from './credential-service';
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

      // Download attachments
      const attachmentUrls = await downloadAndStoreAttachments(
        event.attachments,
        subscriptionId,
        event.uid,
        subscription.user_id,
        admin
      );

      const content = generateArticleContent(event, subscription, userName, attachmentUrls);
      
      let articleId = existing?.article_id;
      const articleData: any = {
        user_id: subscription.user_id,
        title: event.summary,
        description: event.description.substring(0, 200),
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

/**
 * Generates the HTML and JSON content and metadata for an article based on a calendar event.
 */
function generateArticleContent(event: ParsedCalendarEvent, subscription: CalendarSubscription, userName: string, attachmentUrls: string[]) {
  const author = escapeHtml(`${subscription.name} by ${userName}`);
  
  const dateStr = event.dtstart.toLocaleString();
  
  // Build HTML
  let html = `<p><strong>Event:</strong> ${escapeHtml(event.summary)}</p>`;
  html += `<p><strong>Time:</strong> ${dateStr}</p>`;
  if (event.location) html += `<p><strong>Location:</strong> ${escapeHtml(event.location)}</p>`;
  if (event.description) html += `<p>${escapeHtml(event.description).replace(/\n/g, '<br>')}</p>`;
  
  if (event.url && (event.url.startsWith('http://') || event.url.startsWith('https://'))) {
    html += `<p><a href="${escapeHtml(event.url)}" target="_blank">Event Link</a></p>`;
  }
  
  if (attachmentUrls.length > 0) {
    html += '<p><strong>Attachments:</strong></p><ul>';
    attachmentUrls.forEach((url, i) => {
      const filename = event.attachments[i]?.filename || `Attachment ${i+1}`;
      html += `<li><a href="${url}" target="_blank">${escapeHtml(filename)}</a></li>`;
    });
    html += '</ul>';
  }

  // Build a simple Tiptap-compatible JSON structure
  const jsonContent: any = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: 'Event: ' },
          { type: 'text', text: event.summary }
        ]
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: 'Time: ' },
          { type: 'text', text: dateStr }
        ]
      }
    ]
  };

  if (event.location) {
    jsonContent.content.push({
      type: 'paragraph',
      content: [
        { type: 'text', marks: [{ type: 'bold' }], text: 'Location: ' },
        { type: 'text', text: event.location }
      ]
    });
  }

  if (event.description) {
    const lines = event.description.split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        jsonContent.content.push({
          type: 'paragraph',
          content: [{ type: 'text', text: line }]
        });
      }
    });
  }

  if (event.url && (event.url.startsWith('http://') || event.url.startsWith('https://'))) {
     jsonContent.content.push({
      type: 'paragraph',
      content: [
        { 
          type: 'text', 
          marks: [{ type: 'link', attrs: { href: event.url, target: '_blank' } }], 
          text: 'Event Link' 
        }
      ]
    });
  }

  if (attachmentUrls.length > 0) {
    jsonContent.content.push({
      type: 'paragraph',
      content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Attachments:' }]
    });
    
    const listContent = attachmentUrls.map((url, i) => {
      const filename = event.attachments[i]?.filename || `Attachment ${i+1}`;
      return {
        type: 'listItem',
        content: [{
          type: 'paragraph',
          content: [{
            type: 'text',
            marks: [{ type: 'link', attrs: { href: url, target: '_blank' } }],
            text: filename
          }]
        }]
      };
    });

    jsonContent.content.push({
      type: 'bulletList',
      content: listContent
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

