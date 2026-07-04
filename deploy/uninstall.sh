#!/bin/bash
set -euo pipefail

INSTALL_DIR="/opt/newsticker"
PROJECT_NAME="newsticker"
COMPOSE_FILE="${INSTALL_DIR}/deploy/docker-compose.yml"
REMOVE_DATA=false
REMOVE_INSTALL_DIR=false
REMOVE_DOCKER=false

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if [[ ${EUID} -eq 0 ]]; then
  SUDO=()
else
  SUDO=(sudo)
fi

for arg in "$@"; do
  case "$arg" in
    --remove-data)
      REMOVE_DATA=true
      ;;
    --remove-install-dir)
      REMOVE_INSTALL_DIR=true
      ;;
    --remove-docker)
      REMOVE_DOCKER=true
      ;;
    -h|--help)
      cat <<EOF
Usage: ./deploy/uninstall.sh [options]

Options:
  --remove-data         Remove persistent database/storage data volumes for this app.
  --remove-install-dir  Remove ${INSTALL_DIR} after services are stopped.
  --remove-docker       Uninstall Docker Engine and Compose plugin from this host.
  -h, --help            Show this help message.
EOF
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: ${arg}${NC}"
      exit 1
      ;;
  esac
done

echo -e "${GREEN}Stopping Newsticker services...${NC}"
if [[ -f "${COMPOSE_FILE}" ]]; then
  docker compose -f "${COMPOSE_FILE}" -p "${PROJECT_NAME}" down
else
  echo -e "${YELLOW}Compose file not found at ${COMPOSE_FILE}; skipping compose shutdown.${NC}"
fi

echo -e "${GREEN}Disabling host-agent service...${NC}"
if "${SUDO[@]}" systemctl list-unit-files | grep -q '^host-agent\.service'; then
  "${SUDO[@]}" systemctl stop host-agent || true
  "${SUDO[@]}" systemctl disable host-agent || true
  "${SUDO[@]}" rm -f /etc/systemd/system/host-agent.service
  "${SUDO[@]}" systemctl daemon-reload
else
  echo -e "${YELLOW}host-agent.service not installed; skipping.${NC}"
fi

if [[ "${REMOVE_DATA}" == true ]]; then
  echo -e "${YELLOW}Removing Docker volumes and local persistent data...${NC}"
  if [[ -f "${COMPOSE_FILE}" ]]; then
    docker compose -f "${COMPOSE_FILE}" -p "${PROJECT_NAME}" down -v || true
  fi
  "${SUDO[@]}" rm -rf "${INSTALL_DIR}/deploy/volumes/db/data" "${INSTALL_DIR}/deploy/volumes/storage"
fi

if [[ "${REMOVE_INSTALL_DIR}" == true ]]; then
  echo -e "${YELLOW}Removing install directory ${INSTALL_DIR}...${NC}"
  "${SUDO[@]}" rm -rf "${INSTALL_DIR}"
fi

if [[ "${REMOVE_DOCKER}" == true ]]; then
  echo -e "${YELLOW}Removing Docker packages from host...${NC}"
  "${SUDO[@]}" apt-get remove -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin || true
  "${SUDO[@]}" rm -f /etc/apt/sources.list.d/docker.list
  "${SUDO[@]}" rm -f /etc/apt/keyrings/docker.asc
  "${SUDO[@]}" apt-get update || true
  echo -e "${YELLOW}Docker data under /var/lib/docker was not deleted automatically.${NC}"
fi

echo -e "${GREEN}Uninstall complete.${NC}"

