# Deployment Guide

This project supports multiple deployment methods: **Official Supabase Self-Hosting** (recommended), **Local Docker**, and **Vercel**.

## Quick Start

### Official Supabase Self-Hosting (Recommended)

For production self-hosted deployments on Linux (Debian/Ubuntu or RHEL/CentOS/Fedora), use the official Supabase setup script:

```bash
curl -fsSL https://supabase.link/setup.sh | sh
```

This will bootstrap a complete, production-ready Supabase stack with all necessary components. See [Supabase Self-Hosting Documentation](https://supabase.com/docs/guides/self-hosting/docker) for detailed instructions.

After Supabase is deployed, configure Newsticker:

```bash
git clone https://github.com/your-org/newsticker.git
cd newsticker
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
npm run dev          # Development
npm run build        # Production build
docker build .       # Build container for production deployment
```

### Local Docker Deployment (One-Shot Installation)

For automatic setup of Supabase + Newsticker on a Linux host:

```bash
./deploy/install.sh
```

This one-shot installer will:
- Run the official Supabase setup script
- Apply Newsticker database migrations
- Create `.env.local` with Supabase credentials
- Display next steps for running the app

See `deploy/README.md` for detailed instructions and troubleshooting.

**For local development without system-wide installation**, see "Vercel Deployment" or run:
```bash
npm install
npm run dev
```

### Vercel Deployment (Cloud)

Perfect for rapid deployment, automatic scaling, and CDN distribution.

1. Push to GitHub
2. Import project at https://vercel.com
3. Set environment variables (from your Supabase project):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `INTERNAL_ADMIN_SECRET`
4. Deploy

Note: When deploying to Vercel, you'll need a Vercel-compatible Supabase setup. The local Docker setup includes everything; Vercel deployments typically use Supabase Cloud or a self-hosted Supabase instance accessible from the internet.

## Build Configuration

### Local Docker Build

The `deploy/Dockerfile` implements a multi-stage build for optimal image size:

1. **deps stage** - Installs npm dependencies
2. **builder stage** - Builds Next.js application
3. **runner stage** - Minimal production image

Build with:
```bash
docker build -f deploy/Dockerfile -t newsticker:latest .
```

### Vercel Build

Configuration is in `vercel.json` and uses the Next.js framework detection.

The build will:
- Run `npm ci`
- Execute `npm run build`
- Deploy the `.next` output directory

## Environment Variables

### Local Docker

Set in `.env` file (created by `deploy/install.sh`):
- Database credentials (Postgres)
- JWT secrets
- Supabase API URLs
- Kiosk mode settings

### Vercel

Set in Vercel Project Settings → Environment Variables:
- Supabase connection info
- API secrets
- Feature flags

## Architecture Differences

| Aspect | Official Self-Hosted | Local Docker | Vercel |
|--------|-----|-------------|--------|
| Database | Self-hosted PostgreSQL | Self-hosted PostgreSQL | External (Supabase Cloud) |
| Supabase services | Full stack (Kong, Auth, REST, Realtime, Storage) | Full stack (Kong, Auth, REST, Realtime, Storage) | Managed by Supabase Cloud |
| Scaling | Manual (server resources) | Manual (Docker resources) | Automatic (Vercel serverless) |
| Cost | Infrastructure cost (hosting) | Infrastructure cost (hosting) | Pay-as-you-go (Vercel pricing) |
| Customization | Full control | Full control | Limited to Vercel/Next.js |
| Setup complexity | Official script (low) | Custom script (higher) | Minimal |
| Production readiness | ✅ Recommended | ✓ Supported | ✅ Recommended for frontend |

## Troubleshooting

### Official Supabase Self-Hosting Issues

See [Supabase Self-Hosting Documentation](https://supabase.com/docs/guides/self-hosting/docker) for official troubleshooting.

Common issues:
- **Docker not found**: Ensure Docker is installed and available in your PATH
- **Ports in use**: Check for conflicting services on ports 8000, 5432, etc.
- **Out of memory**: Allocate more resources to Docker (especially on Raspberry Pi)

### Local Docker Build Issues

See `deploy/README.md` for local Docker-specific troubleshooting.

### Newsticker App Issues

- Check `.env.local` environment variables are correctly set
- Verify Supabase connection: `curl $NEXT_PUBLIC_SUPABASE_URL/health`
- Check database migrations are applied: `psql -h $DB_HOST -U postgres -d postgres -c "SELECT * FROM auth.users LIMIT 1;"`
- Review app logs: `npm run dev` or `docker logs <container>`

### Vercel Build Issues

- Check `vercel.json` is present and valid
- Ensure `package.json` has all required scripts
- Verify environment variables are set in Vercel dashboard
- Check build logs in Vercel dashboard

## Next Steps

**For Production (Self-Hosted):**
- Follow the [Supabase Self-Hosting Documentation](https://supabase.com/docs/guides/self-hosting/docker)
- Configure DNS and TLS/SSL for your domain
- Set up database backups and monitoring
- Deploy Newsticker with your Supabase instance

**For Development (Local Testing):**
- Use `deploy/install.sh` for a complete local stack
- Or use `npm run dev` with your own Supabase instance

**For Cloud (Vercel):**
- Connect GitHub and import to Vercel dashboard
- Deploy with Supabase Cloud or self-hosted instance

**For Hybrid Setups:**
- Run official Supabase self-hosting on a server
- Deploy Newsticker app to Vercel or another service
- Ensure network connectivity between Newsticker and Supabase

