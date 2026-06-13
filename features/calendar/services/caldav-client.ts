import { createDAVClient } from 'tsdav';
import { CalendarAuthType, DiscoveredCalendar } from '@/types/calendar';
<<<<<<< ours
=======
import { isSafeUrl } from '@/lib/security';
>>>>>>> theirs

/**
 * Discovers available calendars on a CalDAV server.
 */
export async function discoverCalendars(
  serverUrl: string,
  authType: CalendarAuthType,
  credentials: { username?: string; secret: string }
): Promise<DiscoveredCalendar[]> {
  const client = await buildClient(serverUrl, authType, credentials);
  const calendars = await client.fetchCalendars();
  return calendars.map(cal => {
    let name = 'Unnamed Calendar';
    if (typeof cal.displayName === 'string') {
      name = cal.displayName;
    } else if (cal.displayName && typeof cal.displayName === 'object') {
      name = (cal.displayName as any)._text || (cal.displayName as any)._cdata || name;
    }
    return {
      url: cal.url,
      name
    };
  });
}

/**
<<<<<<< ours
=======
 * Normalizes a URL for comparison by removing trailing slashes and ensuring consistent format.
 */
function normalizeUrl(url: string, baseUrl?: string): string {
  try {
    const absoluteUrl = new URL(url, baseUrl).toString();
    return absoluteUrl.endsWith('/') ? absoluteUrl.slice(0, -1) : absoluteUrl;
  } catch {
    let normalized = url.trim();
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }
}

/**
>>>>>>> theirs
 * Fetches iCal data for all events in a specific CalDAV calendar.
 * 
 * @param serverUrl Base URL of the CalDAV server
 * @param calendarUrl Specific URL of the calendar collection
 * @param authType Authentication method (basic or bearer)
 * @param credentials User credentials
 * @param since Optional start date for fetching events
 * @returns Array of iCal strings and the current CTAG
 */
export async function fetchCalendarICalTexts(
  serverUrl: string,
  calendarUrl: string,
  authType: CalendarAuthType,
  credentials: { username?: string; secret: string },
  since?: Date
): Promise<{ texts: string[]; ctag: string }> {
  const client = await buildClient(serverUrl, authType, credentials);
  
  const calendars = await client.fetchCalendars();
<<<<<<< ours
  const calendar = calendars.find(c => 
    c.url === calendarUrl || 
    calendarUrl.endsWith(c.url) || 
    c.url.endsWith(calendarUrl)
  );
=======
  const normalizedTarget = normalizeUrl(calendarUrl, serverUrl);
  
  const calendar = calendars.find(c => {
    const normalizedCal = normalizeUrl(c.url, serverUrl);
    return normalizedCal === normalizedTarget;
  });
>>>>>>> theirs
  
  if (!calendar) {
    throw new Error(`Calendar not found at ${calendarUrl}. Discovered calendars: ${calendars.map(c => c.url).join(', ')}`);
  }

  const objects = await client.fetchCalendarObjects({
    calendar,
    timeRange: since ? {
      start: since.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z',
      end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    } : undefined
  });

  return {
    texts: objects.map(obj => obj.data as string).filter(Boolean),
    ctag: calendar.ctag || ''
  };
}

/**
 * Internal helper to build and configure a tsdav client.
 */
async function buildClient(
  url: string,
  authType: CalendarAuthType,
  credentials: { username?: string; secret: string }
) {
<<<<<<< ours
=======
  if (!isSafeUrl(url)) {
    throw new Error(`Forbidden: Unsafe CalDAV URL ${url}`);
  }

>>>>>>> theirs
  return await createDAVClient({
    serverUrl: url,
    credentials: {
      username: credentials.username,
      password: credentials.secret,
      accessToken: authType === 'bearer' ? credentials.secret : undefined
    },
    authMethod: authType === 'basic' ? 'Basic' : (authType === 'bearer' ? 'Bearer' : undefined),
    defaultAccountType: 'caldav'
  });
}
