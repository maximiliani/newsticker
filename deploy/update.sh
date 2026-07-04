#!/bin/bash
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ACTIVE_INSTALL_LINK="/opt/newsticker"
CURRENT_RELEASE_DIR="$(readlink -f "${ACTIVE_INSTALL_LINK}" 2>/dev/null || true)"
if [[ -z "${CURRENT_RELEASE_DIR}" ]]; then
  CURRENT_RELEASE_DIR="${ACTIVE_INSTALL_LINK}"
fi
RELEASE_TIMESTAMP="$(date +%Y%m%d%H%M%S)"
NEW_RELEASE_DIR="/opt/newsticker-${RELEASE_TIMESTAMP}"

export INSTALL_DIR="${NEW_RELEASE_DIR}"
export SUPABASE_PROJECT_DIR="${INSTALL_DIR}/supabase"
export RUNTIME_NEWSTICKER_DIR="${INSTALL_DIR}/newsticker"
KIOSK_DIR="${INSTALL_DIR}/kiosk"

CURRENT_SUPABASE_PROJECT_DIR="${CURRENT_RELEASE_DIR}/supabase"
CURRENT_RUNTIME_NEWSTICKER_DIR="${CURRENT_RELEASE_DIR}/newsticker"
export TARGET_USER="${SUDO_USER:-${USER}}"

if [[ ${EUID} -eq 0 ]]; then
  SUDO=()
else
  SUDO=(sudo)
fi

log()   { echo -e "${GREEN}===> ${*}${NC}"; }
warn()  { echo -e "${YELLOW}WARNING: ${*}${NC}"; }
error() { echo -e "${RED}ERROR: ${*}${NC}"; exit 1; }

run_as_target_user() {
  if [[ ${EUID} -eq 0 && -n "${SUDO_USER:-}" ]]; then
    sudo -u "${TARGET_USER}" bash -lc "$1"
  else
    bash -lc "$1"
  fi
}

run_hook() {
  local hook_name="$1"
  # Check both the installed location and the source tree so the hook can be
  # customised in place without needing a full reinstall.
  local hook_installed_new="${RUNTIME_NEWSTICKER_DIR}/deploy/hooks/${hook_name}"
  local hook_installed_current="${CURRENT_RUNTIME_NEWSTICKER_DIR}/deploy/hooks/${hook_name}"
  local hook_source="${SOURCE_ROOT}/deploy/hooks/${hook_name}"

  if [[ -f "${hook_installed_new}" && -x "${hook_installed_new}" ]]; then
    log "Running hook: ${hook_name} (from ${hook_installed_new})"
    bash "${hook_installed_new}"
  elif [[ -f "${hook_installed_current}" && -x "${hook_installed_current}" ]]; then
    log "Running hook: ${hook_name} (from ${hook_installed_current})"
    bash "${hook_installed_current}"
  elif [[ -f "${hook_source}" && -x "${hook_source}" ]]; then
    log "Running hook: ${hook_name} (from ${hook_source})"
    bash "${hook_source}"
  else
    log "Hook not found or not executable, skipping: ${hook_name}"
  fi
}

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  COMPOSE_CMD=(docker compose)
fi

log "Starting Newsticker update"

if [[ ! -d "${CURRENT_RELEASE_DIR}" ]]; then
  error "Current release directory not found at ${CURRENT_RELEASE_DIR}"
fi
if [[ ! -d "${CURRENT_RUNTIME_NEWSTICKER_DIR}" ]]; then
  error "Current Newsticker directory not found at ${CURRENT_RUNTIME_NEWSTICKER_DIR}"
fi

log "Current release: ${CURRENT_RELEASE_DIR}"
log "New release: ${NEW_RELEASE_DIR}"

"${SUDO[@]}" mkdir -p "${NEW_RELEASE_DIR}" "${SUPABASE_PROJECT_DIR}" "${RUNTIME_NEWSTICKER_DIR}" "${KIOSK_DIR}"
"${SUDO[@]}" chown -R "${TARGET_USER}:${TARGET_USER}" "${NEW_RELEASE_DIR}"

# ── Before-update hook ────────────────────────────────────────────────────────
run_hook "before-update.sh"

# ── Step 1: apt upgrade ───────────────────────────────────────────────────────
log "Step 1/5: Updating system packages"
"${SUDO[@]}" apt-get update -qq
"${SUDO[@]}" apt-get upgrade -y

# ── Step 2: git pull ──────────────────────────────────────────────────────────
log "Step 2/5: Pulling latest Newsticker source"
GIT_DIR="$(git -C "${SOURCE_ROOT}" rev-parse --git-dir 2>/dev/null || true)"
if [[ -z "${GIT_DIR}" ]]; then
  warn "Source directory is not a git repository. Skipping git pull."
else
  run_as_target_user "git -C '${SOURCE_ROOT}' pull --ff-only"
fi

# ── Step 3: Stage new release (app/supabase/kiosk), run migrations, rebuild ──
log "Step 3/5: Staging release files into ${NEW_RELEASE_DIR}"

if [[ -d "${CURRENT_SUPABASE_PROJECT_DIR}" ]]; then
  run_as_target_user "rsync -av --delete '${CURRENT_SUPABASE_PROJECT_DIR}/' '${SUPABASE_PROJECT_DIR}/'"
else
  warn "Current Supabase project not found at ${CURRENT_SUPABASE_PROJECT_DIR}; new release may be incomplete"
fi

run_as_target_user "rsync -av --delete \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='.env.local' \
  '${SOURCE_ROOT}/' '${RUNTIME_NEWSTICKER_DIR}/'"

# Preserve runtime app secrets from the current release.
if [[ -f "${CURRENT_RUNTIME_NEWSTICKER_DIR}/.env.local" ]]; then
  "${SUDO[@]}" cp "${CURRENT_RUNTIME_NEWSTICKER_DIR}/.env.local" "${RUNTIME_NEWSTICKER_DIR}/.env.local"
  "${SUDO[@]}" chown "${TARGET_USER}:${TARGET_USER}" "${RUNTIME_NEWSTICKER_DIR}/.env.local"
  "${SUDO[@]}" chmod 600 "${RUNTIME_NEWSTICKER_DIR}/.env.local"
else
  warn "Current .env.local not found at ${CURRENT_RUNTIME_NEWSTICKER_DIR}/.env.local"
fi

# Apply any new migrations (idempotent: errors are warnings only).
if [[ -d "${CURRENT_SUPABASE_PROJECT_DIR}" ]]; then
  DB_CONTAINER=""
  DB_CONTAINER="$(cd "${CURRENT_SUPABASE_PROJECT_DIR}" && "${COMPOSE_CMD[@]}" ps -q db 2>/dev/null || true)"
  if [[ -n "${DB_CONTAINER}" ]]; then
    for migration_file in "${RUNTIME_NEWSTICKER_DIR}"/supabase/migrations/*.sql; do
      log "Applying migration: $(basename "${migration_file}")"
      if ! docker exec -i "${DB_CONTAINER}" psql -U postgres -d postgres \
            < "${migration_file}" > /dev/null 2>&1; then
        warn "Migration $(basename "${migration_file}") failed or had warnings"
      fi
    done
  else
    warn "Supabase db container not running; skipping migrations"
  fi
fi

log "Rebuilding Newsticker production bundle"
if ! run_as_target_user "cd '${RUNTIME_NEWSTICKER_DIR}' && npm install && npm run build"; then
  warn "npm install/build had errors; services will restart with the previous build"
fi

# Sync kiosk scripts.
log "Updating kiosk scripts in ${KIOSK_DIR}"
"${SUDO[@]}" mkdir -p "${KIOSK_DIR}"
"${SUDO[@]}" cp "${SOURCE_ROOT}/deploy/kiosk/start-chromium-kiosk.sh" "${KIOSK_DIR}/"
"${SUDO[@]}" cp "${SOURCE_ROOT}/deploy/kiosk/refresh-kiosk.sh" "${KIOSK_DIR}/"
"${SUDO[@]}" chmod +x "${KIOSK_DIR}/start-chromium-kiosk.sh" "${KIOSK_DIR}/refresh-kiosk.sh"
"${SUDO[@]}" chown -R "${TARGET_USER}:${TARGET_USER}" "${KIOSK_DIR}"

# ── Step 4: Update Supabase ───────────────────────────────────────────────────
log "Step 4/5: Updating Supabase"
if [[ -f "${SUPABASE_PROJECT_DIR}/run.sh" ]]; then
  # Pull the latest Supabase Docker images.
  run_as_target_user "cd '${SUPABASE_PROJECT_DIR}' && '${SUPABASE_PROJECT_DIR}/run.sh' update" || \
    warn "Supabase update had warnings; continuing"
else
  warn "Supabase run.sh not found at ${SUPABASE_PROJECT_DIR}; trying current release"
  if [[ -f "${CURRENT_SUPABASE_PROJECT_DIR}/run.sh" ]]; then
    run_as_target_user "cd '${CURRENT_SUPABASE_PROJECT_DIR}' && '${CURRENT_SUPABASE_PROJECT_DIR}/run.sh' update" || \
      warn "Supabase update had warnings in current release; continuing"
  fi
fi

# ── Step 5: Reload systemd units and restart services ────────────────────────
log "Step 5/5: Reloading systemd and restarting services"
for unit_file in supabase-stack.service newsticker.service chromium-kiosk.service \
                 chromium-kiosk-refresh.service chromium-kiosk-refresh.timer; do
  src="${SOURCE_ROOT}/deploy/systemd/${unit_file}"
  if [[ -f "${src}" ]]; then
    sed -e "s|%u|${TARGET_USER}|g" "${src}" | \
      "${SUDO[@]}" tee "/etc/systemd/system/${unit_file}" > /dev/null
  fi
done

if [[ -f "${SOURCE_ROOT}/deploy/host-agent/host-agent.service" ]]; then
  PYTHON3_PATH="$(command -v python3 || command -v python || echo /usr/bin/python3)"
  sed -e "s|%u|${TARGET_USER}|g" \
      -e "s|%python3_path%|${PYTHON3_PATH}|g" \
      "${SOURCE_ROOT}/deploy/host-agent/host-agent.service" | \
    "${SUDO[@]}" tee /etc/systemd/system/host-agent.service > /dev/null
fi

"${SUDO[@]}" ln -sfn "${NEW_RELEASE_DIR}" "${ACTIVE_INSTALL_LINK}"

"${SUDO[@]}" systemctl daemon-reload
"${SUDO[@]}" systemctl restart newsticker.target || warn "Could not restart newsticker.target"

# ── After-update hook ─────────────────────────────────────────────────────────
run_hook "after-update.sh"

log "Update complete"
echo ""
echo "Paths:"
echo "  Active link: ${ACTIVE_INSTALL_LINK} -> ${NEW_RELEASE_DIR}"
echo "  Newsticker:  ${RUNTIME_NEWSTICKER_DIR}"
echo "  Supabase:    ${SUPABASE_PROJECT_DIR}"
echo "  Kiosk:       ${KIOSK_DIR}"

