---
status: accepted
date: 2026-09-13
---

# 002. Both VMs run on Hetzner's CX line, sized cx23, not CPX32/CPX22

## Context

Tech proposal §11/§15 sized vm-app as CPX32-class (4 vCPU / 8 GB, dedicated AMD vCPU) and vm-db as CPX22-class (2 vCPU / 4 GB), at ~€60/month combined, specifically because the cost table (§15) planned against CPX pricing after noting Hetzner's cheaper CX/CAX line had been showing as unavailable to order as recently as early September 2026.

The user chose to run the initial production estate on the cheaper CX line instead, at `cx23` (2 vCPU / 4 GB, shared/burstable Intel vCPU) for **both** VMs, overriding the tech proposal's sizing to cut cost further at launch.

## Decision

- `vm-app` and `vm-db` are both `cx23` (`infra/tofu/servers.tf`).
- vm-db's RAM is unchanged (4 GB either way), so the Postgres tuning in `infra/cloud-init/db.yaml` (ticket 001: `shared_buffers=1GB`, `effective_cache_size=3GB`, `work_mem=16MB`, `max_connections=100`) still applies as-is.
- vm-app drops from 4 vCPU to 2 vCPU. `infra/compose/docker-compose.yml`'s `worker-media` service still declares `cpus: 2` — on a 2-vCPU host that cap is no longer a real throttle (it's a ceiling equal to the whole machine), so it stops doing the job it was added for: leaving headroom for `api`/`web`/`worker-general`/`rabbitmq`/`valkey`/`pgbouncer`/`caddy` on the same box during a transcode. Not fixed here — revisit the compose CPU limits once real transcode load is observed, per the trigger below.

## Rejected alternatives

- **cx32 (app) + cx23 (db)** — keeps the tech proposal's 4vCPU/2vCPU shape while still moving to the cheaper CX line. Rejected by the user in favor of the lower cost of `cx23` for both.
- **Absorb the CPX cost as originally scoped** — tech proposal's own "absorb it" option (§15). Rejected in favor of minimizing spend before revenue exists.

## Consequences

- Lower baseline cost than §15's ~€68-78/month estimate, at the cost of: (a) shared/burstable vCPU instead of dedicated — less predictable performance under sustained load (ffmpeg transcodes are exactly the kind of sustained CPU load CX is weaker at), and (b) half the vCPU on vm-app for the same number of services.
- **Availability risk carried over unresolved**: the tech proposal flagged CX/CAX as sometimes unavailable to order. Verify `cx23` is actually orderable in `nbg1` at apply time — `tofu apply` will simply fail if not, but re-check before assuming this ADR is actionable.
- **Trigger to revisit**: if `media.transcode` queue depth alerts twice in a week (the same trigger tech proposal §11 already names for splitting transcode workers to a third VM), that's the signal this sizing is too small — either upgrade vm-app's server_type or split workers off, rather than tuning compose CPU limits around a permanently undersized box.
- No change to vm-db's Postgres tuning or ticket 001's cloud-init work — RAM is identical between CPX22 and cx23.
