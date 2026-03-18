#!/usr/bin/env bash
set -euo pipefail

DB_URL="${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/cc}"
ORDER_STORAGE_PATH="${ORDER_STORAGE_PATH:-/var/www/cc/storage/orders}"
SAVED_DRAFTS_STORAGE_PATH="${SAVED_DRAFTS_STORAGE_PATH:-/var/www/cc/storage/saved drafts}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

DATE_TAG="$(date +%F)"
DB_DIR="$BACKUP_ROOT/db"
FILES_DIR="$BACKUP_ROOT/files"

mkdir -p "$DB_DIR" "$FILES_DIR"

PGPASSWORD="${PGPASSWORD:-}" pg_dump "$DB_URL" | gzip > "$DB_DIR/${DATE_TAG}.sql.gz"
tar -czf "$FILES_DIR/${DATE_TAG}.tar.gz" "$ORDER_STORAGE_PATH" "$SAVED_DRAFTS_STORAGE_PATH"

find "$DB_DIR" -type f -mtime +"$RETENTION_DAYS" -delete
find "$FILES_DIR" -type f -mtime +"$RETENTION_DAYS" -delete

echo "Backup completed: $DATE_TAG"

