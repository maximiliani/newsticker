#!/bin/bash
#
# Host-Agent Debugging and Validation Script
#
# Use this script to troubleshoot host-agent service issues.
# Requires: sudo
#

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()   { echo -e "${GREEN}✓${NC} $*"; }
warn()  { echo -e "${YELLOW}⚠${NC} $*"; }
error() { echo -e "${RED}✗${NC} $*"; }

echo "Newsticker Host-Agent Debugging Tool"
echo "======================================"
echo ""

# Check if running as root or with sudo
if [[ $EUID -ne 0 ]]; then
   error "This script must be run with sudo"
   exit 1
fi

SUDO=()

# Find Newsticker installation
INSTALL_DIR="/opt/newsticker"
SUPABASE_PROJECT_DIR="${INSTALL_DIR}/supabase"
NEWSTICKER_DIR="${INSTALL_DIR}/newsticker"

if [[ ! -d "${NEWSTICKER_DIR}" ]]; then
    error "Newsticker directory not found at ${NEWSTICKER_DIR}"
    exit 1
fi

log "Newsticker installation found at ${NEWSTICKER_DIR}"

echo ""
echo "Checking host-agent service files..."
echo "======================================="

# Check service file
SERVICE_FILE="/etc/systemd/system/host-agent.service"
if [[ -f "${SERVICE_FILE}" ]]; then
    log "Service file exists at ${SERVICE_FILE}"
else
    error "Service file not found at ${SERVICE_FILE}"
    exit 1
fi

# Check Python script
SCRIPT_PATH="${NEWSTICKER_DIR}/deploy/host-agent/host-agent.py"
if [[ -f "${SCRIPT_PATH}" ]]; then
    log "Python script found at ${SCRIPT_PATH}"
    if [[ -x "${SCRIPT_PATH}" ]]; then
        log "Python script is executable"
    else
        warn "Python script is not executable. Fixing..."
        chmod +x "${SCRIPT_PATH}"
        log "Made script executable"
    fi
else
    error "Python script not found at ${SCRIPT_PATH}"
    exit 1
fi

# Check environment file
ENV_FILE="${NEWSTICKER_DIR}/.env.local"
if [[ -f "${ENV_FILE}" ]]; then
    log "Environment file exists at ${ENV_FILE}"
else
    warn "Environment file not found at ${ENV_FILE}"
fi

echo ""
echo "Checking dependencies..."
echo "========================="

# Check Python3
if command -v python3 &> /dev/null; then
    PYTHON3_PATH=$(which python3)
    log "Python3 found at ${PYTHON3_PATH}"
    PYTHON3_VERSION=$(python3 --version 2>&1)
    log "Version: ${PYTHON3_VERSION}"
else
    error "Python3 not found"
    exit 1
fi

# Check required Python modules
echo ""
echo "Checking Python modules..."
for module in http.server json os subprocess socket sys re logging; do
    if python3 -c "import ${module}" 2>/dev/null; then
        log "Python module '${module}' available"
    else
        error "Python module '${module}' not found"
    fi
done

echo ""
echo "Service configuration..."
echo "========================"

echo ""
echo "Content of service file:"
echo "------------------------"
cat "${SERVICE_FILE}"

echo ""
echo "Service status..."
echo "================="

systemctl status host-agent.service --no-pager || warn "Service not running"

echo ""
echo "Recent service logs..."
echo "======================"

journalctl -u host-agent.service -n 20 --no-pager || warn "No logs available"

echo ""
echo "Troubleshooting suggestions..."
echo "=============================="
echo ""
echo "If the service won't start:"
echo "1. Check the logs above for specific errors"
echo "2. Verify Python3 can execute the script:"
echo "   ${PYTHON3_PATH} ${SCRIPT_PATH}"
echo "3. Check if the environment file has required variables:"
echo "   cat ${ENV_FILE} | grep HOST_AGENT"
echo "4. Ensure the user has permission to execute the script:"
echo "   ls -la ${SCRIPT_PATH}"
echo "5. Try running the script manually as the service user:"
echo "   sudo -u ${USER} ${PYTHON3_PATH} ${SCRIPT_PATH}"
echo ""
echo "To restart the service:"
echo "  sudo systemctl restart host-agent.service"
echo ""
echo "To view real-time logs:"
echo "  sudo journalctl -u host-agent.service -f"



