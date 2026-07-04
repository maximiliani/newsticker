#!/bin/bash
set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

if [[ ${EUID} -eq 0 ]]; then
  SUDO=()
else
  SUDO=(sudo)
fi

log()   { echo -e "${GREEN}===> ${*}${NC}"; }
warn()  { echo -e "${YELLOW}WARNING: ${*}${NC}"; }
error() { echo -e "${RED}ERROR: ${*}${NC}"; exit 1; }

REMOVE_MIGRATIONS=false
REMOVE_HOST_AGENT=false

INSTALL_DIR="/opt/newsticker"
SUPABASE_PROJECT_DIR="${INSTALL_DIR}/supabase"
NEWSTICKER_DIR="${INSTALL_DIR}/newsticker"
KIOSK_DIR="${INSTALL_DIR}/kiosk"

# Parse arguments
for arg in "$@"; do
  case "$arg" in
    --remove-migrations)
      REMOVE_MIGRATIONS=true
      ;;
    --remove-all)
      REMOVE_MIGRATIONS=true
      REMOVE_HOST_AGENT=true
      ;;
    -h|--help)
      cat <<EOF
Usage: ./deploy/uninstall.sh [options]

Options:
  --remove-migrations   Drop Newsticker tables/schemas from the database before shutdown.
  --remove-all          Also remove host-agent files in addition to full uninstall.
  -h, --help            Show this help message.

Note: This script always:
  1) Stops/removes Newsticker systemd services
  2) Runs docker compose down in /opt/newsticker/supabase (if present)
  3) Deletes /opt/newsticker
EOF
      exit 0
      ;;
    *)
      error "Unknown option: ${arg}"
      ;;
  esac
done

# Step 1: Optional DB cleanup while DB may still be running.
if [[ "${REMOVE_MIGRATIONS}" == true ]]; then
  log "Dropping Newsticker database objects (best effort)..."

  DB_CONTAINER=""
  if [[ -d "${SUPABASE_PROJECT_DIR}" ]]; then
    DB_CONTAINER=$(cd "${SUPABASE_PROJECT_DIR}" && docker compose ps -q db) || DB_CONTAINER=""
  fi

  if [[ -z "${DB_CONTAINER}" ]]; then
    warn "Supabase database container not running. Skipping DB cleanup."
  else
    docker exec -i "${DB_CONTAINER}" psql -U postgres -d postgres <<'SQL' || warn "Some DB objects may not have existed."
DROP FUNCTION IF EXISTS public.upsert_vault_secret(TEXT, TEXT, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_decrypted_instagram_tokens(INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.insert_instagram_account(BIGINT, UUID, VARCHAR, TEXT, TEXT, BIGINT) CASCADE;
DROP TABLE IF EXISTS instagram_post_media CASCADE;
DROP TABLE IF EXISTS instagram_posts CASCADE;
DROP TABLE IF EXISTS instagram_accounts CASCADE;
DROP TABLE IF EXISTS articles CASCADE;
DROP TABLE IF EXISTS user_deletion_requests CASCADE;
DROP TYPE IF EXISTS media_type CASCADE;
SQL
    log "Database cleanup complete."
  fi
fi

# Step 2: Stop and remove systemd services.
log "Stopping and disabling systemd services..."
"${SUDO[@]}" systemctl stop newsticker.target 2>/dev/null || warn "newsticker.target not running"
"${SUDO[@]}" systemctl stop supabase-stack.service 2>/dev/null || warn "supabase-stack.service not running"
"${SUDO[@]}" systemctl stop newsticker.service 2>/dev/null || warn "newsticker.service not running"
"${SUDO[@]}" systemctl stop host-agent.service 2>/dev/null || warn "host-agent.service not running"
"${SUDO[@]}" systemctl stop chromium-kiosk.service 2>/dev/null || warn "chromium-kiosk.service not running"

"${SUDO[@]}" systemctl disable newsticker.target 2>/dev/null || true
"${SUDO[@]}" systemctl disable supabase-stack.service 2>/dev/null || true
"${SUDO[@]}" systemctl disable newsticker.service 2>/dev/null || true
"${SUDO[@]}" systemctl disable host-agent.service 2>/dev/null || true
"${SUDO[@]}" systemctl disable chromium-kiosk.service 2>/dev/null || true

"${SUDO[@]}" rm -f /etc/systemd/system/supabase-stack.service
"${SUDO[@]}" rm -f /etc/systemd/system/newsticker.service
"${SUDO[@]}" rm -f /etc/systemd/system/newsticker.target
"${SUDO[@]}" rm -f /etc/systemd/system/host-agent.service
"${SUDO[@]}" rm -f /etc/systemd/system/chromium-kiosk.service
"${SUDO[@]}" systemctl daemon-reload

# Step 3: Always bring Supabase stack down if project exists.
if [[ -d "${SUPABASE_PROJECT_DIR}" ]]; then
  log "Running docker compose down in ${SUPABASE_PROJECT_DIR}..."
  (cd "${SUPABASE_PROJECT_DIR}" && docker compose down -v) || warn "docker compose down failed"
else
  warn "Supabase directory not found at ${SUPABASE_PROJECT_DIR}; skipping compose down"
fi

# Step 4: Optional extra host-agent cleanup.
if [[ "${REMOVE_HOST_AGENT}" == true && -d "${NEWSTICKER_DIR}/deploy/host-agent" ]]; then
  log "Removing host-agent files..."
  rm -rf "${NEWSTICKER_DIR}/deploy/host-agent"
fi

# Step 5: Always remove installation root.
log "Removing ${INSTALL_DIR}..."
"${SUDO[@]}" rm -rf "${INSTALL_DIR}"

# Summary
log "Uninstallation complete"
echo "Removed:"
echo -e "  ✓ systemd units (newsticker, supabase-stack, host-agent, chromium-kiosk)"
echo -e "  ✓ /opt/newsticker/newsticker"
echo -e "  ✓ /opt/newsticker/kiosk"
echo -e "  ✓ /opt/newsticker/supabase (after compose down attempt)"
echo -e "  ✓ /opt/newsticker"
