# Backend Architecture Report

This report documents the current backend design after migrating away from Supabase Edge Functions to a combination of Next.js API routes and Postgres stored procedures. It also explains the security model, authorization, and how sensitive Instagram tokens are handled.

Last updated: 2025-09-30

## Executive summary
- All functionality previously implemented as Supabase Edge Functions has been migrated to:
  - Next.js API routes under `app/api/*` for request handling, authentication, and orchestration.
  - Postgres stored procedures for sensitive operations (OAuth token storage, Instagram API proxying, token rotation, and feed fetching).
- Instagram access tokens never leave the database. Tokens are stored in Vault (`vault.secrets`) and accessed only inside `SECURITY DEFINER` functions. API responses are sanitized to prevent token leakage.
- Admin capabilities remain available via server-side checks and DB functions; routes that require machine-to-machine access also accept a shared secret header.

## API surface (Next.js routes)
See the concise map in `app/api/README.md`. Summary:

- Instagram
  - `GET /api/features/instagram/callback` — OAuth callback; stores token via `insert_instagram_account`, refreshes feeds, redirects to UI.
  - `POST /api/features/instagram/refresh` — Calls `fetch_instagram_posts_and_store`. Admin = all; user = self.
  - `POST /api/features/instagram/refresh-tokens` — Calls `refresh_instagram_tokens`. Admin = all; user = self.

- Users
  - `DELETE /api/features/users/:id` — Deletes user data and records a deletion request; admins may immediately remove auth accounts if service-role is configured; self-deletion completes after sign-out.

- Admin & internal maintenance
  - `POST /api/admin/process-user-deletions` — Deprecated and removed; the route now returns 410 Gone. Use the users deletion endpoint above for individual deletions.

- Storage helpers
  - `POST /api/storage/clone-remote-file` — Validates and uploads a remote file to Supabase Storage (service-role); admin or shared-secret only.

## Database stored procedures (key functions)

- `insert_instagram_account(p_id, p_user_id, p_username, p_profile_image_url, p_access_token, p_timestamp) RETURNS instagram_accounts`
  - SECURITY DEFINER, stores `p_access_token` in Vault and inserts account metadata.
  - Input validation: username and profile image URL formats.
  - On error, cleans up partially created Vault secret.

- `instagram_api_request(p_route TEXT, p_params JSONB, p_account_id BIGINT, p_user_id UUID) RETURNS JSONB`
  - SECURITY DEFINER, proxies Instagram Graph API calls using a token from Vault.
  - Sanitizes headers/body to remove `access_token`, `token`, and `authorization` fields.
  - Intended for internal use by other DB functions; not exposed to PUBLIC.

- `fetch_instagram_posts_and_store(p_scope TEXT DEFAULT 'current') RETURNS JSONB`
  - SECURITY DEFINER, fetches recent media for accounts and stores normalized rows in `instagram_posts` and `instagram_post_media`.
  - Scope rules: admin can pass `all`; regular users operate on their own accounts (`current`).
  - Returns counts of inserted/updated/errors.

- `refresh_instagram_tokens(p_scope TEXT DEFAULT 'all') RETURNS JSONB`
  - SECURITY DEFINER, calls IG refresh endpoint and updates Vault secrets.
  - Scope rules as above; returns `{ refreshed, failed }` counters.

- `get_decrypted_instagram_tokens(p_limit, p_offset) RETURNS TABLE (...)`
  - SECURITY DEFINER; restricted to `service_role` only. Used for internal maintenance if needed.

- `public.upsert_vault_secret(name, value, description, key_id)`
  - SECURITY DEFINER; restricted to `service_role`. Utility for rotating/seeding Vault values.

- `check_is_admin() RETURNS BOOLEAN`
  - SECURITY DEFINER; used by routes to make admin decisions without exposing roles client-side.

- `get_all_users() RETURNS JSONB`
  - SECURITY DEFINER; writes a row into `admin_functions` and returns the result for admins (via RLS).

## Security and authorization

- RLS and function grants
  - Sensitive functions are `SECURITY DEFINER` and have explicit `REVOKE`/`GRANT` statements.
  - `instagram_api_request` is not executable by PUBLIC; accessible by `authenticated` and `service_role` so higher-level functions and admin operations can call it, but user access is mediated by the calling function’s checks and ownership.
  - Token decryption is limited to `service_role` via Vault views.

- Token handling
  - Access tokens are stored in `vault.secrets` and referenced from `instagram_accounts.access_token_secret_id`.
  - Tokens are never returned by API routes or DB functions that end up in client responses.
  - All IG HTTP responses are sanitized before returning from DB.

- Admin and internal operations
  - Admin checks are made server-side via `check_is_admin()`.
  - Signed machine calls can use `X-Internal-Secret: ${INTERNAL_ADMIN_SECRET}` for privileged maintenance endpoints (optional but recommended).

## Cron and background work

- The legacy pg_cron job that POSTed to an Edge Function has been replaced by a direct schedule of the DB function:
  - `cron.schedule('*/30 * * * *', $$SELECT fetch_instagram_posts_and_store('all');$$)`
  - Old job is unscheduled if found.

- Deletion processing can be run on demand via `POST /api/admin/process-user-deletions`, optionally with the internal shared secret.

## Environment variables (selected)
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Instagram OAuth: `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET`, `INSTAGRAM_REDIRECT_URI`
- Internal: `INTERNAL_ADMIN_SECRET`

See `.env.example` for the complete list and example values.

## RESTfulness and public surface

- Most operations are exposed through clear RESTful routes under `/api/*`. We retained `DELETE /api/user/delete` for compatibility; it accepts an `id` query or JSON body `userId`. Admins can delete arbitrary users; regular users can delete only themselves.
- Low-level IG proxying remains in the database to prevent token leakage and to centralize sanitization and ownership checks.

## Future improvements (non-breaking)
- Add a formal `/api/users/:id` route wrapper if desired for pure REST semantics and to reduce semantic overlap with `/api/user/delete`. (Current endpoint remains functional and documented.)
- Centralize server-only Supabase helpers to avoid accidental client leakage.
- Add integration tests around admin-only routes and token refresh flows.

## Appendix: key SQL files
- `supabase/migrations/20250531040000_vault_functions.sql`
- `supabase/migrations/202505312242000_InstagramMediaStorageSchema.sql`
- `supabase/migrations/20250930211000_instagram_api_procedures.sql`
- `supabase/migrations/20250930211500_update_cron_to_db_function.sql`
- `supabase/migrations/20250930211800_refresh_instagram_tokens.sql`
- `supabase/migrations/20250601113010_create_users_with_roles_view.sql`
- `supabase/migrations/20250601114520_create_admin_functions_table.sql`
