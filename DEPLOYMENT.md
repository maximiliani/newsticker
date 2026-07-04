# Deployment Guide

This project supports two deployment methods: **Local Docker** and **Vercel**.

## Quick Start

### Local Docker Deployment (Self-Hosted)

Perfect for Raspberry Pi, local servers, or private infrastructure.

```bash
cd deploy
./install.sh
```

This will:
- Install Docker and Docker Compose
- Bootstrap a complete Supabase stack (PostgreSQL, Auth, REST API, Realtime, Storage)
- Build and deploy the Next.js app
- Set up Anthias for digital signage

See `deploy/README.md` for detailed instructions and troubleshooting.

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

Note: When deploying to Vercel, you'll need a Vercel-compatible Supabase setup. The local Docker setup includes everything; Vercel deployments typically use Supabase Cloud.

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

| Aspect | Local Docker | Vercel |
|--------|-------------|--------|
| Database | Self-hosted PostgreSQL | External (Supabase Cloud) |
| Supabase services | Full stack (Kong, Auth, REST, Realtime, Storage) | Managed by Supabase Cloud |
| Scaling | Manual (Docker resources) | Automatic (Vercel serverless) |
| Cost | Infrastructure cost (hosting) | Pay-as-you-go (Vercel pricing) |
| Customization | Full control | Limited to Vercel/Next.js |

## Troubleshooting

### Docker Build Issues

See `deploy/README.md` for Docker-specific troubleshooting.

### Vercel Build Issues

- Check `vercel.json` is present and valid
- Ensure `package.json` has all required scripts
- Verify environment variables are set in Vercel dashboard
- Check build logs in Vercel dashboard

## Next Steps

- **Local**: Follow `deploy/README.md` for complete setup
- **Vercel**: Connect GitHub and import to Vercel dashboard
- **Hybrid**: Run local Docker for Supabase, deploy app frontend to Vercel

