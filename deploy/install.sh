#!/bin/bash
set -euo pipefail

# --- Configuration ---
INSTALL_DIR="/opt/newsticker"
PROJECT_NAME="newsticker"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

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

TARGET_USER="${SUDO_USER:-${USER}}"

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
    "${SUDO[@]}" apt-get update
    "${SUDO[@]}" apt-get install -y ca-certificates curl gnupg lsb-release

    "${SUDO[@]}" install -m 0755 -d /etc/apt/keyrings
    "${SUDO[@]}" curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
    "${SUDO[@]}" chmod a+r /etc/apt/keyrings/docker.asc

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian ${codename} stable" \
      | "${SUDO[@]}" tee /etc/apt/sources.list.d/docker.list > /dev/null

    "${SUDO[@]}" apt-get update
    "${SUDO[@]}" apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
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

# 3. Setup directory and copy files
echo -e "${GREEN}Setting up directory: ${INSTALL_DIR}${NC}"
"${SUDO[@]}" mkdir -p "${INSTALL_DIR}"
"${SUDO[@]}" chown "${TARGET_USER}:${TARGET_USER}" "${INSTALL_DIR}"

if command -v rsync >/dev/null 2>&1; then
    rsync -av --delete --exclude='node_modules' --exclude='.next' --exclude='.git' "${SOURCE_ROOT}/" "${INSTALL_DIR}/"
else
    "${SUDO[@]}" apt-get update
    "${SUDO[@]}" apt-get install -y rsync
    rsync -av --delete --exclude='node_modules' --exclude='.next' --exclude='.git' "${SOURCE_ROOT}/" "${INSTALL_DIR}/"
fi

cd "${INSTALL_DIR}"
COMPOSE_FILE="${INSTALL_DIR}/deploy/docker-compose.yml"
COMPOSE_ENV_FILE="${INSTALL_DIR}/.env"

# 5. Generate Secrets
# NOTE: INTERNAL_ADMIN_SECRET is generated as a hex string (openssl rand -hex).
# If this generation method is changed, ensure it remains safe for SQL interpolation
# in section 9, as it is interpolated directly into SQL strings.
echo -e "${GREEN}Generating secrets and JWTs...${NC}"
JWT_SECRET=$(openssl rand -hex 32)
HOST_AGENT_SECRET=$(openssl rand -hex 16)
POSTGRES_PASSWORD=$(openssl rand -hex 16)
INTERNAL_ADMIN_SECRET=$(openssl rand -hex 16)

generate_jwt() {
  local role=$1
  local secret=$2
  python3 - <<EOF
import hmac, hashlib, base64, json, time
def b64_encode(data):
    return base64.urlsafe_b64encode(data).decode('utf-8').replace('=', '')
header = b64_encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
payload = b64_encode(json.dumps({
    "role": "$role",
    "iss": "supabase",
    "iat": int(time.time()),
    "exp": int(time.time()) + 315360000 # 10 years
}).encode())
msg = header + "." + payload
sig = b64_encode(hmac.new("$secret".encode(), msg.encode(), hashlib.sha256).digest())
print(msg + "." + sig)
EOF
}

ANON_KEY=$(generate_jwt "anon" "$JWT_SECRET")
SERVICE_ROLE_KEY=$(generate_jwt "service_role" "$JWT_SECRET")

# 6. Write .env
echo -e "${GREEN}Creating .env file...${NC}"
cat > .env <<EOF
# === DB SETTINGS ===
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=postgres
POSTGRES_PORT=5432
POSTGRES_HOST=db

# === JWT SETTINGS ===
JWT_SECRET=${JWT_SECRET}
ANON_KEY=${ANON_KEY}
SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}

# === KIOSK MODE ===
NEXT_PUBLIC_KIOSK_MODE=true
HOST_AGENT_URL=http://host.docker.internal:9876
HOST_AGENT_SECRET=${HOST_AGENT_SECRET}

# === APP PUBLIC VARIABLES ===
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}

# === APP SERVER VARIABLES ===
SUPABASE_URL=http://kong:8000
SUPABASE_ANON_KEY=${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
INTERNAL_ADMIN_SECRET=${INTERNAL_ADMIN_SECRET}

# === CRON CONFIGURATION ===
CRON_APP_BASE_URL=http://app:3000
NEXT_PUBLIC_REFRESH_EVERY_MINUTES=15
EOF
chmod 600 .env

# 6. Start DB and wait
echo -e "${GREEN}Starting database...${NC}"
docker compose --env-file "${COMPOSE_ENV_FILE}" --project-directory "${INSTALL_DIR}" -f "${COMPOSE_FILE}" -p "${PROJECT_NAME}" up -d db

echo "Waiting for database to be healthy (this may take a minute)..."
# Simple wait loop for PG
MAX_WAIT=30
COUNT=0
until docker exec "${PROJECT_NAME}-db-1" pg_isready -U postgres > /dev/null 2>&1 || [ "$COUNT" -eq "$MAX_WAIT" ]; do
    echo -n "."
    sleep 2
    # Use pre-increment so arithmetic command exits successfully under `set -e`.
    ((++COUNT))
done

if [ "$COUNT" -eq "$MAX_WAIT" ]; then
    echo -e "\n${RED}Error: Database timed out during startup.${NC}"
    exit 1
fi
echo -e "\n${GREEN}Database is ready.${NC}"

# 7. Ensure the postgres role exists for Supabase ownership/grants
echo -e "${GREEN}Ensuring postgres role exists...${NC}"
docker exec -i "${PROJECT_NAME}-db-1" psql -U postgres -d postgres <<EOF
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    CREATE ROLE postgres WITH LOGIN SUPERUSER CREATEROLE CREATEDB REPLICATION BYPASSRLS PASSWORD '${POSTGRES_PASSWORD}';
  END IF;
END
\$\$;
ALTER ROLE postgres WITH LOGIN SUPERUSER CREATEROLE CREATEDB REPLICATION BYPASSRLS PASSWORD '${POSTGRES_PASSWORD}';
EOF

# 8. Apply migrations
echo -e "${GREEN}Applying Supabase migrations...${NC}"
MIGRATIONS=$(ls supabase/migrations/*.sql | sort)
for f in $MIGRATIONS; do
    echo "Applying $(basename $f)..."
    docker exec -i "${PROJECT_NAME}-db-1" psql -U postgres -d postgres < "$f" > /dev/null
done

# 9. Configure App settings in database
echo -e "${GREEN}Configuring app settings in database...${NC}"
docker exec -i "${PROJECT_NAME}-db-1" psql -U postgres -d postgres <<EOF
-- Set GUC variables for the application
-- Use DO block to ensure settings exist
DO \$\$
BEGIN
  -- These variables are used by triggers and pg_cron
  EXECUTE 'ALTER SYSTEM SET app.settings.CRON_APP_URL = ''' || 'http://app:3000' || '''';
  EXECUTE 'ALTER SYSTEM SET app.settings.CRON_INTERNAL_ADMIN_SECRET = ''' || '${INTERNAL_ADMIN_SECRET}' || '''';
END \$\$;
SELECT pg_reload_conf();
EOF

# 10. Start all services
echo -e "${GREEN}Starting all application services...${NC}"
docker compose --env-file "${COMPOSE_ENV_FILE}" --project-directory "${INSTALL_DIR}" -f "${COMPOSE_FILE}" -p "${PROJECT_NAME}" up -d

# 11. Install host-agent
echo -e "${GREEN}Installing host-agent systemd service...${NC}"
"${SUDO[@]}" cp deploy/host-agent/host-agent.service /etc/systemd/system/
"${SUDO[@]}" systemctl daemon-reload
"${SUDO[@]}" systemctl enable host-agent
"${SUDO[@]}" systemctl start host-agent

# 12. Anthias Installation
echo -e "${YELLOW}Installing Anthias (Screenly OSE successor)...${NC}"
if ! command -v anthias &> /dev/null; then
    # Running Anthias installer
    echo "Downloading Anthias installer..."
    curl -sSL https://install.anthias.io -o install-anthias.sh
    echo "Running Anthias installer..."
    bash install-anthias.sh --skip-reboot || echo -e "${YELLOW}Anthias install needs manual intervention.${NC}"
    rm install-anthias.sh
fi

# 13. Summary
IP_ADDR=$(hostname -I | awk '{print $1}')

# Save credentials to a protected file
cat > credentials.txt <<EOF
Postgres Password: ${POSTGRES_PASSWORD}
Admin Secret:      ${INTERNAL_ADMIN_SECRET}
EOF
chmod 600 credentials.txt

echo -e "-------------------------------------------------------"
echo -e "${GREEN}Installation Summary${NC}"
echo -e "-------------------------------------------------------"
echo -e "App URL:           ${YELLOW}http://${IP_ADDR}:3000${NC}"
echo -e "Anthias UI:        ${YELLOW}http://${IP_ADDR}:9000${NC}"
echo -e "Supabase API:      ${YELLOW}http://${IP_ADDR}:8000${NC}"
echo -e "Host Agent:        ${YELLOW}http://localhost:9876${NC}"
echo -e ""
echo -e "Credentials saved to: ${GREEN}credentials.txt${NC}"
echo -e "-------------------------------------------------------"
echo -e "Please log in to Anthias at port 9000 and add"
echo -e "http://localhost:3000 as a web asset."
echo -e "-------------------------------------------------------"
