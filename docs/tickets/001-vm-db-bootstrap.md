---
status: open
module: infra
---

# vm-db bootstrap: PGDATA on the volume, tuning, pgBackRest, PgBouncer

## Problem / motivation

`infra/cloud-init/db.yaml` stops at "Postgres 17 + pgBackRest packages installed, host firewall up". Tech proposal §11 specifies more, none of it automated yet: PGDATA on the attached Hetzner volume, the 4 GB tuning block, `pg_stat_statements`, pgBackRest with WAL archiving to the backups bucket, and PgBouncer in transaction mode on the app side. Without these the first deploy has a database on the VM disk with default settings and no backups — the "unreleased master is unrecoverable" trust failure in §11 applies to the metadata too.

Also verify the NAT path works end to end (`network.tf` route + `app.yaml` masquerade + `db.yaml` default route) on the first real apply — it is the one piece of the estate that can't be tested locally.

## Scope

In:

- Mount the `pgdata` volume at `/var/lib/postgresql/17/main` (or relocate via `data_directory`), owned by `postgres`, in `fstab`
- `postgresql.conf`: `listen_addresses = '10.0.0.20'`, `shared_buffers=1GB`, `effective_cache_size=3GB`, `work_mem=16MB`, `max_connections=100`, `shared_preload_libraries='pg_stat_statements'`, `archive_mode=on` + pgBackRest `archive_command`
- `pg_hba.conf`: app role from `10.0.0.10/32` only, scram-sha-256
- pgBackRest repo on the backups bucket (S3 type, Hetzner endpoint): weekly full, daily incremental, 30-day retention
- PgBouncer on vm-app (compose service) in transaction mode; `DATABASE_URL` points at it
- Decide scripted vs manual: whatever is done should land as either cloud-init content or a documented, copy-pasteable runbook in `infra/tofu/README.md`

Out: restore verification job (ticket 006), read replica (tech-debt register).

## Seams

Infra — verified by hand on the first apply: `psql` from vm-app over the private IP succeeds, from anywhere else fails; `pgbackrest check` passes; `SHOW data_directory` is on the volume.

## Open questions

- Hetzner volume device naming under Ubuntu 24.04 (`/dev/disk/by-id/scsi-0HC_Volume_<id>`) — confirm on the real VM before writing fstab.

## Done when

All five "In" items are live on vm-db, the runbook (or cloud-init) that produced them is committed, and `docker compose run --rm api node dist/migrate.js` from vm-app succeeds against it.
