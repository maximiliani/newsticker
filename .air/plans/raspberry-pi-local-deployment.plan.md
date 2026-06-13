# Local Deployment on Raspberry Pi with Docker, Supabase, and Anthias

## Context

The newsticker app currently runs against a hosted Supabase instance and is designed for Vercel deployment. The goal is to make it fully self-contained: a single Raspberry Pi 4/5 running the Next.js app, a local Supabase stack, and Anthias (Screenly OSE successor) as a kiosk display manager — all orchestrated via Docker Compose with a one-command install script.

The app also needs a new **Device Settings** admin page for controlling the Pi (hostname, IP, reboot, shutdown) and a link to the Anthias web UI.

## Approach

Three deployment layers: (1) a primary `docker-compose.yml` for Supabase services + the Next.js app, (2) Anthias installed via its own Docker setup configured to point at the newsticker, and (3) a lightweight Python systemd service on the host ("host-agent") that the Next.js app calls via HTTP for system control (hostname, reboot, shutdown). The install script detects whether Docker is present, installs it if not, generates all secrets/JWTs, stands up the stack, runs migrations, configures Anthias, and installs the host-agent.

**Why this approach:**
- Supabase self-hosted (trimmed) is the only way to get Vault, pg_cron, pg_net, and auth locally
- Anthias as a separate Docker stack avoids coupling and allows independent updates
- A sidecar host-agent (vs. privileged container) is safer and more maintainable for system control
- `NEXT_PUBLIC_KIOSK_MODE` env var lets the app conditionally show device controls without code paths affecting cloud deployments

**Estimated Pi resource usage:** ~1.5-2 GB RAM (Supabase ~800 MB, Next.js ~200 MB, Anthias ~300 MB, host-agent ~20 MB). 4 GB Pi workable; 8 GB recommended.

---

## File Changes

### New Files (Infrastructure)

| File | Purpose |
|------|---------|
| `deploy/docker-compose.yml` | Supabase services (db, kong, auth, rest, realtime, storage, imgproxy) + Next.js app |
| `deploy/Dockerfile` | Multi-stage Next.js build for ARM64 (deps → build → standalone runtime) |
| `deploy/.env.example` | Deployment env template with all Supabase self-hosted vars |
| `deploy/volumes/db/init/00-init.sql` | Postgres init: extensions, roles, schemas |
| `deploy/host-agent/host-agent.py` | Python HTTP service for system control (hostname, IP, reboot, shutdown) |
| `deploy/host-agent/host-agent.service` | Systemd unit file for the host-agent |
| `deploy/install.sh` | One-command Raspberry Pi install script |
| `deploy/kong.yml` | Kong declarative config routing Supabase services |

### New Files (App Features)

| File | Purpose |
|------|---------|
| `features/device/components/device-settings.tsx` | Client component: hostname editor, IP display, system info, power controls |
| `features/device/services/device-service.ts` | Client-side service calling `/api/device/*` routes |
| `app/settings/device/page.tsx` | Device settings page (admin-only server component) |
| `app/api/device/route.ts` | API route proxying GET/PUT to host-agent (hostname, IP, system-info) |
| `app/api/device/[action]/route.ts` | API route for POST reboot/shutdown |

### Modified Files

| File | Change |
|------|--------|
| `next.config.js` | Add `output: 'standalone'`, local Supabase image hostnames to remote patterns |
| `app/settings/layout.tsx` | Add Device and Display Manager sidebar items (conditional on `NEXT_PUBLIC_KIOSK_MODE`) |
| `features/admin/components/admin-dashboard-cards.tsx` | Add Device Management card (conditional on kiosk mode) |
| `.env.example` | Add `NEXT_PUBLIC_KIOSK_MODE`, `HOST_AGENT_URL`, `HOST_AGENT_SECRET` vars |

---

## Implementation Steps

### Task 1: Docker Infrastructure

**1.1 — `deploy/Dockerfile`** — Multi-stage: `node:22-alpine` base, `npm ci` deps, `npm run build` with standalone output, minimal runtime image (~200 MB).

**1.2 — `deploy/docker-compose.yml`** — Trimmed Supabase stack (no Studio, no Edge Functions, no Logflare): `db` (supabase/postgres), `kong`, `auth` (GoTrue), `rest` (PostgREST), `realtime`, `storage`, `imgproxy`, `app`. Shared bridge network. DB persistent volume. Health checks on all services.

**1.3 — `deploy/kong.yml`** — Routes: `/auth/v1/*` → auth:9999, `/rest/v1/*` → rest:3000, `/realtime/v1/*` → realtime:4000, `/storage/v1/*` → storage:5000.

**1.4 — `deploy/volumes/db/init/00-init.sql`** — Enable pg_cron, pg_net, pgsodium, http, pgcrypto, uuid-ossp extensions.

**1.5 — `deploy/.env.example`** — Full template with Postgres, JWT, Supabase service, Instagram, host-agent, and kiosk variables.

### Task 2: Host Agent

**2.1 — `deploy/host-agent/host-agent.py`** — Python 3 stdlib HTTP server on `127.0.0.1:9876`. Endpoints: `GET /health`, `GET /hostname`, `PUT /hostname`, `GET /ip`, `GET /system-info` (uptime, CPU temp, memory, disk), `POST /reboot`, `POST /shutdown`. Auth via `Authorization: Bearer <HOST_AGENT_SECRET>`.

**2.2 — `deploy/host-agent/host-agent.service`** — Systemd unit, runs as root, reads env from `/opt/newsticker/.env`, auto-restart.

### Task 3: Install Script (`deploy/install.sh`)

1. Check OS (warn on non-Raspbian)
2. Detect Docker → install via `get.docker.com` if missing → add user to docker group
3. Detect Docker Compose plugin → install if missing
4. Create `/opt/newsticker/`, copy project files
5. Generate secrets: `JWT_SECRET` (64-char hex), `ANON_KEY` / `SERVICE_ROLE_KEY` (JWTs signed with secret), `INTERNAL_ADMIN_SECRET`, `HOST_AGENT_SECRET`, `POSTGRES_PASSWORD`
6. Write `.env` from template
7. `docker compose up -d db` → wait for postgres health
8. Apply all `supabase/migrations/*.sql` in order via `psql` in db container
9. Configure Vault secrets + Postgres GUC vars for cron (`app.settings.CRON_APP_URL = http://app:3000`, `app.settings.CRON_INTERNAL_ADMIN_SECRET`)
10. `docker compose up -d` (all services)
11. Install host-agent systemd service → enable → start
12. Install Anthias via official Docker installer → configure default asset to `http://localhost:3000`
13. Print summary with URLs and credentials

### Task 4: App Changes — Device Settings

**4.1 — `features/device/services/device-service.ts`** — Client service: `getHostname()`, `setHostname()`, `getIpAddresses()`, `getSystemInfo()`, `reboot()`, `shutdown()` — all calling `/api/device/*`.

**4.2 — `app/api/device/route.ts`** — Proxies to host-agent. Admin-only via `requireAuth()` + admin check.

**4.3 — `app/api/device/[action]/route.ts`** — POST handler for reboot/shutdown. Validates action whitelist.

**4.4 — `features/device/components/device-settings.tsx`** — Cards for hostname (editable), network IPs, system info (CPU temp, RAM, disk, uptime), power controls (Reboot/Shutdown with AlertDialog confirmation). Uses existing shadcn/ui Card, Button, Input, AlertDialog, Badge.

**4.5 — `app/settings/device/page.tsx`** — Server component: auth check → admin check → redirect if unauthorized. Pattern from `app/settings/users/page.tsx`.

**4.6 — Modify `app/settings/layout.tsx`** — Add conditional sidebar items for "Device" and "Display Manager" when `NEXT_PUBLIC_KIOSK_MODE === 'true'`.

**4.7 — Modify `features/admin/components/admin-dashboard-cards.tsx`** — Add conditional Device Management card for kiosk mode.

**4.8 — Modify `next.config.js`** — Add `output: 'standalone'`, add `kong` and `storage` to image remote patterns.

**4.9 — Update `.env.example`** — Add `NEXT_PUBLIC_KIOSK_MODE`, `HOST_AGENT_URL`, `HOST_AGENT_SECRET`.

### Task 5: Anthias Integration

Handled entirely in the install script. Anthias is installed via its official Docker-based setup, then its API (`http://localhost:9000/api/v1/assets`) is used to add the newsticker URL as the default displayed asset.

---

## Acceptance Criteria

1. `./deploy/install.sh` completes without errors on a fresh Raspbian Pi
2. `docker compose ps` shows all 8 services healthy
3. Newsticker accessible at `http://<pi-ip>:3000`
4. Supabase auth (sign-up, sign-in) works against local GoTrue
5. Admin users see "Device" and "Display Manager" in settings sidebar
6. Device settings page shows hostname, IP, system info, and power controls
7. Hostname change via UI updates `/etc/hostname` on the Pi
8. Reboot/shutdown trigger system actions after confirmation dialog
9. "Display Manager" link opens Anthias UI at port 9000
10. Pi's HDMI display shows newsticker fullscreen via Anthias
11. Non-admin users cannot access device settings
12. App works identically when `NEXT_PUBLIC_KIOSK_MODE` is unset (no device items visible)

## Verification Steps

1. `cd /opt/newsticker && docker compose ps` — all services healthy/running
2. `curl -s http://localhost:3000 | head -20` — returns HTML
3. `curl -s http://localhost:8000/rest/v1/ -H "apikey: <ANON_KEY>"` — returns table list
4. `curl -s http://localhost:9876/health` — returns `{"status": "ok"}`
5. Log in as admin → navigate to `/settings/device` → verify all cards display data
6. Set `NEXT_PUBLIC_KIOSK_MODE=false` → rebuild → verify device items hidden
7. Check Pi HDMI output shows newsticker fullscreen

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Supabase stack heavy for 2 GB Pi | Document 4 GB min, 8 GB recommended. Tune Postgres memory params (shared_buffers=128MB, work_mem=4MB). |
| ARM64 image availability | All official Supabase images have arm64 variants. Pin exact versions. |
| Migration ordering (auth schema needed first) | Start only `db` + wait for GoTrue bootstrap, then apply migrations sequentially. |
| pg_cron can't reach localhost:3000 from Postgres container | Use Docker network hostname `http://app:3000` in Vault/GUC config. |
| Host-agent security | Binds `127.0.0.1` only + requires bearer token auth. |
| Anthias port conflict | No conflict: app on 3000, Anthias UI on 9000, Anthias viewer uses display directly. |