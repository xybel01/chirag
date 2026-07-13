#!/usr/bin/env bash
# Database backup. Run inside the api container or on the host with docker compose.
# Cron example (host):  0 2 * * * cd /opt/it-inventory-portal && docker compose exec -T db pg_dump -U inventory it_inventory | gzip > backend/backups/db-$(date +\%F).sql.gz
set -euo pipefail
STAMP=$(date +%F-%H%M)
mkdir -p backups
pg_dump "$DATABASE_URL" | gzip > "backups/db-$STAMP.sql.gz"
# Keep last 30 backups
ls -1t backups/db-*.sql.gz | tail -n +31 | xargs -r rm
echo "Backup written: backups/db-$STAMP.sql.gz"
