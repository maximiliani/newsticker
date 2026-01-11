# Features API Directory

This directory groups feature-oriented API endpoints used by the application. Routes here are thin orchestrators that validate the caller, call Postgres stored procedures where appropriate, and return sanitized results.

Groups

- instagram
  - GET /api/features/instagram/callback
  - POST /api/features/instagram/refresh
  - POST /api/features/instagram/refresh-tokens
  - GET /api/features/instagram/accounts
  - GET /api/features/instagram/accounts/:id
  - DELETE /api/features/instagram/accounts/:id
  - GET /api/features/instagram/posts
  - GET /api/features/instagram/posts/:id
  - DELETE /api/features/instagram/posts/:id

- users (moved)
  - Users API has moved to /api/users and /api/users/:id

- newspaper (articles) (deprecated)
  - Articles API has moved to /api/articles and /api/articles/:id

Auth principles

- Authenticated users can operate on their own resources only.
- Admins can operate across all users where explicitly allowed.
- Sensitive Instagram tokens never leave the database; IG calls are handled via SECURITY DEFINER stored procedures that sanitize responses.

Deprecated routes (moved/removed)

- /api/instagram/* → use /api/features/instagram/*
- /api/user/delete → use DELETE /api/features/users/:id
- /api/admin/users → use /api/features/users
- /api/admin/process-user-deletions → removed; now returns 410 Gone
