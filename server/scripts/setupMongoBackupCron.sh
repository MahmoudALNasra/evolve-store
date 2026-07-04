#!/bin/bash
# Daily MongoDB backup for estore. Install on droplet:
#   chmod +x /var/www/evolve-store/server/scripts/setupMongoBackupCron.sh
#   /var/www/evolve-store/server/scripts/setupMongoBackupCron.sh

set -euo pipefail

BACKUP_ROOT="/root/mongo-backups"
KEEP_DAYS=14
STAMP="$(date +%F-%H%M)"
DEST="${BACKUP_ROOT}/estore-${STAMP}"

mkdir -p "$BACKUP_ROOT"
mongodump --db estore --out "$DEST"

# Drop safety snapshots older than 3 days (keep real estore-* dumps)
find "$BACKUP_ROOT" -maxdepth 1 -type d -name 'pre-restore-*' -mtime +3 -exec rm -rf {} + 2>/dev/null || true

# Remove estore-* dumps older than KEEP_DAYS
find "$BACKUP_ROOT" -maxdepth 1 -type d -name 'estore-*' -mtime +"${KEEP_DAYS}" -exec rm -rf {} + 2>/dev/null || true

echo "Backup saved: $DEST"
du -sh "$DEST"

CRON_LINE="0 6 * * * mongodump --db estore --out ${BACKUP_ROOT}/estore-\$(date +\\%F-\\%H%M) >> /var/log/mongo-backup.log 2>&1"

if crontab -l 2>/dev/null | grep -q 'mongodump --db estore'; then
  echo "Cron already configured."
else
  (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
  echo "Added daily 6am backup cron."
fi
