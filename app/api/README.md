# API Overview

This folder contains all Next.js Route Handlers that form the server API for the app. The design keeps sensitive logic (e.g., Instagram access tokens) in Postgres stored procedures and uses these routes only as thin, authenticated orchestrators.

Quick links:
- Full backend architecture report: ../..//docs/backend-architecture-report.md
- Env vars reference: ../../.env.example
- Features route map: ./features/README.md

Auth model (high-level):
- Anonymous users: cannot access any route in this folder.
- Authenticated users: can operate on their own data only.
- Admin users: may operate across all users (where appropriate).
- Internal machine-to-machine: some routes accept an optional X-Internal-Secret header for cron/ops.

Endpoints

1) Instagram
- GET /api/features/instagram/callback
  • OAuth redirect handler used by Instagram login/connect flow.
  • Exchanges short-lived token for long-lived token, stores it in Vault via DB function insert_instagram_account, triggers a feed refresh, then redirects to /instagram-success.
  • Auth: must have a logged-in Supabase user session when the flow completes.

- POST /api/features/instagram/refresh
  • Fetches recent media via DB-side proxy and clones media files into the local `instagram-media` Storage bucket; upserts posts/media tables with local URLs.
  • Auth: authenticated; admin → refresh for all users; regular → refresh only their own.
  • Body: none.
  • Response: { ok: true, scope: "all"|"current", result: { inserted, updated, downloaded, download_failed } }

- POST /api/features/instagram/refresh-tokens
  • Rotates long-lived tokens via DB function refresh_instagram_tokens.
  • Auth: authenticated; admin → all; regular → current.
  • Body: none.
  • Response: { ok: true, scope, result: { refreshed, failed } }

- GET /api/features/instagram/accounts
  • List Instagram accounts (self by default; admin can scope=all or filter by userId).

- GET /api/features/instagram/accounts/:id
  • Get single account metadata (owner or admin).

- DELETE /api/features/instagram/accounts/:id
  • Delete account (owner/admin). Attempts to remove related Storage files, then deletes DB rows (cascades to posts/media).

- GET /api/features/instagram/posts
  • List Instagram posts. Non-admins see their own accounts' posts; admins can scope=all or filter by accountId/userId.

- GET /api/features/instagram/posts/:id
  • Get single post (owner or admin).

- DELETE /api/features/instagram/posts/:id
  • Delete a post and associated media files (owner/admin).

2) Users (moved)
- GET /api/users
  • Admin-only list of users (with roles). Supports pagination via limit/offset.

- GET /api/users/:id
  • Get user with role. Admin may fetch any user; non-admins only themselves.

- PATCH /api/users/:id
  • Admin-only. Update profile fields and/or admin role.

- DELETE /api/users/:id
  • Deletes all app data for the target user and records a deletion request. If a user deletes themself, the final auth account removal is deferred until sign-out; when an admin deletes another user, the auth account is removed immediately if service-role credentials are configured.

(Deprecated) The old /api/features/users/* routes should no longer be used.

3) Articles
- GET /api/articles
  • List articles for current user; admin may scope=all or filter by userId.
- POST /api/articles
  • Create a new article for current user.
- GET /api/articles/:id
  • Get article by id (owner/admin).
- PATCH /api/articles/:id
  • Update article (owner/admin).
- DELETE /api/articles/:id
  • Delete article (owner/admin).

(Deprecated) The old /api/features/newspaper/articles* routes should no longer be used.

4) Admin and internal maintenance
- GET /api/admin/users (deprecated)
  • Returns 410 Gone. Use /api/users instead.
- POST /api/admin/process-user-deletions (deprecated)
  • Returns 410 Gone. Use DELETE /api/users/:id.

5) Storage helpers
- POST /api/storage/clone-remote-file
  • Downloads a remote file (image/video), validates size and type, and uploads into a Supabase Storage bucket using service-role credentials.
  • Auth: admin session or X-Internal-Secret header (INTERNAL_ADMIN_SECRET).
  • Body: { url: string, storageBucket: string, storagePath: string }
  • Response: { publicUrl, contentType, size }

Security and sensitive data
- Instagram access tokens never leave the database. All Instagram API calls are proxied by DB-side functions; route handlers receive sanitized JSON responses only.
- The low-level DB function instagram_api_request is internal-only and not callable by regular users; higher-level DB functions enforce ownership and admin-only scopes.

Notes
- This project no longer uses Supabase Edge Functions; everything runs via Next.js API routes and Postgres stored procedures.
- For environment variables, see ../../.env.example.
