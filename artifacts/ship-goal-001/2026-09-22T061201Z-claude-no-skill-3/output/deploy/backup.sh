#!/bin/sh
# Nightly backup. SQLite's own .backup takes a consistent copy of a database
# that is being written to; copying the file with cp does not.
#
#   0 3 * * *  /srv/toolshed/deploy/backup.sh >> /var/log/toolshed-backup.log 2>&1
set -eu

DB="${TOOLSHED_DB:-/var/lib/toolshed/toolshed.sqlite}"
UPLOADS="${TOOLSHED_UPLOADS:-/var/lib/toolshed/uploads}"
DEST="${TOOLSHED_BACKUP_DIR:-/var/backups/toolshed}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$DEST"
sqlite3 "$DB" ".backup '$DEST/toolshed-$STAMP.sqlite'"
tar -czf "$DEST/uploads-$STAMP.tar.gz" -C "$(dirname "$UPLOADS")" "$(basename "$UPLOADS")"

# Keep a fortnight.
find "$DEST" -name 'toolshed-*.sqlite' -mtime +14 -delete
find "$DEST" -name 'uploads-*.tar.gz' -mtime +14 -delete
echo "backed up $DB to $DEST/toolshed-$STAMP.sqlite"
