/** Helpers to display and edit an article's event datetime in the global timezone. */

function parts(date: Date, timeZone: string) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(date)) p[x.type] = x.value;
  return p;
}

/** Formats an ISO instant as a `datetime-local` value (yyyy-MM-ddTHH:mm) in the given timezone. */
export function isoToZonedLocal(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = parts(d, timeZone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** Calendar date of an event as displayed in the configured timezone. */
export function eventDateKey(date: Date, timeZone: string, allDay = false): string {
  return allDay ? date.toISOString().slice(0, 10) : isoToZonedLocal(date.toISOString(), timeZone).slice(0, 10);
}

/** Interprets a `datetime-local` value as wall-clock time in the given timezone and returns an ISO instant. */
export function zonedLocalToIso(local: string | null | undefined, timeZone: string): string | null {
  if (!local) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return null;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let ts = wall;
  // Two passes resolve offsets around DST transitions.
  for (let i = 0; i < 2; i++) {
    const p = parts(new Date(ts), timeZone);
    const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    ts += wall - asUtc;
  }
  return new Date(ts).toISOString();
}

/** Human readable event datetime; all-day events show the date only (stored as UTC midnight). */
export function formatEventDatetime(
  iso: string | Date,
  timeZone: string,
  locale?: string,
  allDay = false,
): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  try {
    return allDay
      ? new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: 'UTC' }).format(d)
      : new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeStyle: 'short', timeZone }).format(d);
  } catch {
    return d.toISOString();
  }
}

/** Day, short month and time of an event for the date highlight; time is null for all-day events. */
export function getEventDateParts(
  iso: string | Date,
  timeZone: string,
  locale?: string,
  allDay = false,
): { day: string; month: string; time: string | null } {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const tz = allDay ? 'UTC' : timeZone;
  try {
    return {
      day: new Intl.DateTimeFormat(locale, { day: '2-digit', timeZone: tz }).format(d),
      month: new Intl.DateTimeFormat(locale, { month: 'short', timeZone: tz }).format(d),
      time: allDay
        ? null
        : new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz }).format(d),
    };
  } catch {
    return { day: '', month: '', time: null };
  }
}
