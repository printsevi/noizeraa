---
status: open
module: infra
---

# Backups beyond pgBackRest: originals off-bucket copy, restore verification, snapshots

## Problem / motivation

Tech proposal §11 "Backups" is a table with five rows; ticket 001 covers only the first (pgBackRest). The asymmetry it insists on — renditions are disposable, **an artist's unreleased master is not recoverable and losing one is a trust event the company does not survive** — is not implemented anywhere: bucket versioning is on (`storage.tf`) but there is no second-location copy of originals, no restore verification, and no VM snapshot schedule.

## Scope

In:

- Weekly `rclone sync` of the `originals/` prefix from the media bucket to a Hetzner Storage Box (second location, 90-day retention) — a `worker-general` cron or a systemd timer on vm-app; credentials in `.env.enc`
- Monthly automated restore verification: pgBackRest restore into a scratch Postgres container on vm-app, checksum a known row, report to the §13 alert channel; failure = alert 7
- Hetzner snapshot schedule for both VMs: weekly, keep 4 — via Tofu if the provider supports scheduling, otherwise a documented `hcloud` CLI cron
- Renditions lifecycle rule already exists (`storage.tf`, 30 days) — confirm Hetzner honours `aws_s3_bucket_lifecycle_configuration` on the first apply (README caveat)

Out: cross-provider DR; multi-region (deliberately not built, §17).

## Seams

Infra — a deliberately deleted test original is recoverable from the Storage Box copy; the monthly restore job has run green at least once before launch.

## Open questions

- Storage Box vs. a second Hetzner Object Storage bucket in another location: the proposal says Storage Box; check pricing at the time of provisioning.

## Done when

All three "In" items are scheduled and have each completed one successful run with evidence in the alert channel.
