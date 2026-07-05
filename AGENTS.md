# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Clean .next and build for production
npm run start    # Start production server
npm run clean    # Remove .next build cache
```

There is no test suite. TypeScript checking is done implicitly through the build.

## Architecture Overview

A Next.js (App Router) newsticker application with two main content streams displayed side-by-side: **articles** (left panel) and **Instagram posts** (right panel). Supabase handles auth, database, and storage.

### Component & Data Flow Pattern

Server components in `app/` and `components/feeds/` fetch data from Supabase directly, then hand it to `"use client"` components for interactivity. Example: `IgFeed.tsx` (server) → `IgFeedClient.tsx` (client). Feature-specific components live under `features/{feature}/components/`, with data access in `features/{feature}/services/`.

### Two Supabase Clients

| Client | File | Used for |
|--------|------|----------|
| Cookie-aware (anon key) | `lib/supabase/server.ts` | Server components, route handlers (user-scoped RLS) |
| Service role (admin) | Created inline via `createSupabaseServerClient` | Admin operations that bypass RLS |

### API Route Auth Pattern

`lib/api/auth.ts` provides two shared helpers used by route handlers:
- `requireAuth()` — returns `{ supabase, userId, isAdmin }` or throws `"Unauthorized"`
- `allowInternalOrAdmin(request)` — accepts either an `X-Internal-Secret` header (for cron/ops) or an authenticated admin session

### Instagram Token Security

Instagram access tokens are **never exposed to the application layer**. They live in Supabase Vault. All Instagram API calls are proxied through the Postgres RPC `instagram_api_request`, which reads the token from Vault server-side and returns only sanitized JSON.

The refresh flow (`POST /api/features/instagram/refresh`):
1. Fetches posts via `instagram_api_request` RPC
2. Downloads media files with retry/backoff
3. Uploads to `instagram-media` Supabase Storage bucket
4. Upserts rows to `instagram_posts` and `instagram_post_media` with local CDN URLs
5. Deletes DB rows + storage files for posts removed from Instagram

Storage path format: `{account_id}/{post_id}-{index}-{media|thumb}.{ext}`

A pg_cron job triggers this endpoint on a schedule configured via Supabase Vault secrets (`CRON_APP_BASE_URL`, `INTERNAL_ADMIN_SECRET`).

### Database Schema (Core Tables)

```
instagram_accounts  (id: Instagram account ID, user_id → auth.users)
  └── instagram_posts  (id: Instagram post ID, user_id → instagram_accounts.id)
        └── instagram_post_media  (post_id, index — composite PK)
articles  (id UUID, user_id → auth.users)
```

Deletes cascade. Account deletion also triggers a Postgres trigger (`cleanup_instagram_account_storage`) that removes all Storage files before the cascade fires.

Admin status is determined via the `check_is_admin()` Postgres RPC.

### Rich Text Editor

Articles use **Tiptap** as the editor. Editor setup is in `hooks/use-tiptap-editor.ts` and `lib/tiptap-utils.ts`. Articles store both `content` (HTML string), `json_content` (Tiptap JSON), and `html_content`.

## Environment Variables

See `.env.example`. Key variables:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — required everywhere
- `SUPABASE_SERVICE_ROLE_KEY` — required for admin API routes and Instagram refresh
- `INSTAGRAM_CLIENT_ID` / `INSTAGRAM_CLIENT_SECRET` — Facebook app credentials for OAuth
- `INTERNAL_ADMIN_SECRET` — shared secret for cron-to-API authentication
- `NEXT_PUBLIC_REFRESH_EVERY_MINUTES` — client-side polling interval for feed auto-refresh

## Deprecated Routes

`/api/features/users/*` and `/api/features/newspaper/articles*` are deprecated. Use `/api/users/*` and `/api/articles/*` respectively.
