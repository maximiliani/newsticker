#!/bin/bash
# after-update.sh
# This hook is executed by update.sh AFTER all updates have been applied
# and services have been restarted.
# Populate this script with any post-update steps specific to your deployment
# (e.g. sending a notification, warming up caches, running smoke tests, etc.)
#
# Environment variables available from update.sh:
#   INSTALL_DIR              /opt/newsticker
#   RUNTIME_NEWSTICKER_DIR   /opt/newsticker/newsticker
#   SUPABASE_PROJECT_DIR     /opt/newsticker/supabase
#   TARGET_USER              the OS user that owns the installation

set -euo pipefail

# Example:
# curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health

