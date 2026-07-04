# Deploy Guide

This directory contains reference Docker/Compose configurations for self-hosting Newsticker. **For production self-hosting, use the official Supabase setup script** (see below). This folder is primarily for local development and testing.

## 🚀 Official Self-Hosted Deployment (Recommended)

**→ See [SUPABASE_OFFICIAL_SETUP.md](./SUPABASE_OFFICIAL_SETUP.md) for complete step-by-step integration instructions.**

The `deploy/install.sh` script is a one-shot installer that automates the complete setup:

```bash
./deploy/install.sh
```

This script will:
1. ✅ Download and run the official Supabase setup script
2. ✅ Apply Newsticker database migrations
3. ✅ Build Newsticker for production (`npm run build`)
4. ✅ Configure environment variables for Newsticker
5. ✅ Install host-agent (device management for Raspberry Pi)
6. ✅ Install Anthias (digital signage)
7. ✅ Configure systemd services for **automatic startup on boot**
8. ✅ Attempt to create Anthias asset for Newsticker

**What it requires:**
- Linux host (Debian/Ubuntu or RHEL/CentOS/Fedora)
- Outbound internet access
- ~10GB free disk space

**What it sets up:**
- Docker and Docker Compose (if not present)
- Supabase (PostgreSQL, Auth, REST API, Realtime, Storage)
- Newsticker database schema and functions
- Newsticker `.env.local` configuration
- Newsticker built and ready to run
- Host-agent systemd service (port 9876) for device management:
  - Read/write hostname
  - Query IP addresses
  - Get system info (uptime, CPU temp, memory, disk)
  - Reboot/shutdown device
- Anthias for digital signage (port 9000)
- **Systemd services that auto-start on boot** (see [AUTOSTART_CONFIGURATION.md](./AUTOSTART_CONFIGURATION.md))

## 🔄 Automatic Startup on Boot

After installation, Newsticker will automatically start whenever the system boots:

- **supabase-stack.service** - Starts Supabase stack (Docker Compose)
- **newsticker.service** - Starts Newsticker web app (after Supabase ready)
- **host-agent.service** - Starts device management agent
- All grouped under **newsticker.target** for easy control

See [AUTOSTART_CONFIGURATION.md](./AUTOSTART_CONFIGURATION.md) for detailed systemd configuration and control commands.

## 🎮 Control the Stack

```bash
# Check status
sudo systemctl status newsticker.target

# View logs (real-time)
sudo journalctl -u newsticker -f

# Start/stop/restart
sudo systemctl start newsticker.target
sudo systemctl stop newsticker.target
sudo systemctl restart newsticker.target

# Disable auto-start (but don't stop)
sudo systemctl disable newsticker.target

# Disable and stop
sudo systemctl disable --now newsticker.target
```

## 🗑️ Uninstallation

**To uninstall Newsticker (but keep Supabase):**
```bash
./deploy/uninstall.sh
```

**To also remove host-agent and disable auto-start:**
```bash
./deploy/uninstall.sh --remove-all
```

**To also remove database tables:**
```bash
./deploy/uninstall.sh --remove-migrations
```

**References:**
- [Supabase Self-Hosting Docs](https://supabase.com/docs/guides/self-hosting/docker)
- [Newsticker + Supabase Integration Guide](./SUPABASE_OFFICIAL_SETUP.md)
- [Auto-Startup Configuration](./AUTOSTART_CONFIGURATION.md)

## Files

- `docker-compose.yml` — Reference Docker Compose configuration (for local development/testing only)
- `Dockerfile` — Production image build for the Next.js app
- `install.sh` — One-shot installer (orchestrates official Supabase setup + Newsticker integration)
- `uninstall.sh` — Removes Newsticker from the Supabase stack
- `kong.yml` — Kong declarative routing config (reference only)
- `host-agent/` — Systemd service for kiosk mode (Raspberry Pi)
- `volumes/` — Persistent data directories and DB init scripts (reference only)

To test the Docker build locally without running the full stack:

```bash
cd /Users/maximilian/GitHub/newsticker-1
docker build -f deploy/Dockerfile -t newsticker:latest .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000 \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key \
  newsticker:latest
```

The Docker build uses Next.js `output: 'standalone'` mode, which creates a minimal production image.

## Vercel Deployment

To deploy to Vercel:

1. Push your code to GitHub (the main branch is configured for auto-deploy)
2. Create a new project on Vercel and connect your GitHub repository
3. Set the following environment variables in Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
   - `SUPABASE_URL` - Internal Supabase URL (same as above for Vercel)
   - `SUPABASE_SERVICE_ROLE_KEY` - Your service role key
   - Any other required env vars from `.env.example`

Vercel will automatically detect Next.js and use the configuration from `vercel.json`.

## Files

- `docker-compose.yml` - Runtime stack (database, Supabase services, gateway, app)
- `Dockerfile` - Production image build for the Next.js app
- `install.sh` - End-to-end installation/bootstrap script
- `uninstall.sh` - Stack teardown and optional host cleanup
- `kong.yml` - Kong declarative routing config
- `host-agent/` - Systemd service and host-side helper
- `volumes/` - Persistent data and DB init scripts

The DB bootstrap script now ensures the `postgres` role exists before running grants and ownership changes that depend on it.

## Custom `install.sh` (Legacy - Not Recommended)

**This section is outdated.** The `deploy/install.sh` script is now a simplified wrapper around the official Supabase setup. For detailed information, see the section above (**Official Self-Hosted Deployment**).

## Setting Up Newsticker with Official Supabase

Once you've deployed Supabase using the official setup script:

1. **Get your Supabase API credentials:**
   - Note the `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the Supabase setup output or logs
   - Obtain the `SUPABASE_SERVICE_ROLE_KEY` from the Supabase `.env` file

2. **Clone and configure Newsticker:**
   ```bash
   git clone https://github.com/your-org/newsticker.git
   cd newsticker
   cp .env.example .env.local
   ```

3. **Set environment variables in `.env.local`:**
   
   **Required (Supabase connection):**
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000  # or your Supabase URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_URL=http://localhost:8000
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   INTERNAL_ADMIN_SECRET=your_internal_secret
   ```

   **Optional (Instagram integration):**
   ```bash
   INSTAGRAM_CLIENT_ID=your-facebook-app-client-id
   INSTAGRAM_CLIENT_SECRET=your-facebook-app-client-secret
   NEXT_PUBLIC_INSTAGRAM_CLIENT_ID=your-facebook-app-client-id
   ```

   **Optional (Cron scheduling, kiosk mode):**
   ```bash
   CRON_APP_BASE_URL=http://localhost:3000
   NEXT_PUBLIC_REFRESH_EVERY_MINUTES=15
   NEXT_PUBLIC_KIOSK_MODE=false
   HOST_AGENT_URL=http://localhost:9876
   HOST_AGENT_SECRET=replace-with-host-agent-secret
   ```

4. **For production, store secrets in Supabase Vault:**
   
   The app uses `upsert_vault_secret()` to store sensitive values server-side:
   ```sql
   SELECT public.upsert_vault_secret(
       'INSTAGRAM_TOKEN',
       'your-instagram-token',
       'Instagram access token for cron jobs'
   );
   ```

5. **Start Newsticker:**
   - **Development:** `npm run dev`
   - **Production (Docker):** Build and deploy as a service alongside your Supabase stack

6. **Verify database migrations:**
   
   The app expects the Supabase database to have vault and related functions initialized. Ensure your Supabase setup includes:
   - `pgsodium` extension
   - `supabase_vault` extension
   - `pg_cron` extension
   - Application tables (articles, instagram_accounts, etc.)
   
   You can apply the migrations from this repo's `supabase/migrations/` folder to your Supabase instance manually if needed.

## Reference Container Image Tags

The included `docker-compose.yml` (for local testing/reference) pins:

- `supabase/postgres:17.6.1.142`
- `kong:3.9.3`
- `supabase/gotrue:v2.192.0`
- `postgrest/postgrest:v14.14`
- `supabase/realtime:v2.112.4`
- `supabase/storage-api:v1.61.13`
- `darthsim/imgproxy:v4.0.11`

**Note:** The official Supabase setup script may pin different (likely newer) versions. Check your deployed Supabase stack for actual versions in use.


