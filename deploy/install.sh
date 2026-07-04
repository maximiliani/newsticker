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

prompt_env_var_with_default() {
  local var_name="$1"
  local prompt_label="$2"
  local default_value="$3"
  local value

  read -r -p "${prompt_label} [${default_value}]: " value
  value="${value:-${default_value}}"
  printf -v "${var_name}" '%s' "${value}"
}

set_env_var_in_file() {
  local key="$1"
  local value="$2"
  local file="$3"
  local tmp_file

  tmp_file="$(mktemp)"
  awk -v k="${key}" -v v="${value}" '
    BEGIN { updated = 0 }
    $0 ~ "^" k "=" {
      print k "=" v
      updated = 1
      next
    }
    { print }
    END {
      if (updated == 0) {
        print k "=" v
      }
    }
  ' "${file}" > "${tmp_file}"
  mv "${tmp_file}" "${file}"
}

log "Installing Newsticker into ${INSTALL_DIR}"

log "Please provide your Instagram API credentials"
prompt_required_env_var INSTAGRAM_CLIENT_ID "Instagram API client ID"
prompt_required_env_var INSTAGRAM_CLIENT_SECRET "Instagram API client secret"

CONFIGURE_SMTP="false"
read -r -p "Do you want to provide SMTP email server details? [y/N]: " SMTP_PROMPT_ANSWER
case "${SMTP_PROMPT_ANSWER}" in
  [yY]|[yY][eE][sS])
    CONFIGURE_SMTP="true"
    prompt_env_var_with_default SMTP_ADMIN_EMAIL "SMTP admin email" "admin@example.com"
    prompt_env_var_with_default SMTP_HOST "SMTP host" "smtp.example.com"
    prompt_env_var_with_default SMTP_PORT "SMTP port" "465"
    prompt_env_var_with_default SMTP_USER "SMTP username" "your-smtp-user"
    prompt_env_var_with_default SMTP_PASS "SMTP password" "your-smtp-password"
    prompt_env_var_with_default SMTP_SENDER_NAME "SMTP sender name" "your-sender-name"
    ;;
esac

"${SUDO[@]}" mkdir -p "${INSTALL_DIR}" "${KIOSK_DIR}"
"${SUDO[@]}" chown "${TARGET_USER}:${TARGET_USER}" "${INSTALL_DIR}" "${KIOSK_DIR}"

if ! command -v rsync >/dev/null 2>&1; then
  "${SUDO[@]}" apt update
  "${SUDO[@]}" apt install -y rsync
fi

echo -e "${GREEN}Starting Newsticker installation...${NC}"

# 1. Check OS
if [[ -f /etc/os-release ]]; then
    . /etc/os-release
    if [[ "$ID" != "raspbian" && "$ID" != "debian" ]]; then
        echo -e "${YELLOW}Warning: This script is designed for Raspbian/Debian. Current OS: $ID. Continuing anyway...${NC}"
    fi
else
    echo -e "${YELLOW}Warning: Could not detect OS version. Continuing...${NC}"
fi

# 2. Install Docker from Docker's apt repository (Debian flow)
install_docker_from_apt_repo() {
    local codename
    codename="${VERSION_CODENAME:-}"

    if [[ -z "${codename}" ]]; then
        codename="$(. /etc/os-release && echo "${VERSION_CODENAME:-}")"
    fi

    if [[ -z "${codename}" ]]; then
        echo -e "${RED}Error: Could not determine Debian codename (VERSION_CODENAME).${NC}"
        exit 1
    fi

    echo -e "${GREEN}Installing Docker Engine and Compose plugin via apt repository...${NC}"
    "${SUDO[@]}" apt update
    "${SUDO[@]}" apt install -y ca-certificates curl gnupg lsb-release

    "${SUDO[@]}" install -m 0755 -d /etc/apt/keyrings
    "${SUDO[@]}" curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
    "${SUDO[@]}" chmod a+r /etc/apt/keyrings/docker.asc

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian ${codename} stable" \
      | "${SUDO[@]}" tee /etc/apt/sources.list.d/docker.list > /dev/null

    "${SUDO[@]}" apt update
    "${SUDO[@]}" apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}

if ! command -v docker >/dev/null 2>&1; then
    install_docker_from_apt_repo
else
    echo -e "${GREEN}Docker is already installed. Ensuring Compose plugin exists...${NC}"
    if ! docker compose version >/dev/null 2>&1; then
        install_docker_from_apt_repo
    fi
fi

if id -nG "${TARGET_USER}" | grep -qw docker; then
    echo -e "${GREEN}User ${TARGET_USER} is already in docker group.${NC}"
else
    "${SUDO[@]}" usermod -aG docker "${TARGET_USER}"
    echo -e "${YELLOW}Added ${TARGET_USER} to docker group. Re-login may be required for group changes to apply.${NC}"
fi

# Step 1: Official Supabase setup in /opt/newsticker/supabase
log "Step 1/7: Running official Supabase setup in ${SUPABASE_PROJECT_DIR}"
run_as_target_user "cd '${INSTALL_DIR}' && curl -fsSL https://supabase.link/setup.sh | sh -s -- -p '${SUPABASE_PROJECT_NAME}'"

if [[ ! -d "${SUPABASE_PROJECT_DIR}" ]]; then
  error "Supabase project directory not found at ${SUPABASE_PROJECT_DIR}"
fi

SUPABASE_ENV="${SUPABASE_PROJECT_DIR}/.env"
if [[ "${CONFIGURE_SMTP}" == "true" ]]; then
  if [[ ! -f "${SUPABASE_ENV}" ]]; then
    error "Supabase .env not found at ${SUPABASE_ENV}"
  fi

  log "Applying SMTP settings to ${SUPABASE_ENV}"
  set_env_var_in_file SMTP_ADMIN_EMAIL "${SMTP_ADMIN_EMAIL}" "${SUPABASE_ENV}"
  set_env_var_in_file SMTP_HOST "${SMTP_HOST}" "${SUPABASE_ENV}"
  set_env_var_in_file SMTP_PORT "${SMTP_PORT}" "${SUPABASE_ENV}"
  set_env_var_in_file SMTP_USER "${SMTP_USER}" "${SUPABASE_ENV}"
  set_env_var_in_file SMTP_PASS "${SMTP_PASS}" "${SUPABASE_ENV}"
  set_env_var_in_file SMTP_SENDER_NAME "${SMTP_SENDER_NAME}" "${SUPABASE_ENV}"

  # Supabase env contains secrets; keep it readable only by the install user.
  "${SUDO[@]}" chown "${TARGET_USER}:${TARGET_USER}" "${SUPABASE_ENV}"
  "${SUDO[@]}" chmod 600 "${SUPABASE_ENV}"
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
"${SUDO[@]}" cp "${SOURCE_ROOT}/deploy/kiosk/refresh-kiosk.sh" "${KIOSK_DIR}/"
"${SUDO[@]}" chmod +x "${KIOSK_DIR}/start-chromium-kiosk.sh" "${KIOSK_DIR}/refresh-kiosk.sh"
"${SUDO[@]}" chown -R "${TARGET_USER}:${TARGET_USER}" "${KIOSK_DIR}"

# Step 6: systemd services
log "Step 6/7: Installing systemd units"

for unit_file in supabase-stack.service newsticker.service chromium-kiosk.service chromium-kiosk-refresh.service chromium-kiosk-refresh.timer; do
  sed -e "s|%u|${TARGET_USER}|g" "${SOURCE_ROOT}/deploy/systemd/${unit_file}" | \
    "${SUDO[@]}" tee "/etc/systemd/system/${unit_file}" > /dev/null
done

"${SUDO[@]}" cp "${SOURCE_ROOT}/deploy/systemd/newsticker.target" /etc/systemd/system/newsticker.target
"${SUDO[@]}" systemctl daemon-reload
"${SUDO[@]}" systemctl enable host-agent.service
"${SUDO[@]}" systemctl enable supabase-stack.service
"${SUDO[@]}" systemctl enable newsticker.service
"${SUDO[@]}" systemctl enable chromium-kiosk.service
"${SUDO[@]}" systemctl enable chromium-kiosk-refresh.timer
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