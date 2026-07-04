# Deploy Guide

This directory contains the installation scripts and service templates for deploying Newsticker on a Linux host.

The installer now places runtime data under:

- `/opt/newsticker/supabase` (official Supabase stack)
- `/opt/newsticker/newsticker` (application code + `.env.local`)
- `/opt/newsticker/kiosk` (Chromium kiosk launcher)

## Install

Run from the repository root:

```bash
./deploy/install.sh
```

What the installer does:

1. Runs the official Supabase self-hosting installer in `/opt/newsticker/supabase`
2. Copies Newsticker into `/opt/newsticker/newsticker`
3. Builds Newsticker (`npm install` + `npm run build`)
4. Applies SQL migrations from `supabase/migrations`
5. Creates `/opt/newsticker/newsticker/.env.local`
6. Installs host-agent and Chromium kiosk dependencies
7. Installs and enables systemd units
8. Starts `newsticker.target`

## Systemd Units

- `newsticker.target` (main target)
- `supabase-stack.service` (Supabase compose stack)
- `newsticker.service` (Next.js app)
- `host-agent.service` (device management)
- `chromium-kiosk.service` (kiosk browser on display `:0`)

Useful commands:

```bash
sudo systemctl status newsticker.target
sudo systemctl start newsticker.target
sudo systemctl stop newsticker.target
sudo journalctl -u newsticker.service -f
```

## Uninstall

```bash
./deploy/uninstall.sh
```

Options:

- `--remove-migrations` drops Newsticker DB objects
- `--remove-all` also removes host-agent files and `/opt/newsticker`

## Files Kept in `deploy/`

- `install.sh`
- `uninstall.sh`
- `README.md`
- `host-agent/host-agent.py`
- `host-agent/host-agent.service`
- `host-agent/debug-host-agent.sh`
- `kiosk/start-chromium-kiosk.sh`
- `systemd/newsticker.service`
- `systemd/supabase-stack.service`
- `systemd/newsticker.target`
- `systemd/chromium-kiosk.service`

## Reference

- Official Supabase Docker self-hosting docs: <https://supabase.com/docs/guides/self-hosting/docker>


