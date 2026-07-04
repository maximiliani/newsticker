#!/bin/bash
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
INSTALL_DIR="/opt/newsticker"
SUPABASE_PROJECT_NAME="supabase"
SUPABASE_PROJECT_DIR="${INSTALL_DIR}/${SUPABASE_PROJECT_NAME}"
RUNTIME_NEWSTICKER_DIR="${INSTALL_DIR}/newsticker"
KIOSK_DIR="${INSTALL_DIR}/kiosk"
TARGET_USER="${SUDO_USER:-${USER}}"

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

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  COMPOSE_CMD=(docker compose)
fi

read_env_var() {
  local key="$1"
  local file="$2"
  grep -E "^${key}=" "$file" | head -n1 | cut -d= -f2- || true
}

prompt_required_env_var() {
  local var_name="$1"
  local prompt_label="$2"

  while true; do
    read -r -p "${prompt_label}: " value
    if [[ -n "${value}" ]]; then
      printf -v "${var_name}" '%s' "${value}"
      return
    fi
    warn "${prompt_label} is required"
  done
}

log "Installing Newsticker into ${INSTALL_DIR}"

log "Please provide your Instagram API credentials"
prompt_required_env_var INSTAGRAM_CLIENT_ID "Instagram API client ID"
prompt_required_env_var INSTAGRAM_CLIENT_SECRET "Instagram API client secret"

"${SUDO[@]}" mkdir -p "${INSTALL_DIR}" "${KIOSK_DIR}"
"${SUDO[@]}" chown "${TARGET_USER}:${TARGET_USER}" "${INSTALL_DIR}" "${KIOSK_DIR}"

if ! command -v rsync >/dev/null 2>&1; then
  "${SUDO[@]}" apt-get update
  "${SUDO[@]}" apt-get install -y rsync
fi

# Step 1: Official Supabase setup in /opt/newsticker/supabase
log "Step 1/7: Running official Supabase setup in ${SUPABASE_PROJECT_DIR}"
run_as_target_user "cd '${INSTALL_DIR}' && curl -fsSL https://supabase.link/setup.sh | sh -s -- -p '${SUPABASE_PROJECT_NAME}'"

if [[ ! -d "${SUPABASE_PROJECT_DIR}" ]]; then
  error "Supabase project directory not found at ${SUPABASE_PROJECT_DIR}"
fi

run_as_target_user "sh '${SUPABASE_PROJECT_DIR}'/run.sh start"

# Step 2: Install node.js
log "Step 2/7: Installing node.js v24"
# Remove any existing nodejs/npm to avoid conflicts
"${SUDO[@]}" apt remove -y nodejs npm 2>/dev/null; true
# Add NodeSource repository for Node.js v24
curl -fsSL https://deb.nodesource.com/setup_24.x | "${SUDO[@]}" bash -
# Install nodejs and test
"${SUDO[@]}" apt-get install -y nodejs
node -v

# Step 3: Copy app, apply migrations, build
log "Step 3/7: Installing Newsticker app into ${RUNTIME_NEWSTICKER_DIR}"
run_as_target_user "mkdir -p '${RUNTIME_NEWSTICKER_DIR}'"
run_as_target_user "rsync -av --delete --exclude='node_modules' --exclude='.next' --exclude='.git' '${SOURCE_ROOT}/' '${RUNTIME_NEWSTICKER_DIR}/'"

SUPABASE_ENV="${SUPABASE_PROJECT_DIR}/.env"
if [[ ! -f "${SUPABASE_ENV}" ]]; then
  error "Supabase .env not found at ${SUPABASE_ENV}"
fi

ANON_KEY_VALUE="$(read_env_var ANON_KEY "${SUPABASE_ENV}")"
SERVICE_ROLE_VALUE="$(read_env_var SERVICE_ROLE_KEY "${SUPABASE_ENV}")"

NEWSTICKER_ENV="${RUNTIME_NEWSTICKER_DIR}/.env.local"
cat > "${NEWSTICKER_ENV}" <<EOF
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY_VALUE}
SUPABASE_URL=http://localhost:8000
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_VALUE}
INSTAGRAM_CLIENT_ID=${INSTAGRAM_CLIENT_ID}
INSTAGRAM_CLIENT_SECRET=${INSTAGRAM_CLIENT_SECRET}
INTERNAL_ADMIN_SECRET=$(openssl rand -hex 16)
CRON_APP_BASE_URL=http://localhost:3000
NEXT_PUBLIC_REFRESH_EVERY_MINUTES=15
NEXT_PUBLIC_KIOSK_MODE=true
HOST_AGENT_URL=http://localhost:9876
HOST_AGENT_SECRET=$(openssl rand -hex 16)
EOF
"${SUDO[@]}" chown "${TARGET_USER}:${TARGET_USER}" "${NEWSTICKER_ENV}"
"${SUDO[@]}" chmod 600 "${NEWSTICKER_ENV}"

DB_CONTAINER="$(cd "${SUPABASE_PROJECT_DIR}" && "${COMPOSE_CMD[@]}" ps -q db)"
if [[ -z "${DB_CONTAINER}" ]]; then
  error "Could not resolve Supabase db container from ${SUPABASE_PROJECT_DIR}"
fi

for migration_file in "${RUNTIME_NEWSTICKER_DIR}"/supabase/migrations/*.sql; do
  log "Applying migration: $(basename "${migration_file}")"
  if ! docker exec -i "${DB_CONTAINER}" psql -U postgres -d postgres < "${migration_file}" > /dev/null 2>&1; then
    warn "Migration $(basename "${migration_file}") failed or had warnings"
  fi
done

log "Building Newsticker production bundle"
if ! run_as_target_user "cd '${RUNTIME_NEWSTICKER_DIR}' && npm install && npm run build"; then
  warn "npm install/build failed; continuing"
fi


# Step 4: Host-agent
log "Step 4/7: Installing host-agent service"
PYTHON3_PATH="$(command -v python3 || command -v python || echo /usr/bin/python3)"
HOST_AGENT_TEMPLATE="${SOURCE_ROOT}/deploy/host-agent/host-agent.service"

if [[ -f "${HOST_AGENT_TEMPLATE}" ]]; then
  sed -e "s|%u|${TARGET_USER}|g" -e "s|%python3_path%|${PYTHON3_PATH}|g" "${HOST_AGENT_TEMPLATE}" | \
    "${SUDO[@]}" tee /etc/systemd/system/host-agent.service > /dev/null
fi

"${SUDO[@]}" mkdir -p "${RUNTIME_NEWSTICKER_DIR}/deploy/host-agent"
"${SUDO[@]}" cp "${SOURCE_ROOT}/deploy/host-agent/host-agent.py" "${RUNTIME_NEWSTICKER_DIR}/deploy/host-agent/"
"${SUDO[@]}" cp "${SOURCE_ROOT}/deploy/host-agent/debug-host-agent.sh" "${RUNTIME_NEWSTICKER_DIR}/deploy/host-agent/"
"${SUDO[@]}" chmod +x "${RUNTIME_NEWSTICKER_DIR}/deploy/host-agent/host-agent.py" "${RUNTIME_NEWSTICKER_DIR}/deploy/host-agent/debug-host-agent.sh"
"${SUDO[@]}" chown -R "${TARGET_USER}:${TARGET_USER}" "${RUNTIME_NEWSTICKER_DIR}/deploy/host-agent"

# Step 5: Chromium kiosk
log "Step 5/7: Installing Chromium kiosk dependencies"
"${SUDO[@]}" apt-get update
if ! "${SUDO[@]}" apt-get install -y chromium unclutter xdotool; then
  # Some distributions use chromium-browser instead of chromium.
  "${SUDO[@]}" apt-get install -y chromium-browser unclutter xdotool || warn "Could not install Chromium kiosk dependencies"
fi

"${SUDO[@]}" mkdir -p "${KIOSK_DIR}"
"${SUDO[@]}" cp "${SOURCE_ROOT}/deploy/kiosk/start-chromium-kiosk.sh" "${KIOSK_DIR}/"
"${SUDO[@]}" chmod +x "${KIOSK_DIR}/start-chromium-kiosk.sh"
"${SUDO[@]}" chown -R "${TARGET_USER}:${TARGET_USER}" "${KIOSK_DIR}"

# Step 6: systemd services
log "Step 6/7: Installing systemd units"

for unit_file in supabase-stack.service newsticker.service chromium-kiosk.service; do
  sed -e "s|%u|${TARGET_USER}|g" "${SOURCE_ROOT}/deploy/systemd/${unit_file}" | \
    "${SUDO[@]}" tee "/etc/systemd/system/${unit_file}" > /dev/null
done

"${SUDO[@]}" cp "${SOURCE_ROOT}/deploy/systemd/newsticker.target" /etc/systemd/system/newsticker.target
"${SUDO[@]}" systemctl daemon-reload
"${SUDO[@]}" systemctl enable host-agent.service
"${SUDO[@]}" systemctl enable supabase-stack.service
"${SUDO[@]}" systemctl enable newsticker.service
"${SUDO[@]}" systemctl enable chromium-kiosk.service
"${SUDO[@]}" systemctl enable newsticker.target

# Step 7: Chromium kiosk service notes
log "Step 7/7: Chromium kiosk service configured"
echo "Chromium kiosk will open http://localhost:3000 on display :0"

log "Starting services"
"${SUDO[@]}" systemctl start newsticker.target || warn "Could not start newsticker.target automatically"

echo -e "\n${GREEN}Installation complete.${NC}"
echo "Paths:"
echo "- Supabase:  ${SUPABASE_PROJECT_DIR}"
echo "- Newsticker: ${RUNTIME_NEWSTICKER_DIR}"
echo "- Chromium kiosk: ${KIOSK_DIR}"
echo "- Host-agent: ${RUNTIME_NEWSTICKER_DIR}/deploy/host-agent"

sh /opt/newsticker/supabase/run.sh status