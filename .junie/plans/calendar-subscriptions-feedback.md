---
sessionId: session-260613-215659-ohza
---

# Requirements

### Overview & Goals
The current calendar integration requires a few UX improvements and fixes based on user feedback. The goal of this plan is to improve the subscription creation process, clean up event rendering (attachments, locations, links, dates), add an interactive calendar for filtering articles, and allow admins to manage all subscriptions.

### Scope
- **In Scope:**
  - Removing the Calendar link from the header.
  - Adding a Shadcn calendar to the home page layout with week numbers and range selection.
  - Filtering articles based on the selected date range.
  - Adding a "Sneak Peek" view for upcoming events next to the calendar.
  - Parsing and rendering OpenStreetMap links, actual URLs, and proper dates in calendar articles.
  - Fixing iCal attachment parser to support standard parameters (`SIZE`, `VALUE=URI`, `X-APPLE-FILENAME`).
  - Auto-filling the subscription name and color from the iCal feed properties (`X-WR-CALNAME`, `X-APPLE-CALENDAR-COLOR`) and syncing immediately on addition.
  - Adding admin privileges to view and delete any calendar subscription.

- **Out of Scope:**
  - Embedding interactive maps (iframes) for OpenStreetMap due to the lack of coordinates in iCal standard locations (we will use a standard external search link instead).
  - Showing calendar credentials to admins (passwords/tokens will remain hidden).

# Technical Design

### Key Decisions
- **Calendar Layout:** We will convert the existing left `ResizablePanel` in `app/page.tsx` into a vertical `ResizablePanelGroup`. `ArticleFeed` will be placed in the upper portion, and the Shadcn Calendar will be in the lower left corner. The remaining space in the lower corner will be populated with a `SneakPeek` list of upcoming events.
- **Filtering Mechanism:** The `CalendarFilter` component will be a client component that modifies the URL search parameters (`?from=...&to=...`). `app/page.tsx` will accept these parameters and pass them to the `ArticleFeed` Server Component to perform database-level filtering.
- **Location Rendering:** Since iCal locations are usually plain text addresses and geocoding on the fly is unreliable, we will render a direct OpenStreetMap search link inside the article's rich text (e.g. `https://www.openstreetmap.org/search?query=Location`).
- **Attachment Parsing:** The `ATTACH` string can contain parameters (e.g., `ATTACH;SIZE=...:https://...`). We will update `ical-parser.ts` to strip out standard iCal parameter syntax and extract only the underlying HTTPS URL and filename for Supabase Storage logic.
- **Immediate Syncing:** We will `await` the first sync directly in the POST route instead of throwing it to the background. This ensures the user instantly sees their synced articles when the modal closes.

### File Structure & Affected Files
- `components/globalHeader.tsx` (Modified: Remove Calendar link)
- `features/calendar/components/add-subscription-dialog.tsx` (Modified: Remove bloated name/color fields)
- `app/api/features/calendar/subscriptions/route.ts` (Modified: Auto-extract iCal metadata, `await` initial sync, support Admin GET)
- `app/api/features/calendar/subscriptions/[id]/route.ts` (Modified: Support Admin DELETE)
- `features/calendar/services/ical-parser.ts` (Modified: Fix `ATTACH` parameter handling)
- `features/calendar/services/calendar-sync-service.ts` (Modified: Inject dates, actual URLs, and OpenStreetMap links into article JSON/HTML)
- `features/calendar/components/subscription-manager.tsx` (Modified: Show owner details for admins)
- `app/page.tsx` (Modified: Add vertical and horizontal splitters for new components)
- `components/feeds/ArticleFeed.tsx` (Modified: Accept range parameters for filtering)
- `components/ui/calendar.tsx` (New: Installed via Shadcn)
- `components/CalendarFilter.tsx` (New: Interacts with URL)
- `components/SneakPeek.tsx` (New: Upcoming events list)

# Delivery Steps

### ✓ Step 1: clean-header-and-subscription-flow
- Remove the `/calendar` link from `components/globalHeader.tsx`.
- Update `app/api/features/calendar/subscriptions/route.ts` to fetch the iCal feed before insertion. Extract `X-WR-CALNAME` and `X-APPLE-CALENDAR-COLOR` and use them as the default name/color for the subscription.
- Change the background async `syncSubscription` call in `route.ts` to `await syncSubscription(...)` so the user is guaranteed to have synced articles immediately upon successful addition.
- Update `features/calendar/components/add-subscription-dialog.tsx` to remove the `name` and `color` fields, making the UI simpler.

### ✓ Step 2: improve-event-content-parsing
- Update `features/calendar/services/ical-parser.ts` to properly parse `ATTACH` properties that contain parameters like `SIZE` or `VALUE=URI`. Extract the core URL (after `:http`) and `X-APPLE-FILENAME` using string manipulation or regex.
- Update `features/calendar/services/calendar-sync-service.ts` to append the formatted event date to the generated article description.
- Modify the article content generation in `calendar-sync-service.ts` to render the raw event URL string instead of the hardcoded text "Event Link".
- Add logic in `calendar-sync-service.ts` to generate an external OpenStreetMap URL link (e.g. `https://www.openstreetmap.org/search?query=...`) when `event.location` is present, injecting it as a bold link in the generated Tiptap JSON and HTML content.

### ✓ Step 3: add-admin-calendar-management
- Update the `GET` handler in `app/api/features/calendar/subscriptions/route.ts` to check if `isAdmin` is true. If it is, bypass the `.eq('user_id', userId)` filter and return all subscriptions.
- Include a user identifier (e.g., `user_id` or an email lookup) in the returned data for admins so they know who owns the subscription.
- Update `subscription-manager.tsx` to display the owner's information if the current user is an admin.
- Update the `DELETE` handler in `app/api/features/calendar/subscriptions/[id]/route.ts` to allow deletion if the requesting user is either the owner or an admin.

### ✓ Step 4: integrate-calendar-filtering-and-layout
- Run `npx shadcn-ui@latest add calendar` to install the `Calendar` component.
- Create a `CalendarFilter` client component that wraps the Shadcn Calendar, configured with `mode="range"` and `showWeekNumber`. It will update the URL search parameters (`?from=...&to=...`) when the user selects a date range.
- Create a `SneakPeek` component to display a compact list of events happening in the next 7 days.
- Update `app/page.tsx` layout. Replace the left `ResizablePanel` with a vertical `ResizablePanelGroup`. The top half will contain `ArticleFeed`, and the bottom half will hold a horizontal `ResizablePanelGroup` with `CalendarFilter` on the left and `SneakPeek` on the right.
- Update `ArticleFeed` to accept `from` and `to` search parameters and pass them down to `getVisibleArticles()`, adding additional Supabase filters to restrict `visibility_from` and `visibility_to` against the selected date range.