import ICAL from 'ical.js';
import { ParsedCalendarEvent, CalendarAttachment } from '@/types/calendar';
import { isSafeUrl } from '@/lib/security';

/**
 * Normalizes webcal:// URLs to https://.
 */
export function normalizeUrl(url: string): string {
  if (url.startsWith('webcal://')) {
    return 'https://' + url.substring(9);
  }
  return url;
}

/**
 * Fetches a public iCal feed with ETag support for efficient synchronization.
 */
export async function fetchPublicICal(url: string, etag?: string): Promise<{ icalText?: string; newEtag?: string; notModified: boolean }> {
  const normalizedUrl = normalizeUrl(url);
<<<<<<< ours

=======
  
>>>>>>> theirs
  if (!isSafeUrl(normalizedUrl)) {
    throw new Error(`Forbidden: Unsafe iCal URL ${normalizedUrl}`);
  }

  const headers: Record<string, string> = {};
  if (etag) {
    headers['If-None-Match'] = etag;
  }

  const response = await fetch(normalizedUrl, { headers });

  if (response.status === 304) {
    return { notModified: true };
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch iCal: ${response.status} ${response.statusText}`);
  }

  const icalText = await response.text();
  const newEtag = response.headers.get('ETag') || undefined;

  return { icalText, newEtag, notModified: false };
}

/**
<<<<<<< ours
=======
 * Parses calendar-level metadata like name and color.
 */
export function parseCalendarMetadata(text: string): { name?: string; color?: string } {
  const jcalData = ICAL.parse(text);
  const vcalendar = new ICAL.Component(jcalData);
  const name = vcalendar.getFirstPropertyValue('x-wr-calname') as string | undefined;
  const color = vcalendar.getFirstPropertyValue('x-apple-calendar-color') as string | undefined;
  return { name, color };
}

/**
>>>>>>> theirs
 * Parses iCal text and returns an array of events within the specified window.
 * Handles recurring events by expanding them into individual occurrences.
 */
export function parseICalText(text: string, windowStart: Date, windowEnd: Date): ParsedCalendarEvent[] {
  const jcalData = ICAL.parse(text);
  const vcalendar = new ICAL.Component(jcalData);
  const vevents = vcalendar.getAllSubcomponents('vevent');
  const events: ParsedCalendarEvent[] = [];

  const iCalWindowStart = ICAL.Time.fromJSDate(windowStart, true);
  const iCalWindowEnd = ICAL.Time.fromJSDate(windowEnd, true);

  vevents.forEach(vevent => {
    const event = new ICAL.Event(vevent);
<<<<<<< ours

    if (event.isRecurring()) {
      const expansion = event.iterator(event.startDate);
=======
    
    if (event.isRecurring()) {
      const expansion = event.iterator(iCalWindowStart);
>>>>>>> theirs
      let next;
      // Protection against infinite loops for malformed RRULEs
      let count = 0;
      while ((next = expansion.next()) && next.compare(iCalWindowEnd) <= 0 && count < 1000) {
        count++;
        if (next.compare(iCalWindowStart) >= 0) {
            const occurrence = event.getOccurrenceDetails(next);
            events.push(mapICALEventToParsedEvent(occurrence.item.component, occurrence.startDate, occurrence.endDate, true, event.uid));
        }
      }
    } else {
      const start = event.startDate;
      if (start.compare(iCalWindowStart) >= 0 && start.compare(iCalWindowEnd) <= 0) {
        events.push(mapICALEventToParsedEvent(vevent, start, event.endDate, false));
      }
    }
  });

  return events;
}

/**
 * Maps an ICAL.js component to our internal ParsedCalendarEvent type.
 * Handles UID generation for recurring occurrences and attachment metadata extraction.
 */
function mapICALEventToParsedEvent(vevent: ICAL.Component, dtstart: ICAL.Time, dtend: ICAL.Time, isOccurrence: boolean, baseUid?: string): ParsedCalendarEvent {
  const event = new ICAL.Event(vevent);
  const uid = baseUid || event.uid;
<<<<<<< ours

  const attachments: CalendarAttachment[] = [];
  const attachProps = vevent.getAllProperties('attach');
  attachProps.forEach(prop => {
    const value = prop.getFirstValue();
    const filenameParam = prop.getParameter('filename');
    const fmttypeParam = prop.getParameter('fmttype');

    const filenameValue = Array.isArray(filenameParam) ? filenameParam[0] : (typeof filenameParam === 'string' ? filenameParam : null);
    const fmttypeValue = Array.isArray(fmttypeParam) ? fmttypeParam[0] : (typeof fmttypeParam === 'string' ? fmttypeParam : undefined);

    const filename = filenameValue || (typeof value === 'string' ? value.split('/').pop() : 'attachment') || 'attachment';
    attachments.push({
      url: typeof value === 'string' ? value : '',
      filename,
      mimeType: fmttypeValue as string | undefined
    });
=======
  
  const attachments: CalendarAttachment[] = [];
  const attachProps = vevent.getAllProperties('attach');
  attachProps.forEach(prop => {
    let value = prop.getFirstValue();
    if (typeof value !== 'string') return;

    // Sometimes ICAL.js might return parameters in the value if it's not fully parsed
    // or if the value is a complex string. We want the actual URL.
    // Example: ATTACH;SIZE=66925;VALUE=URI;X-APPLE-FILENAME=LogoMI.png:https://...
    let url = value;
    if (url.includes(':http')) {
      url = url.substring(url.indexOf(':http') + 1);
    }

    const filenameParam = prop.getParameter('x-apple-filename') || prop.getParameter('filename');
    const fmttypeParam = prop.getParameter('fmttype');
    
    const filenameValue = Array.isArray(filenameParam) ? filenameParam[0] : (typeof filenameParam === 'string' ? filenameParam : null);
    const fmttypeValue = Array.isArray(fmttypeParam) ? fmttypeParam[0] : (typeof fmttypeParam === 'string' ? fmttypeParam : undefined);

    const filename = filenameValue || url.split('/').pop() || 'attachment';
    
    if (isSafeUrl(url)) {
      attachments.push({
        url,
        filename,
        mimeType: fmttypeValue as string | undefined
      });
    }
>>>>>>> theirs
  });

  return {
    uid: isOccurrence ? `${uid}:${dtstart.toJSDate().toISOString()}` : uid,
    summary: event.summary || 'No Title',
    description: event.description || '',
    dtstart: dtstart.toJSDate(),
    dtend: dtend.toJSDate(),
    location: event.location || '',
    url: (vevent.getFirstPropertyValue('url') as string) || '',
    attachments
  };
}
