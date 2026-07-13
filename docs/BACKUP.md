# Database Backup & Restore Guide

## Automatic daily backups (recommended)

On the VPS host, add a cron job:

```bash
crontab -e
```

```
0 2 * * * cd /opt/it-inventory-portal && docker compose exec -T db pg_dump -U inventory it_inventory | gzip > backend/backups/db-$(date +\%F).sql.gz && ls -1t backend/backups/db-*.sql.gz | tail -n +31 | xargs -r rm
```

This keeps 30 daily backups in `backend/backups/`.

## Manual backup

```bash
docker compose exec -T db pg_dump -U inventory it_inventory | gzip > backup.sql.gz
```

## Restore

```bash
gunzip -c backup.sql.gz | docker compose exec -T db psql -U inventory -d it_inventory
```

For a clean restore, recreate the database first:

```bash
docker compose exec db psql -U inventory -d postgres -c "DROP DATABASE it_inventory; CREATE DATABASE it_inventory;"
gunzip -c backup.sql.gz | docker compose exec -T db psql -U inventory -d it_inventory
```

## Uploaded files

Invoices, warranty documents and acknowledgement PDFs live in the `uploads` Docker volume. Back them up with:

```bash
docker run --rm -v it-inventory-portal_uploads:/data -v $(pwd):/backup alpine \
  tar czf /backup/uploads-$(date +%F).tar.gz -C /data .
```

## Off-site copies

Sync `backend/backups/` and the uploads archive to remote storage (e.g. `rclone` to OneDrive/SharePoint, or `scp` to a second server). Test a restore at least quarterly.
