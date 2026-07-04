# Deploy Guide

This directory contains the host setup scripts and container stack for self-hosting Newsticker on Debian-based systems (including Raspberry Pi OS variants based on Debian).

## Files

- `docker-compose.yml` - Runtime stack (database, Supabase services, gateway, app)
- `Dockerfile` - Production image build for the Next.js app
- `install.sh` - End-to-end installation/bootstrap script
- `uninstall.sh` - Stack teardown and optional host cleanup
- `kong.yml` - Kong declarative routing config
- `host-agent/` - Systemd service and host-side helper
- `volumes/` - Persistent data and DB init scripts

## What `install.sh` does

`install.sh` installs and configures the deployment in `/opt/newsticker`.

High-level flow:

1. Checks OS family (expects Debian/Raspbian)
2. Installs Docker from Docker's official apt repository
3. Installs Docker Compose plugin (`docker compose`)
4. Adds the target user to the `docker` group
5. Copies project files into `/opt/newsticker`
6. Generates `.env` secrets/JWT keys
7. Starts DB and applies SQL migrations
8. Starts full stack with Docker Compose
9. Installs and starts `host-agent` systemd service
10. Attempts Anthias installation

## Install

Run from the repository root:

```bash
cd /Users/maximilian/GitHub/newsticker-1
./deploy/install.sh
```

## Uninstall

Basic removal (stop containers + remove host-agent service):

```bash
cd /Users/maximilian/GitHub/newsticker-1
./deploy/uninstall.sh
```

Remove app data volumes/files too:

```bash
./deploy/uninstall.sh --remove-data --remove-install-dir
```

Also uninstall Docker packages from host:

```bash
./deploy/uninstall.sh --remove-docker
```

Show all options:

```bash
./deploy/uninstall.sh --help
```

## Updated container image tags

The compose file currently pins the following tags:

- `supabase/postgres:15.14.1.142`
- `kong:3.9.3`
- `supabase/gotrue:v2.192.0`
- `postgrest/postgrest:v14.14`
- `supabase/realtime:v2.112.4`
- `supabase/storage-api:v1.61.13`
- `darthsim/imgproxy:v4.0.11`

## Notes

- The installer writes generated credentials to `/opt/newsticker/credentials.txt`.
- If Docker group membership was newly added, log out/in (or reboot) before running Docker commands without `sudo`.
- Major image upgrades can introduce config or behavior changes; if you update tags further, validate on a staging host first.

