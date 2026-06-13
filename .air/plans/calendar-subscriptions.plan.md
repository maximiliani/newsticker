# Calendar Subscriptions & Calendar View

## Context

The newsticker app shows time-scoped news articles. Users want to subscribe to external calendars (iCal/CalDAV format: iCloud, Google, Outlook) so that calendar events become news articles in the feed, appearing within a configurable window around each event. A calendar view is also needed to browse articles by date.

This extends the existing visibility-window article system. Key scope:
- Authenticated CalDAV (iCloud Basic Auth, Outlook, generic Bearer) + public iCal URLs
- Attachments downloaded from `ATTACH` properties and stored in Supabase Storage (`calendar-attachments` bucket)
- Author display: `"<calendar_name> by <user_name>"` for unmodified events; `"<user_name>"` after modification
- All users can add calendar subscriptions

**Google CalDAV note:** Google requires OAuth2 for CalDAV (demands registered OAuth app, redirect flow, token refresh — out of scope). Google users should use the "Secret address in iCal format" from Google Calendar settings as a public subscription URL.

---

## Approach

1. **Two new DB tables** (`calendar_subscriptions`, `calendar_events`); one new column on `articles` (`custom_author_name`); one new Storage bucket (`calendar-attachments`).
2. **`tsdav`** handles authenticated CalDAV (PROPFIND discovery, REPORT event fetch, ctag/etag change detection).
3. **`ical.js`** parses iCal data (from tsdav responses and direct URL fetches), expands recurring events.
4. **Credentials** stored in Supabase Vault (same pattern as Instagram tokens), never exposed to browser.
5. **Multi-step add-subscription dialog**: enter credentials → discover & select calendar → configure visibility span.
6. **Attachment download** reuses `lib/storage/stream.ts` helpers; stored in `calendar-attachments/{userId}/{subscriptionId}/{eventUid}/{filename}`.
7. **Author override**: `custom_author_name` on `articles`; `articles_with_author_info` view uses `COALESCE(a.custom_author_name, u.raw_user_meta_data ->> 'full_name')`.

---

## New Dependencies

```
tsdav    — CalDAV/WebDAV client (TypeScript-native, actively maintained, Node.js + edge)
ical.js  — Mozilla's iCal parser with RRULE recurring event expansion
```

---

## File Changes

### Database Migrations (Create)

**`supabase/migrations/20260613000000_calendar_subscriptions.sql`**

```sql
CREATE TYPE calendar_auth_type AS ENUM ('public', 'basic', 'bearer');

CREATE TABLE calendar_subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  ical_url              TEXT,               -- public iCal URL (null for CalDAV)
  auth_type             calendar_auth_type NOT NULL DEFAULT 'public',
  caldav_server_url     TEXT,               -- e.g. https://caldav.icloud.com/
  caldav_calendar_url   TEXT,               -- discovered calendar collection URL
  vault_secret_id       UUID,               -- Vault ID for {username, secret}
  color                 TEXT NOT NULL DEFAULT '#3B82F6',
  visibility_days_before INT NOT NULL DEFAULT 14,
  visibility_days_after  INT NOT NULL DEFAULT 14,
  last_synced_at        TIMESTAMPTZ,
  ctag                  TEXT,               -- CalDAV ctag (skip if unchanged)
  etag                  TEXT,               -- HTTP ETag (skip if unchanged)
  active                BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
RLS: owner CRUD, service_role full
```

**`supabase/migrations/20260613000001_calendar_events.sql`**

```sql
CREATE TABLE calendar_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  UUID NOT NULL REFERENCES calendar_subscriptions(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_uid        TEXT NOT NULL,         -- iCal UID (recurring: uid + ':' + dtstart_utc)
  article_id       UUID REFERENCES articles(id) ON DELETE SET NULL,
  event_start      TIMESTAMPTZ NOT NULL,
  locally_modified BOOLEAN NOT NULL DEFAULT false,
  source_hash      TEXT,                  -- SHA-256 of key event fields; skip if unchanged
  last_synced_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(subscription_id, event_uid)
);
RLS: owner SELECT, service_role full
```

**`supabase/migrations/20260613000002_article_custom_author.sql`**

```sql
ALTER TABLE articles ADD COLUMN IF NOT EXISTS custom_author_name TEXT DEFAULT NULL;

CREATE OR REPLACE VIEW public.articles_with_author_info AS
SELECT
  a.*,
  COALESCE(a.custom_author_name, u.raw_user_meta_data ->> 'full_name') AS author_name,
  (u.raw_user_meta_data ->> 'avatar_url')::text AS author_avatar
FROM public.articles a
LEFT JOIN auth.users u ON a.user_id = u.id;
```

**`supabase/migrations/20260613000003_calendar_attachments_bucket.sql`**

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('calendar-attachments', 'calendar-attachments', true, 52428800,
  ARRAY['image/jpeg','image/png','image/gif','image/webp',
        'video/mp4','video/quicktime',
        'application/pdf','text/plain','application/zip'])
ON CONFLICT (id) DO NOTHING;
-- Policies: public read, authenticated owner upload, service_role full
```

### TypeScript Types (Create)

**`types/calendar.ts`** — `CalendarSubscription`, `CalendarEvent`, `ParsedCalendarEvent`, `CalendarAttachment`, `CreatePublicSubscriptionData`, `CreateCalDAVSubscriptionData`, `DiscoveredCalendar`, `SyncResult`

### Calendar Services (Create)

**`features/calendar/services/ical-parser.ts`**
- `normalizeUrl(url)` — `webcal://` → `https://`
- `fetchPublicICal(url, etag?)` — fetch with `If-None-Match`; returns `{icalText, newEtag, notModified}`
- `parseICalText(text, windowStart, windowEnd): ParsedCalendarEvent[]` — uses `ical.js`:
  - Expands RRULE recurring events via `ICAL.RecurExpansion` within `[windowStart, windowEnd]`
  - Recurring occurrences: UID suffixed with `:${dtstart.toISOString()}`
  - Extracts: `uid`, `summary`, `description`, `dtstart`, `dtend`, `location`, `url`, `attachments[]`

**`features/calendar/services/caldav-client.ts`**
- `discoverCalendars(serverUrl, authType, credentials): Promise<DiscoveredCalendar[]>` — `tsdav.createDAVClient` + PROPFIND discovery
- `fetchCalendarICalTexts(calendarUrl, authType, credentials, since?): Promise<{texts: string[], ctag: string}>` — REPORT calendar-query with time-range; returns raw iCal strings per event
- `buildClient(serverUrl, authType, credentials): DAVClient` — internal tsdav factory

**`features/calendar/services/credential-service.ts`**
- `storeCredentials(admin, subscriptionId, username, secret): Promise<UUID>` — `vault.create_secret` RPC
- `readCredentials(admin, vaultId): Promise<{username, secret}>` — `vault.decrypted_secrets` via service-role
- `deleteCredentials(admin, vaultId)` — `vault.delete_secret` RPC

**`features/calendar/services/attachment-service.ts`**
- `downloadAndStoreAttachments(attachments, subscriptionId, eventUid, userId, admin): Promise<string[]>`
  - URL attachments: `streamDownloadToBuffer` from `lib/storage/stream.ts`
  - Inline base64: decode buffer
  - Upload to `calendar-attachments/{userId}/{subscriptionId}/{eventUid}/{filename}`
  - Returns public URLs; skips on error (logs warning, does not fail sync)

**`features/calendar/services/calendar-sync-service.ts`** — core sync:
- `syncSubscription(subscriptionId, admin): Promise<SyncResult>`:
  1. Load subscription
  2. Public: fetch iCal URL with ETag (skip if not modified)
  3. CalDAV: read Vault credentials → check ctag → fetch via caldav-client if changed
  4. Parse iCal with expansion window `[now − 30 days, now + 90 days]`
  5. For each event: compute SHA-256 `source_hash`; create or update article unless `locally_modified`
  6. DB events absent from feed: delete article if `!locally_modified`, else orphan (article kept, event record cleared)
  7. Update `last_synced_at`, `ctag`, `etag`
- `generateArticleContent(event, subscription, userName, attachmentUrls)`:
  - `custom_author_name`: `"${subscription.name} by ${userName}"`
  - HTML: date/time, location, description, URL link, attachment list
  - `visibility_from`: `dtstart − visibility_days_before days`
  - `visibility_to`: `dtstart + visibility_days_after days`
- `syncAllForUser(userId, admin)` / `syncAllSubscriptions(admin)` — batch variants

**`features/calendar/services/article-link-service.ts`**
- `markLocallyModified(articleId, userDisplayName, admin)` — sets `calendar_events.locally_modified = true` AND `articles.custom_author_name = userDisplayName`

### API Routes (Create)

**`app/api/features/calendar/discover/route.ts`** — `POST`  
Body: `{serverUrl, authType, username, secret}` → calls `discoverCalendars()` → returns `DiscoveredCalendar[]`. Credentials NOT stored. Auth: `requireAuth()`.

**`app/api/features/calendar/subscriptions/route.ts`** — `GET` / `POST`  
GET: returns subscriptions (omits `vault_secret_id`). POST: creates subscription, stores credentials in Vault for CalDAV, triggers first sync. Auth: `requireAuth()`.

**`app/api/features/calendar/subscriptions/[id]/route.ts`** — `DELETE`  
Deletes subscription → cascades to calendar_events → calls `deleteCredentials()` → removes attachment files from storage. Auth: owner check.

**`app/api/features/calendar/subscriptions/[id]/sync/route.ts`** — `POST`  
Sync one subscription. Auth: owner or `allowInternalOrAdmin()`.

**`app/api/features/calendar/sync/route.ts`** — `POST`  
Sync all subscriptions (cron-ready). Auth: `allowInternalOrAdmin()`.

### Article PATCH Hook (Modify)

**`app/api/features/articles/[id]/route.ts`** — `PATCH` handler: after updating article, call `markLocallyModified(articleId, userDisplayName, admin)` if a linked `calendar_events` row exists.

### Settings UI (Create)

**`app/settings/calendar/page.tsx`** — Server component.

**`features/calendar/components/subscription-manager.tsx`** — Lists subscriptions with color dot, name, type badge (Public/CalDAV), last synced. Buttons: Sync Now, Delete.

**`features/calendar/components/add-subscription-dialog.tsx`** — Multi-step dialog:
- Step 1: Choose "Public iCal URL" or "CalDAV Account"
- Public path: URL + name + color + visibility days → submit
- CalDAV path: provider shortcut buttons (iCloud fills `caldav.icloud.com`, Outlook fills `outlook.office365.com`) + auth type + username + password → "Discover Calendars" (POST /discover)
- Step 2 (CalDAV): select from discovered calendar list → set name, color, visibility days → submit

### Calendar View (Create)

**`app/calendar/page.tsx`** — Server component; fetches all articles from `articles_with_author_info`.

**`features/calendar/components/calendar-view-client.tsx`** — `react-day-picker` month navigation; `modifiers` marking days with relevant articles (`visibility_from ≤ day ≤ visibility_to`); click day → side panel with article list.

### Navigation (Modify)

**`app/settings/layout.tsx`** — Fix "User Management" to `UsersIcon`; add `{ title: "Calendar Subscriptions", url: "/settings/calendar", icon: CalendarIcon }`.

**Global header** — Add "Calendar" link → `/calendar`.

---

## Author Display Summary

| Scenario | `articles.custom_author_name` | Shown as |
|---|---|---|
| Sync creates article | `"Work Calendar by Max"` | `"Work Calendar by Max"` |
| User edits article | `"Max"` | `"Max"` |
| Manual article (no calendar) | `NULL` | From `auth.users` metadata |

`articles_with_author_info` view: `COALESCE(a.custom_author_name, u.raw_user_meta_data ->> 'full_name')`. No changes to `NewsPreview` or the article page.

---

## Acceptance Criteria

1. Public `webcal://` subscription → articles created → appear in main feed within ±14-day window.
2. iCloud CalDAV subscription (app-specific password) → calendars discovered → synced successfully.
3. CalDAV credentials are not present in any GET response or client-side code.
4. Event attachments (within allowed MIME types, ≤50 MB) are stored in `calendar-attachments`; article HTML links to public Supabase URLs.
5. Unmodified calendar articles show `"<CalendarName> by <UserName>"` as author.
6. Editing a calendar article changes author to `"<UserName>"`; next sync does not overwrite content.
7. Remotely deleted event → unmodified article removed on next sync; locally-modified article kept.
8. Recurring events produce one article per occurrence within the `[now − 30d, now + 90d]` window.
9. `/calendar` page: month grid shows dots on days with relevant articles; clicking a day lists those articles.
10. `npm run build` passes with no TypeScript errors.
11. Provided iCloud example URL syncs successfully in local Supabase with ≥1 article created.

---

## Verification Steps

```bash
supabase db push        # apply 4 new migrations

npm run dev             # start dev server

# Test public subscription: add webcal://p124-caldav.icloud.com/... at /settings/calendar
# Test CalDAV: add iCloud with Apple ID + app-specific password → discover → select calendar
# Navigate / → articles in feed
# Navigate /calendar → dots on event dates, click day
# Edit a calendar article → sync → content unchanged, author updated
# npm run build         # TypeScript check
```

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `tsdav`/`ical.js` ESM/CJS conflict | Add to `next.config.js` `transpilePackages` |
| iCloud partition discovery (numbered server) | Use tsdav PROPFIND discovery; don't hardcode partition |
| Exchange Online deprecating Basic Auth | Implement Bearer path; document OAuth2 needed for modern Outlook |
| Large calendars slowing sync | RRULE expansion scoped to ±90 days; CalDAV time-range filter; 30s timeout |
| Attachment download fails | Log warning, skip that attachment, continue sync |
| Vault not enabled in local Supabase | Verify `[vault]` section in `supabase/config.toml` |
| Auto-sync scheduling | Wire to pg_cron in follow-up migration (same pattern as Instagram refresh) |
