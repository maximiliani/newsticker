#!/bin/bash
set -e

# --- Configuration ---
INSTALL_DIR="/opt/newsticker"
PROJECT_NAME="newsticker"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Newsticker Raspberry Pi Installation...${NC}"

# 1. Check OS
if [[ -f /etc/os-release ]]; then
    . /etc/os-release
    if [[ "$ID" != "raspbian" && "$ID" != "debian" ]]; then
        echo -e "${YELLOW}Warning: This script is designed for Raspbian/Debian. Current OS: $ID. Continuing anyway...${NC}"
    fi
else
    echo -e "${YELLOW}Warning: Could not detect OS version. Continuing...${NC}"
fi

# 2. Detect Docker
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Docker not found. Installing via get.docker.com...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    echo -e "${GREEN}Docker installed. NOTE: You may need to log out and back in for 'docker' group permissions to work.${NC}"
fi

# 3. Detect Docker Compose
if ! docker compose version &> /dev/null; then
    echo -e "${YELLOW}Docker Compose plugin not found. Installing...${NC}"
    sudo apt-get update
    sudo apt-get install -y docker-compose-plugin
fi

# 4. Setup directory and copy files
if [ "$PWD" != "$INSTALL_DIR" ]; then
    echo -e "${GREEN}Setting up directory: $INSTALL_DIR${NC}"
    sudo mkdir -p $INSTALL_DIR
    sudo chown $USER:$USER $INSTALL_DIR
    # Copy all files except node_modules and .next
    if command -v rsync &> /dev/null; then
        rsync -av --exclude='node_modules' --exclude='.next' --exclude='.git' ./ $INSTALL_DIR/
    else
        cp -r . $INSTALL_DIR/
    fi
    cd $INSTALL_DIR
fi

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

# 7. Start DB and wait
echo -e "${GREEN}Starting database...${NC}"
docker compose -f deploy/docker-compose.yml -p ${PROJECT_NAME} up -d db

echo "Waiting for database to be healthy (this may take a minute)..."
# Simple wait loop for PG
MAX_WAIT=30
COUNT=0
until docker exec ${PROJECT_NAME}-db-1 pg_isready -U postgres > /dev/null 2>&1 || [ $COUNT -eq $MAX_WAIT ]; do
    echo -n "."
    sleep 2
    ((COUNT++))
done

if [ $COUNT -eq $MAX_WAIT ]; then
    echo -e "\n${RED}Error: Database timed out during startup.${NC}"
    exit 1
fi
echo -e "\n${GREEN}Database is ready.${NC}"

# 8. Apply migrations
echo -e "${GREEN}Applying Supabase migrations...${NC}"
MIGRATIONS=$(ls supabase/migrations/*.sql | sort)
for f in $MIGRATIONS; do
    echo "Applying $(basename $f)..."
    docker exec -i ${PROJECT_NAME}-db-1 psql -U postgres -d postgres < "$f" > /dev/null
done

# 9. Configure App settings in database
echo -e "${GREEN}Configuring app settings in database...${NC}"
docker exec -i ${PROJECT_NAME}-db-1 psql -U postgres -d postgres <<EOF
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
docker compose -f deploy/docker-compose.yml -p ${PROJECT_NAME} up -d

# 11. Install host-agent
echo -e "${GREEN}Installing host-agent systemd service...${NC}"
sudo cp deploy/host-agent/host-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable host-agent
sudo systemctl start host-agent

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
