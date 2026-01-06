#!/bin/bash

# Supabase Management Helper Script (Official Setup)

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Try to find Docker setup directory
DOCKER_DIR=""
# Check current directory and parent directories
for dir in "." ".." "../.." "../../.."; do
    if [ -d "$dir/supabase-docker/docker" ]; then
        DOCKER_DIR="$dir/supabase-docker/docker"
        break
    fi
done

# If not found, check if we're already in the docker directory
if [ -z "$DOCKER_DIR" ] && [ -f "docker-compose.yml" ] && [ -f ".env" ]; then
    DOCKER_DIR="."
fi

if [ -z "$DOCKER_DIR" ]; then
    echo -e "${RED}❌ Could not find Supabase Docker setup directory${NC}"
    echo -e "${YELLOW}💡 Please run this script from the project root or navigate to the Docker directory${NC}"
    echo -e "${YELLOW}💡 Looking for: supabase-docker/docker/docker-compose.yml${NC}"
    exit 1
fi

# Convert to absolute path for consistency
DOCKER_DIR=$(cd "$DOCKER_DIR" && pwd)

show_help() {
    echo -e "${BLUE}Supabase Management Helper (Official Setup)${NC}"
    echo -e "Usage: $0 [COMMAND]"
    echo ""
    echo -e "${YELLOW}Commands:${NC}"
    echo -e "  start        Start Supabase services"
    echo -e "  stop         Stop Supabase services"
    echo -e "  restart      Restart Supabase services"
    echo -e "  status       Show service status"
    echo -e "  logs         Show logs"
    echo -e "  update       Update Supabase images"
    echo -e "  backup       Backup database"
    echo -e "  restore      Restore database"
    echo -e "  reset        Reset all data (DANGEROUS)"
    echo -e "  info         Show connection info"
    echo -e "  help         Show this help"
    echo ""
    echo -e "${BLUE}Docker Directory: ${GREEN}$DOCKER_DIR${NC}"
}

start_supabase() {
    echo -e "${YELLOW}🚀 Starting Supabase...${NC}"
    cd "$DOCKER_DIR" && docker-compose up -d
    echo -e "${GREEN}✅ Supabase started${NC}"
}

stop_supabase() {
    echo -e "${YELLOW}🛑 Stopping Supabase...${NC}"
    cd "$DOCKER_DIR" && docker-compose down
    echo -e "${GREEN}✅ Supabase stopped${NC}"
}

restart_supabase() {
    echo -e "${YELLOW}🔄 Restarting Supabase...${NC}"
    cd "$DOCKER_DIR" && docker-compose restart
    echo -e "${GREEN}✅ Supabase restarted${NC}"
}

show_status() {
    echo -e "${BLUE}📊 Supabase Services Status:${NC}"
    cd "$DOCKER_DIR" && docker-compose ps
}

show_logs() {
    echo -e "${BLUE}📝 Supabase Logs:${NC}"
    cd "$DOCKER_DIR" && docker-compose logs -f
}

update_images() {
    echo -e "${YELLOW}📥 Updating Supabase images...${NC}"
    cd "$DOCKER_DIR" && docker-compose pull
    cd "$DOCKER_DIR" && docker-compose up -d
    echo -e "${GREEN}✅ Images updated${NC}"
}

backup_database() {
    echo -e "${YELLOW}💾 Creating database backup...${NC}"
    BACKUP_FILE="supabase-backup-$(date +%Y%m%d_%H%M%S).sql"
    cd "$DOCKER_DIR" && docker-compose exec db pg_dump -U postgres postgres > "$BACKUP_FILE"
    echo -e "${GREEN}✅ Backup created: $DOCKER_DIR/$BACKUP_FILE${NC}"
}

restore_database() {
    if [ -z "$1" ]; then
        echo -e "${RED}❌ Please provide backup file path${NC}"
        exit 1
    fi

    echo -e "${YELLOW}🔄 Restoring database from $1...${NC}"
    cd "$DOCKER_DIR" && docker-compose exec -T db psql -U postgres postgres < "$1"
    echo -e "${GREEN}✅ Database restored${NC}"
}

reset_data() {
    echo -e "${RED}⚠️  WARNING: This will delete ALL data!${NC}"
    read -p "Are you sure? Type 'yes' to continue: " -r
    if [[ $REPLY == "yes" ]]; then
        echo -e "${YELLOW}🗑️  Resetting Supabase data...${NC}"
        cd "$DOCKER_DIR" && docker-compose down -v
        cd "$DOCKER_DIR" && sudo rm -rf volumes/db/data/* 2>/dev/null || true
        cd "$DOCKER_DIR" && sudo rm -rf volumes/storage/* 2>/dev/null || true
        cd "$DOCKER_DIR" && docker-compose up -d
        echo -e "${GREEN}✅ Data reset complete${NC}"
    else
        echo -e "${YELLOW}Operation cancelled${NC}"
    fi
}

show_info() {
    # Look for credentials file
    CRED_FILE=""
    if [ -f "supabase-credentials.txt" ]; then
        CRED_FILE="supabase-credentials.txt"
    elif [ -f "../supabase-credentials.txt" ]; then
        CRED_FILE="../supabase-credentials.txt"
    elif [ -f "../../supabase-credentials.txt" ]; then
        CRED_FILE="../../supabase-credentials.txt"
    fi

    if [ -n "$CRED_FILE" ]; then
        echo -e "${BLUE}📋 Connection Information:${NC}"
        cat "$CRED_FILE"
    else
        echo -e "${RED}❌ Credentials file not found${NC}"
        echo -e "${YELLOW}💡 Default connection info:${NC}"
        echo -e "  🌐 Supabase URL: http://localhost:8000"
        echo -e "  🔗 Studio URL: http://localhost:3000"
        echo -e "  🗃️  Database: localhost:5432"
    fi
}

case "${1:-help}" in
    start)
        start_supabase
        ;;
    stop)
        stop_supabase
        ;;
    restart)
        restart_supabase
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    update)
        update_images
        ;;
    backup)
        backup_database
        ;;
    restore)
        restore_database "$2"
        ;;
    reset)
        reset_data
        ;;
    info)
        show_info
        ;;
    help|*)
        show_help
        ;;
esac
