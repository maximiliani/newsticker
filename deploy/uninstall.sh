#!/bin/bash
#
# Newsticker Uninstallation Script
#
# Removes Newsticker from the Supabase project directory and optionally:
# - Disables the host-agent service
# - Drops Newsticker database objects
#
# Usage:
#   ./deploy/uninstall.sh                        # Remove Newsticker files
#   ./deploy/uninstall.sh --remove-migrations    # Also drop Newsticker tables
#   ./deploy/uninstall.sh --remove-all           # Remove everything including host-agent
#

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
  --remove-migrations   Drop Newsticker tables/schemas from the database.
  --remove-all          Remove Newsticker files, database objects, and host-agent.
  -h, --help            Show this help message.

Note: This script removes Newsticker but does NOT uninstall Supabase.
To remove the entire Supabase stack, use: cd supabase-project && docker compose down
EOF
      exit 0
      ;;
    *)
      error "Unknown option: ${arg}"
      ;;
  esac
done

# Find the supabase-project directory
SUPABASE_PROJECT_DIR="${PWD}/supabase-project"

if [[ ! -d "${SUPABASE_PROJECT_DIR}" ]]; then
    error "Supabase project directory not found at ${SUPABASE_PROJECT_DIR}"
fi

NEWSTICKER_DIR="${SUPABASE_PROJECT_DIR}/newsticker"

if [[ ! -d "${NEWSTICKER_DIR}" ]]; then
    warn "Newsticker directory not found at ${NEWSTICKER_DIR}. Nothing to remove."
    exit 0
fi

# ============================================================================
# Step 1: Stop and disable systemd services
# ============================================================================

log "Stopping and disabling systemd services..."

"${SUDO[@]}" systemctl stop newsticker.target 2>/dev/null || warn "newsticker.target not running"
"${SUDO[@]}" systemctl stop supabase-stack.service 2>/dev/null || warn "supabase-stack.service not running"
"${SUDO[@]}" systemctl stop newsticker.service 2>/dev/null || warn "newsticker.service not running"

"${SUDO[@]}" systemctl disable newsticker.target 2>/dev/null || true
"${SUDO[@]}" systemctl disable supabase-stack.service 2>/dev/null || true
"${SUDO[@]}" systemctl disable newsticker.service 2>/dev/null || true

"${SUDO[@]}" rm -f /etc/systemd/system/supabase-stack.service
"${SUDO[@]}" rm -f /etc/systemd/system/newsticker.service
"${SUDO[@]}" rm -f /etc/systemd/system/newsticker.target

"${SUDO[@]}" systemctl daemon-reload

log "Systemd services disabled"

echo ""

# ============================================================================
# Step 2: Remove host-agent service (if requested)
# ============================================================================

if [[ "${REMOVE_HOST_AGENT}" == true ]]; then
    log "Disabling host-agent systemd service..."

    HOST_AGENT_SERVICE="/etc/systemd/system/host-agent.service"

    if "${SUDO[@]}" systemctl list-unit-files 2>/dev/null | grep -q '^host-agent\.service'; then
        "${SUDO[@]}" systemctl stop host-agent || true
        "${SUDO[@]}" systemctl disable host-agent || true
        "${SUDO[@]}" rm -f "${HOST_AGENT_SERVICE}"
        "${SUDO[@]}" systemctl daemon-reload
        log "Host-agent service removed"
    else
        warn "Host-agent service not found. Skipping."
    fi
fi

# ============================================================================
# Step 3: Remove Newsticker files
# ============================================================================

log "Removing Newsticker installation..."
rm -rf "${NEWSTICKER_DIR}"
log "Removed ${NEWSTICKER_DIR}"

# ============================================================================
# Step 4: Drop database objects (if requested)
# ============================================================================

if [[ "${REMOVE_MIGRATIONS}" == true ]]; then
    log "Dropping Newsticker database objects..."

    DB_CONTAINER=$(docker compose -f "${SUPABASE_PROJECT_DIR}/docker-compose.yml" ps -q db) || DB_CONTAINER=""

    if [[ -z "${DB_CONTAINER}" ]]; then
        warn "Supabase database container not running. Skipping database cleanup."
    else
        log "Dropping Newsticker tables and functions..."

        # Drop in reverse dependency order
        docker exec -i "${DB_CONTAINER}" psql -U postgres -d postgres <<'SQL' || warn "Some database objects may not have existed."
-- Drop Newsticker-specific objects (in dependency order)
DROP FUNCTION IF EXISTS public.upsert_vault_secret(TEXT, TEXT, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_decrypted_instagram_tokens(INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.insert_instagram_account(BIGINT, UUID, VARCHAR, TEXT, TEXT, BIGINT) CASCADE;
DROP TABLE IF EXISTS instagram_post_media CASCADE;
DROP TABLE IF EXISTS instagram_posts CASCADE;
DROP TABLE IF EXISTS instagram_accounts CASCADE;
DROP TABLE IF EXISTS articles CASCADE;
DROP TABLE IF EXISTS user_deletion_requests CASCADE;
DROP TYPE IF EXISTS media_type CASCADE;

-- Note: Migrations table itself is left intact for Supabase tracking
SQL

        log "Database objects removed."
    fi
fi

# ============================================================================
# Summary
# ============================================================================

echo ""
log "Newsticker uninstallation complete!"
echo ""
echo "Removed components:"
echo -e "  ✓ Newsticker application files"
echo -e "  ✓ Systemd services (newsticker.service, supabase-stack.service, newsticker.target)"
if [[ "${REMOVE_HOST_AGENT}" == true ]]; then
    echo -e "  ✓ Host-agent service"
fi
if [[ "${REMOVE_MIGRATIONS}" == true ]]; then
    echo -e "  ✓ Newsticker database objects"
fi
echo ""
echo "Remaining components:"
echo -e "  ✓ Supabase stack (still running at http://localhost:8000)"
echo -e "  ✓ Anthias (still running at http://localhost:9000)"
echo ""
echo "To stop the Supabase stack:"
echo -e "  ${YELLOW}cd ${SUPABASE_PROJECT_DIR}${NC}"
echo -e "  ${YELLOW}docker compose down${NC}"
echo ""
echo "To remove all Supabase data as well:"
echo -e "  ${YELLOW}docker compose down -v${NC}"


