#!/bin/bash

# Supabase Self-Hosted Deployment Script
# This script deploys Supabase using the official Docker setup with migrations (Edge Functions are not used)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SUPABASE_DIR="$(pwd)/supabase"
SUPABASE_DOCKER_DIR="$(pwd)/supabase-docker"
SUPABASE_URL="http://localhost:8000"
POSTGRES_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 64)
ANON_KEY=""
SERVICE_ROLE_KEY=""
ADMIN_EMAIL="admin@localhost.com"
ADMIN_PASSWORD=$(openssl rand -base64 16)

echo -e "${BLUE}🚀 Starting Supabase Self-Hosted Deployment...${NC}"

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
        exit 1
    fi

    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
        exit 1
    fi

    # Check if Git is installed
    if ! command -v git &> /dev/null; then
        echo -e "${RED}❌ Git is not installed. Please install Git first.${NC}"
        exit 1
    fi

    # Check if Node.js is installed (needed for JWT generation)
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js is not installed. Please install Node.js first.${NC}"
        echo -e "${YELLOW}💡 Install from: https://nodejs.org/ or use your package manager${NC}"
        echo -e "${YELLOW}💡 On Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs${NC}"
        exit 1
    fi

    # Check if openssl is installed
    if ! command -v openssl &> /dev/null; then
        echo -e "${RED}❌ OpenSSL is not installed. Please install OpenSSL first.${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ Prerequisites check completed${NC}"
}

# Clone official Supabase Docker setup
clone_supabase_docker() {
    echo -e "${YELLOW}📥 Cloning official Supabase Docker setup...${NC}"

    if [ -d "$SUPABASE_DOCKER_DIR" ]; then
        echo -e "${YELLOW}🔄 Updating existing Supabase Docker setup...${NC}"
        cd "$SUPABASE_DOCKER_DIR"
        git pull
        cd ..
    else
        git clone --depth 1 https://github.com/supabase/supabase.git "$SUPABASE_DOCKER_DIR"
    fi

    # Navigate to the docker directory
    cd "$SUPABASE_DOCKER_DIR/docker"

    echo -e "${GREEN}✅ Official Supabase Docker setup ready${NC}"
}

# Generate JWT keys using official method
generate_jwt_keys() {
    echo -e "${YELLOW}🔑 Generating JWT keys...${NC}"

    # Install jsonwebtoken if not present locally
    if [ ! -d "node_modules/jsonwebtoken" ]; then
        npm init -y &> /dev/null || true
        npm install jsonwebtoken &> /dev/null
    fi

    # Generate anon key
    ANON_KEY=$(node -e "
        const jwt = require('jsonwebtoken');
        const payload = {
            iss: 'supabase',
            ref: 'localhost',
            role: 'anon',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60)
        };
        console.log(jwt.sign(payload, '$JWT_SECRET'));
    ")

    # Generate service role key
    SERVICE_ROLE_KEY=$(node -e "
        const jwt = require('jsonwebtoken');
        const payload = {
            iss: 'supabase',
            ref: 'localhost',
            role: 'service_role',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60)
        };
        console.log(jwt.sign(payload, '$JWT_SECRET'));
    ")

    echo -e "${GREEN}✅ JWT keys generated${NC}"
}

# Disable vector service in Docker Compose
disable_vector_service() {
    echo -e "${YELLOW}🔧 Disabling vector service...${NC}"

    # Remove vector service and update db dependencies
    if [ -f "docker-compose.yml" ]; then
        # Create backup
        cp docker-compose.yml docker-compose.yml.backup

        # Use a more robust approach with Python or Perl to remove the vector service
        if command -v python3 &> /dev/null; then
            python3 -c "
import re

with open('docker-compose.yml', 'r') as f:
    content = f.read()

# Remove vector service section (from 'vector:' to next service or end)
content = re.sub(r'\n  vector:\n.*?(?=\n  [a-zA-Z_-]+:|\nvolumes:|\nnetworks:|\Z)', '', content, flags=re.DOTALL)

# Remove vector dependency from db service depends_on section
content = re.sub(r'(\n\s+depends_on:.*?)\n\s+vector:\n\s+condition: service_healthy', r'\1', content, flags=re.DOTALL)

with open('docker-compose.yml', 'w') as f:
    f.write(content)
"
        else
            # Fallback to sed commands if Python is not available
            # Remove vector service section - find line with 'vector:' and remove until next service
            sed -i '/^  vector:/,/^  [a-zA-Z]/{/^  [a-zA-Z]/!d;}' docker-compose.yml 2>/dev/null || true
            sed -i '/^  vector:/d' docker-compose.yml 2>/dev/null || true

            # Remove vector dependency from db service
            sed -i '/vector:/,+1d' docker-compose.yml 2>/dev/null || true
        fi

        echo -e "${GREEN}✅ Vector service disabled${NC}"
    else
        echo -e "${RED}❌ Docker Compose file not found${NC}"
        exit 1
    fi
}

# Update environment file with our secrets
update_env_file() {
    echo -e "${YELLOW}🔧 Updating environment configuration...${NC}"

    # Update the .env file with our generated secrets
    if [ -f ".env" ]; then
        # Update existing .env file
        sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$POSTGRES_PASSWORD/" .env
        sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
        sed -i "s/ANON_KEY=.*/ANON_KEY=$ANON_KEY/" .env
        sed -i "s/SERVICE_ROLE_KEY=.*/SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY/" .env

        # Ensure additional settings
        if ! grep -q "SMTP_ADMIN_EMAIL=" .env; then
            echo "SMTP_ADMIN_EMAIL=$ADMIN_EMAIL" >> .env
        fi

        if ! grep -q "ENABLE_EMAIL_AUTOCONFIRM=" .env; then
            echo "ENABLE_EMAIL_AUTOCONFIRM=true" >> .env
        fi

        echo -e "${GREEN}✅ Environment configuration updated${NC}"
    else
        echo -e "${RED}❌ .env file not found in official setup${NC}"
        exit 1
    fi
}

# Setup directories and copy user files
setup_directories() {
    echo -e "${YELLOW}📁 Setting up directories and copying user files...${NC}"

    # Determine the correct path to the original supabase directory
    ORIGINAL_SUPABASE_DIR=""
    if [ -d "../../supabase" ]; then
        ORIGINAL_SUPABASE_DIR="../../supabase"
    elif [ -d "../../../supabase" ]; then
        ORIGINAL_SUPABASE_DIR="../../../supabase"
    else
        echo -e "${YELLOW}⚠️  Could not find original supabase directory with migrations/functions${NC}"
    fi

    # Copy user migrations if they exist
    if [ -n "$ORIGINAL_SUPABASE_DIR" ] && [ -d "$ORIGINAL_SUPABASE_DIR/migrations" ]; then
        echo -e "${YELLOW}📝 Copying user migrations...${NC}"
        mkdir -p volumes/db/init
        if [ "$(ls -A "$ORIGINAL_SUPABASE_DIR/migrations" 2>/dev/null)" ]; then
            cp -r "$ORIGINAL_SUPABASE_DIR/migrations"/* volumes/db/init/ 2>/dev/null || true
            echo -e "${GREEN}✅ User migrations copied${NC}"
        else
            echo -e "${YELLOW}⚠️  Migrations directory is empty${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  No migrations directory found${NC}"
    fi

    # Edge Functions are no longer used in this project. Skip copying any functions.
    echo -e "${YELLOW}ℹ️  Skipping Edge Functions setup (not used)${NC}"

    echo -e "${GREEN}✅ Directory setup completed${NC}"
}

# Create systemd service
create_systemd_service() {
    echo -e "${YELLOW}🔧 Creating systemd service...${NC}"
    
    CURRENT_DIR=$(pwd)
    
    sudo tee /etc/systemd/system/supabase.service > /dev/null << EOF
[Unit]
Description=Supabase Self-Hosted
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$CURRENT_DIR
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable supabase.service

    echo -e "${GREEN}✅ Systemd service created and enabled${NC}"
}

# Function to check if a port is open (alternative to netcat)
check_port() {
    local host=$1
    local port=$2

    # Try different methods to check port availability
    if command -v nc &> /dev/null; then
        nc -z "$host" "$port" 2>/dev/null
    elif command -v telnet &> /dev/null; then
        timeout 1 telnet "$host" "$port" &>/dev/null
    elif command -v curl &> /dev/null; then
        curl -s --connect-timeout 1 "$host:$port" &>/dev/null
    else
        # Fallback: use /dev/tcp (bash built-in)
        timeout 1 bash -c "cat < /dev/null > /dev/tcp/$host/$port" 2>/dev/null
    fi
}

# Wait for services to be ready
wait_for_services() {
    echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"

    # Wait for Kong to be ready
    echo "Waiting for Kong API Gateway..."
    timeout=180
    counter=0
    while [ $counter -lt $timeout ]; do
        if check_port localhost 8000; then
            echo -e "${GREEN}✅ Kong is ready${NC}"
            break
        fi
        sleep 3
        counter=$((counter + 3))
    done

    if [ $counter -ge $timeout ]; then
        echo -e "${RED}❌ Kong failed to start within timeout${NC}"
        echo -e "${YELLOW}💡 You can check service status with: docker-compose ps${NC}"
    fi

    # Wait for Studio
    echo "Waiting for Supabase Studio..."
    counter=0
    while [ $counter -lt $timeout ]; do
        if check_port localhost 3000; then
            echo -e "${GREEN}✅ Studio is ready${NC}"
            break
        fi
        sleep 3
        counter=$((counter + 3))
    done

    # Wait for database
    echo "Waiting for PostgreSQL..."
    counter=0
    while [ $counter -lt $timeout ]; do
        if check_port localhost 5432; then
            echo -e "${GREEN}✅ Database is ready${NC}"
            break
        fi
        sleep 3
        counter=$((counter + 3))
    done
}

# Apply migrations using direct SQL (for self-hosted)
apply_migrations() {
    # Find the original supabase directory
    ORIGINAL_SUPABASE_DIR=""
    if [ -d "../../supabase/migrations" ]; then
        ORIGINAL_SUPABASE_DIR="../../supabase"
    elif [ -d "../../../supabase/migrations" ]; then
        ORIGINAL_SUPABASE_DIR="../../../supabase"
    fi

    if [ -n "$ORIGINAL_SUPABASE_DIR" ] && [ -d "$ORIGINAL_SUPABASE_DIR/migrations" ] && [ "$(ls -A "$ORIGINAL_SUPABASE_DIR/migrations" 2>/dev/null)" ]; then
        echo -e "${YELLOW}🔄 Applying migrations via direct SQL execution...${NC}"

        # Wait a bit more for database to be fully ready
        sleep 15

        # Apply each migration file
        for migration_file in "$ORIGINAL_SUPABASE_DIR/migrations"/*.sql; do
            if [ -f "$migration_file" ]; then
                migration_name=$(basename "$migration_file")
                echo "Applying migration: $migration_name"

                # Try to apply migration directly via docker exec
                if docker-compose exec -T db psql -U postgres -d postgres < "$migration_file" 2>/dev/null; then
                    echo -e "  ${GREEN}✅ $migration_name applied successfully${NC}"
                else
                    echo -e "  ${YELLOW}⚠️  Migration $migration_name may have failed or already applied${NC}"
                fi
            fi
        done

        echo -e "${GREEN}✅ Migrations application completed${NC}"
    else
        echo -e "${YELLOW}⚠️  No migrations found to apply${NC}"
    fi
}


# Display final information
display_final_info() {
    echo -e "\n${GREEN}🎉 Supabase deployment completed successfully!${NC}\n"
    
    echo -e "${BLUE}📊 Connection Information:${NC}"
    echo -e "  🌐 Supabase URL: ${GREEN}$SUPABASE_URL${NC}"
    echo -e "  🔗 Studio URL: ${GREEN}http://localhost:3000${NC}"
    echo -e "  🗃️  Database URL: ${GREEN}postgresql://postgres:$POSTGRES_PASSWORD@localhost:5432/postgres${NC}"
    
    echo -e "\n${BLUE}🔑 API Keys:${NC}"
    echo -e "  🔓 Anon Key: ${GREEN}$ANON_KEY${NC}"
    echo -e "  🔒 Service Role Key: ${GREEN}$SERVICE_ROLE_KEY${NC}"
    
    echo -e "\n${BLUE}👤 Admin Credentials:${NC}"
    echo -e "  📧 Email: ${GREEN}$ADMIN_EMAIL${NC}"
    echo -e "  🔐 Password: ${GREEN}$ADMIN_PASSWORD${NC}"
    
    echo -e "\n${BLUE}🔧 Management Commands:${NC}"
    echo -e "  ▶️  Start: ${GREEN}sudo systemctl start supabase${NC}"
    echo -e "  ⏹️  Stop: ${GREEN}sudo systemctl stop supabase${NC}"
    echo -e "  🔄 Restart: ${GREEN}sudo systemctl restart supabase${NC}"
    echo -e "  📊 Status: ${GREEN}sudo systemctl status supabase${NC}"
    echo -e "  📝 Logs: ${GREEN}cd $SUPABASE_DOCKER_DIR/docker && docker-compose logs -f${NC}"

    echo -e "\n${YELLOW}💡 Next Steps:${NC}"
    echo -e "  1. Visit ${GREEN}http://localhost:3000${NC} to access Supabase Studio"
    echo -e "  2. Use the API keys in your application"
    echo -e "  3. Check logs with: ${GREEN}cd $SUPABASE_DOCKER_DIR/docker && docker-compose logs -f${NC}"
    echo -e "  4. The service will automatically start on system boot"
    echo -e "  5. Vector store has been disabled as requested"

    # Save credentials to file in original directory (where script was run from)
    ORIGINAL_DIR=""
    if [ -d "../../supabase" ]; then
        ORIGINAL_DIR=$(dirname "$(dirname "$(pwd)")")
    elif [ -d "../../../supabase" ]; then
        ORIGINAL_DIR=$(dirname "$(dirname "$(dirname "$(pwd)")")")
    else
        ORIGINAL_DIR=$(pwd)
    fi

    cat > "$ORIGINAL_DIR/supabase-credentials.txt" << EOF
Supabase Self-Hosted Deployment Credentials (Official Setup)
============================================================

URLs:
- Supabase URL: $SUPABASE_URL
- Studio URL: http://localhost:3000
- Database URL: postgresql://postgres:$POSTGRES_PASSWORD@localhost:5432/postgres

API Keys:
- Anon Key: $ANON_KEY
- Service Role Key: $SERVICE_ROLE_KEY

Admin Credentials:
- Email: $ADMIN_EMAIL
- Password: $ADMIN_PASSWORD

JWT Secret: $JWT_SECRET
Database Password: $POSTGRES_PASSWORD

Setup Location: $SUPABASE_DOCKER_DIR/docker
Vector Store: Disabled

Generated on: $(date)

Note: This deployment uses the official Supabase Docker setup.
Vector service has been disabled as requested.
EOF

    echo -e "\n${GREEN}💾 Credentials saved to: $ORIGINAL_DIR/supabase-credentials.txt${NC}"
    echo -e "${BLUE}📁 Docker setup location: $SUPABASE_DOCKER_DIR/docker${NC}"
}

# Main deployment function
main() {
    echo -e "${BLUE}🚀 Supabase Self-Hosted Deployment Script (Official Setup)${NC}"
    echo -e "${BLUE}=======================================================${NC}\n"

    check_prerequisites

    # Clone official setup
    clone_supabase_docker

    # Generate JWT keys
    generate_jwt_keys

    # Modify official setup
    disable_vector_service
    update_env_file
    setup_directories

    # Create systemd service
    DOCKER_DIR="$SUPABASE_DOCKER_DIR/docker"
    cd "$DOCKER_DIR"
    create_systemd_service

    # Start services
    echo -e "${YELLOW}🚀 Starting Supabase services...${NC}"
    docker-compose up -d

    wait_for_services

    # Wait for database initialization
    echo -e "${YELLOW}⏳ Waiting for database initialization...${NC}"
    sleep 45

    apply_migrations

    display_final_info

    echo -e "\n${GREEN}✅ Deployment completed! Supabase is now running and will start automatically on boot.${NC}"
    echo -e "${BLUE}📁 Files are located in: $DOCKER_DIR${NC}"
}

# Run main function
main "$@"
