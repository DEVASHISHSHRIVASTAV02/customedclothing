# Backup and Restore Runbook

## Daily backup (cron)
Add this entry on VPS (example runs every day at 2:10 AM):

```
10 2 * * * cd /var/www/cc && npm run backup:run >> /var/log/cc-backup.log 2>&1
```

Optional overrides for storage paths:

```
ORDER_STORAGE_PATH=/var/www/cc/storage/orders
SAVED_DRAFTS_STORAGE_PATH="/var/www/cc/storage/saved drafts"
STORAGE_ROOT_PATH=/var/www/cc/storage
BACKUP_ROOT=/var/backups/cc
RETENTION_DAYS=14
```

## Monthly restore validation
1. Copy latest DB and files archives to a staging environment.
2. Set staging `DATABASE_URL` and `STORAGE_ROOT_PATH`.
3. Run:

```
npm run restore:run -- /var/backups/cc/db/YYYY-MM-DDTHH-mm-ssZ.json.gz /var/backups/cc/files/YYYY-MM-DDTHH-mm-ssZ.tar.gz --force
```

4. Validate:
- app boots with restored data
- latest orders visible in `/admin/orders`
- uploaded/exported assets resolve from `/api/storage/...`

## Retention
- default retention is 14 days (`RETENTION_DAYS=14`)
- update environment variable if policy changes

