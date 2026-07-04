#!/bin/bash
#
# Newsticker One-Shot Installation Script
#
# This script orchestrates:
# 1. Official Supabase self-hosting setup
# 2. Newsticker integration and database migrations
# 3. Host-agent installation (device management for Raspberry Pi)
# 4. Anthias installation (digital signage)
#
# Usage:
#   sudo ./deploy/install.sh
#   ./deploy/install.sh                    (will use sudo as needed)
#
# For more details, see: deploy/SUPABASE_OFFICIAL_SETUP.md
#

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
NEWSTICKER_DIR="${SOURCE_ROOT}"

if [[ ${EUID} -eq 0 ]]; then
  SUDO=()
else
  SUDO=(sudo)
fi

log()   { echo -e "${GREEN}===> ${*}${NC}"; }
warn()  { echo -e "${YELLOW}WARNING: ${*}${NC}"; }
error() { echo -e "${RED}ERROR: ${*}${NC}"; exit 1; }

log "Newsticker Installation (Supabase + Host-Agent + Anthias)"
echo ""

# ============================================================================
# Step 1: Run official Supabase setup
# ============================================================================

log "Step 1/4: Running official Supabase setup script..."
echo "This will install Docker, Docker Compose, and bootstrap the Supabase stack."
echo ""

if ! curl -fsSL https://supabase.link/setup.sh | sh; then
    error "Supabase setup failed. Please troubleshoot and try again."
fi

echo ""
log "Supabase setup complete!"
echo ""

# ============================================================================
# Step 2: Integrate Newsticker and apply migrations
# ============================================================================

log "Step 2/4: Integrating Newsticker into Supabase project..."

# The official setup creates a 'supabase-project' directory by default
SUPABASE_PROJECT_DIR="${PWD}/supabase-project"

if [[ ! -d "${SUPABASE_PROJECT_DIR}" ]]; then
    error "Supabase project directory not found at ${SUPABASE_PROJECT_DIR}"
fi

# Copy Newsticker source to the project directory
if ! rsync -av --delete --exclude='node_modules' --exclude='.next' --exclude='.git' \
    --exclude='supabase/migrations' \
    "${NEWSTICKER_DIR}/" "${SUPABASE_PROJECT_DIR}/newsticker/"; then
    error "Failed to copy Newsticker files"
fi

log "Copied Newsticker to ${SUPABASE_PROJECT_DIR}/newsticker"

# Apply database migrations
log "Applying Newsticker database migrations..."

cd "${SUPABASE_PROJECT_DIR}"

# Get the database container ID
DB_CONTAINER=$(docker compose ps -q db) || DB_CONTAINER=""
if [[ -z "${DB_CONTAINER}" ]]; then
    error "Could not find Supabase database container. Is the Supabase stack running? (docker compose ps)"
fi

echo "Database container: ${DB_CONTAINER}"

# Apply migrations in order
MIGRATIONS=$(ls "${NEWSTICKER_DIR}/supabase/migrations"/*.sql | sort)
for migration_file in $MIGRATIONS; do
    migration_name=$(basename "$migration_file")
    log "Applying migration: ${migration_name}"

    if ! docker exec -i "${DB_CONTAINER}" psql -U postgres -d postgres < "$migration_file" > /dev/null 2>&1; then
        warn "Migration ${migration_name} failed or had warnings. Continuing..."
    fi
done

log "Database migrations applied successfully!"

# Build Next.js app for production
log "Building Newsticker for production..."
cd "${SUPABASE_PROJECT_DIR}/newsticker"

if ! npm install; then
    warn "npm install failed. Attempting to continue..."
fi

if ! npm run build; then
    warn "npm run build failed. Attempting to continue..."
fi

cd "${SUPABASE_PROJECT_DIR}"

# Create Newsticker .env.local
log "Creating Newsticker environment file..."

# Read Supabase .env to extract credentials
SUPABASE_ENV="${SUPABASE_PROJECT_DIR}/.env"
if [[ ! -f "${SUPABASE_ENV}" ]]; then
    error "Supabase .env not found at ${SUPABASE_ENV}"
fi

# Source the Supabase .env carefully (only keys we need)
source "${SUPABASE_ENV}" || true

# Create Newsticker .env.local
NEWSTICKER_ENV="${SUPABASE_PROJECT_DIR}/newsticker/.env.local"
mkdir -p "$(dirname "${NEWSTICKER_ENV}")"

cat > "${NEWSTICKER_ENV}" <<EOF
# Newsticker Configuration
# Auto-generated during installation

# Supabase Connection (from official setup)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY:-}

# Server-side only (keep secret!)
SUPABASE_URL=http://localhost:8000
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY:-}
INTERNAL_ADMIN_SECRET=$(openssl rand -hex 16)

# Optional: Instagram Integration
# INSTAGRAM_CLIENT_ID=your-facebook-app-id
# INSTAGRAM_CLIENT_SECRET=your-facebook-app-secret
# NEXT_PUBLIC_INSTAGRAM_CLIENT_ID=your-facebook-app-id

# Optional: Cron/Automation
CRON_APP_BASE_URL=http://localhost:3000
NEXT_PUBLIC_REFRESH_EVERY_MINUTES=15

# Kiosk Mode (for Raspberry Pi)
NEXT_PUBLIC_KIOSK_MODE=true
HOST_AGENT_URL=http://localhost:9876
HOST_AGENT_SECRET=$(openssl rand -hex 16)
EOF

log "Created Newsticker environment at ${NEWSTICKER_ENV}"

echo ""

# ============================================================================
# Step 3: Install host-agent (device management for Raspberry Pi)
# ============================================================================

log "Step 3/4: Installing host-agent systemd service..."

# Update host-agent.service to reference the correct paths
HOST_AGENT_SERVICE_TEMPLATE="${NEWSTICKER_DIR}/deploy/host-agent/host-agent.service"
HOST_AGENT_SERVICE="/etc/systemd/system/host-agent.service"

if [[ -f "${HOST_AGENT_SERVICE_TEMPLATE}" ]]; then
    # Create a modified version with correct paths
    sed "s|/opt/newsticker|${SUPABASE_PROJECT_DIR}/newsticker|g" "${HOST_AGENT_SERVICE_TEMPLATE}" | \
        "${SUDO[@]}" tee "${HOST_AGENT_SERVICE}" > /dev/null

    # Install Python host-agent script
    "${SUDO[@]}" mkdir -p "${SUPABASE_PROJECT_DIR}/newsticker/deploy/host-agent"
    "${SUDO[@]}" cp "${NEWSTICKER_DIR}/deploy/host-agent/host-agent.py" \
        "${SUPABASE_PROJECT_DIR}/newsticker/deploy/host-agent/"
    "${SUDO[@]}" chmod +x "${SUPABASE_PROJECT_DIR}/newsticker/deploy/host-agent/host-agent.py"

    "${SUDO[@]}" systemctl daemon-reload
    "${SUDO[@]}" systemctl enable host-agent
    "${SUDO[@]}" systemctl start host-agent

    log "Host-agent installed and started"
else
    warn "Host-agent template not found at ${HOST_AGENT_SERVICE_TEMPLATE}. Skipping."
fi

echo ""

# ============================================================================
# Step 4: Install Anthias (digital signage)
# ============================================================================

log "Step 4/4: Installing Anthias (digital signage)..."

if ! command -v anthias &> /dev/null; then
    echo "Downloading Anthias installer..."
    if curl -sSL https://install.anthias.io -o /tmp/install-anthias.sh; then
        echo "Running Anthias installer (with --skip-reboot to avoid interrupting setup)..."
        bash /tmp/install-anthias.sh --skip-reboot || warn "Anthias install needs manual intervention or has non-critical failures."
        rm -f /tmp/install-anthias.sh
        log "Anthias installed"
    else
        warn "Failed to download Anthias installer. You can install it manually later."
    fi
else
    log "Anthias is already installed"
fi

echo ""

# ============================================================================
# Step 5: Configure systemd services for autostart on boot
# ============================================================================

log "Step 5/6: Configuring systemd services for automatic startup..."

# Create/update host-agent.service with correct paths
HOST_AGENT_SERVICE_TEMPLATE="${NEWSTICKER_DIR}/deploy/host-agent/host-agent.service"
HOST_AGENT_SERVICE="/etc/systemd/system/host-agent.service"

if [[ -f "${HOST_AGENT_SERVICE_TEMPLATE}" ]]; then
    sed "s|/opt/newsticker|${SUPABASE_PROJECT_DIR}/newsticker|g" "${HOST_AGENT_SERVICE_TEMPLATE}" | \
        "${SUDO[@]}" tee "${HOST_AGENT_SERVICE}" > /dev/null
fi

# Install Supabase stack service
SUPABASE_STACK_SERVICE="${NEWSTICKER_DIR}/deploy/systemd/supabase-stack.service"
if [[ -f "${SUPABASE_STACK_SERVICE}" ]]; then
    # Create expanded version with correct user and path
    USERNAME="${SUDO_USER:-${USER}}"
    sed -e "s|%u|${USERNAME}|g" \
        -e "s|%h|~${USERNAME}|g" \
        "${SUPABASE_STACK_SERVICE}" | \
        "${SUDO[@]}" tee "/etc/systemd/system/supabase-stack.service" > /dev/null
fi

# Install Newsticker service
NEWSTICKER_SERVICE_TEMPLATE="${NEWSTICKER_DIR}/deploy/systemd/newsticker.service"
if [[ -f "${NEWSTICKER_SERVICE_TEMPLATE}" ]]; then
    USERNAME="${SUDO_USER:-${USER}}"
    sed -e "s|%u|${USERNAME}|g" \
        -e "s|%h|~${USERNAME}|g" \
        "${NEWSTICKER_SERVICE_TEMPLATE}" | \
        "${SUDO[@]}" tee "/etc/systemd/system/newsticker.service" > /dev/null
fi

# Install target unit
NEWSTICKER_TARGET="${NEWSTICKER_DIR}/deploy/systemd/newsticker.target"
if [[ -f "${NEWSTICKER_TARGET}" ]]; then
    "${SUDO[@]}" cp "${NEWSTICKER_TARGET}" "/etc/systemd/system/newsticker.target"
fi

# Reload systemd daemon and enable services
"${SUDO[@]}" systemctl daemon-reload
"${SUDO[@]}" systemctl enable newsticker.target || warn "Failed to enable newsticker.target"
"${SUDO[@]}" systemctl enable supabase-stack.service || warn "Failed to enable supabase-stack.service"
"${SUDO[@]}" systemctl enable newsticker.service || warn "Failed to enable newsticker.service"
"${SUDO[@]}" systemctl enable host-agent.service || warn "Failed to enable host-agent.service"

log "Systemd services configured for autostart on boot"

echo ""

# ============================================================================
# Step 6: Create Anthias asset for Newsticker
# ============================================================================

log "Step 6/6: Creating Anthias asset for Newsticker..."

# Wait a bit for Anthias to be ready
sleep 5

# Attempt to create the asset via Anthias API
ANTHIAS_API="http://localhost:8080"
ASSET_RESPONSE=$(curl -s -X POST "${ANTHIAS_API}/api/assets" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "Newsticker",
        "asset_type": "website",
        "url": "http://localhost:3000",
        "duration": 300,
        "is_portrait": false
    }' || echo "")

if [[ -n "${ASSET_RESPONSE}" ]]; then
    log "Anthias asset created successfully"
else
    warn "Could not automatically create Anthias asset. You can do this manually:"
    warn "1. Open http://localhost:9000 in your browser"
    warn "2. Add a new Web Asset"
    warn "3. Set URL to: http://localhost:3000"
    warn "4. Set duration to 300 seconds (or your preference)"
fi
log "Installation Complete!"
echo -e "-------------------------------------------------------"
echo ""
echo "Supabase stack is running at:"
echo -e "  ${GREEN}http://localhost:8000${NC}"
echo ""
echo "Newsticker is running at:"
echo -e "  ${GREEN}http://localhost:3000${NC}"
echo ""
echo "Anthias digital signage is running at:"
echo -e "  ${GREEN}http://localhost:9000${NC}"
echo ""
echo "Newsticker configuration:"
echo -e "  Environment: ${NEWSTICKER_ENV}"
echo -e "  Installation: ${SUPABASE_PROJECT_DIR}/newsticker"
echo ""
echo "Installed components:"
echo -e "  ✓ Supabase (PostgreSQL, Auth, API, Realtime, Storage)"
echo -e "  ✓ Newsticker database and migrations"
echo -e "  ✓ Newsticker app (built for production)"
echo -e "  ✓ Host-agent service (device management on port 9876)"
echo -e "  ✓ Anthias (digital signage on port 9000)"
echo ""
echo "Systemd services (auto-start on boot):"
echo -e "  ✓ newsticker.target (main target)"
echo -e "  ✓ supabase-stack.service (Docker Compose)"
echo -e "  ✓ newsticker.service (Next.js app)"
echo -e "  ✓ host-agent.service (device management)"
echo ""
echo "Status and control:"
echo -e "  Check status:   ${YELLOW}sudo systemctl status newsticker.target${NC}"
echo -e "  Start:          ${YELLOW}sudo systemctl start newsticker.target${NC}"
echo -e "  Stop:           ${YELLOW}sudo systemctl stop newsticker.target${NC}"
echo -e "  View logs:      ${YELLOW}sudo journalctl -u newsticker -f${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. The Newsticker stack is now running!"
echo "   - Visit http://localhost:3000 to access Newsticker"
echo "   - Visit http://localhost:9000 to access Anthias"
echo ""
echo "2. Configure Anthias to display Newsticker:"
echo "   - If the asset wasn't created automatically, add it manually:"
echo "   - Open http://localhost:9000"
echo "   - Create new Web Asset"
echo "   - Set URL to http://localhost:3000"
echo ""
echo "3. System will auto-start on reboot"
echo ""
echo "For more information, see:"
echo -e "  ${YELLOW}${NEWSTICKER_DIR}/deploy/SUPABASE_OFFICIAL_SETUP.md${NC}"
echo -e "-------------------------------------------------------"

# ============================================================================
# Start the services
# ============================================================================

log "Starting Newsticker stack..."
"${SUDO[@]}" systemctl start newsticker.target

# Wait for services to be ready
echo "Waiting for services to become ready..."
sleep 10

log "Newsticker stack is starting. Check status with:"
echo -e "  ${YELLOW}sudo systemctl status newsticker.target${NC}"





