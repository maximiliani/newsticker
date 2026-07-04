#!/bin/bash
# before-update.sh
# This hook is executed by update.sh BEFORE any updates are applied.
# Populate this script with any pre-update steps specific to your deployment
# (e.g. taking a database snapshot, notifying monitoring systems, etc.)
#
# Environment variables available from update.sh:
#   INSTALL_DIR              /opt/newsticker
#   RUNTIME_NEWSTICKER_DIR   /opt/newsticker/newsticker
#   SUPABASE_PROJECT_DIR     /opt/newsticker/supabase
#   TARGET_USER              the OS user that owns the installation

set -euo pipefail

# Example:
# echo "Backing up database..."
# docker exec supabase_db pg_dump -U postgres postgres > /tmp/newsticker-backup-$(date +%Y%m%d%H%M%S).sql

