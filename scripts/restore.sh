#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: ./scripts/restore.sh <db-backup.sql.gz> <files-backup.tar.gz>"
  exit 1
fi

DB_BACKUP="$1"
FILES_BACKUP="$2"
DB_URL="${DATABASE_URL:?DATABASE_URL is required}"

if [[ ! -f "$DB_BACKUP" ]]; then
  echo "DB backup not found: $DB_BACKUP"
  exit 1
fi

if [[ ! -f "$FILES_BACKUP" ]]; then
  echo "Files backup not found: $FILES_BACKUP"
  exit 1
fi

gunzip -c "$DB_BACKUP" | psql "$DB_URL"
tar -xzf "$FILES_BACKUP" -C /

echo "Restore completed."

