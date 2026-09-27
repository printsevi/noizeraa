---
status: done
module: infra
---

# pgAdmin for vm-db, reachable over Tailscale only

## Problem / motivation

vm-db has no public IP and Postgres is reachable only from vm-app's private IP (`10.0.0.10`, per `pg_hba.conf` and vm-db's `ufw` rules — `infra/cloud-init/db.yaml`). There's no way to browse/query the database short of a raw `psql` session over an SSH hop. A GUI admin tool is useful, but per ADR 001's existing pattern (admin/CI access over Tailscale, not the public interface), it should never be exposed publicly — a DB admin UI is a much bigger attack surface than the SSH access ADR 001 already restricts.

## Scope

In:

- `infra/compose/docker-compose.admin.yml`: a standalone Compose file (not part of `docker-compose.yml`, not touched by the CI deploy workflow) running `dpage/pgadmin4`, port-bound to vm-app's own Tailscale IP only (`${TAILSCALE_IP}:5050:80`) — never `0.0.0.0`, never proxied through Caddy/Cloudflare
- pgAdmin's own login credentials via a gitignored `.env.admin.local` on vm-app (never committed, never sent through chat)
- The Postgres connection itself (host `10.0.0.20`, db/role `noizera`) registered by hand inside the pgAdmin UI after first login, password typed there directly — never stored in the compose file, tfvars, or anywhere in the repo

Out: public/Cloudflare-fronted pgAdmin (would need its own subdomain, DNS record, Caddy site block, Origin CA cert like `noizera.com`'s, and hardened pgAdmin-side auth — rejected as unnecessary attack surface for a DB admin tool); any change to vm-db's `pg_hba.conf`/`ufw` (already permits vm-app's private IP, which is where this container runs).

## Seams

Infra — from a device joined to the tailnet, `http://<vm-app-tailscale-ip>:5050` serves the pgAdmin login page; from any other network, the port is unreachable (no route, not just a blocked firewall port).

## Open questions

None currently — deviation from a public-facing setup was confirmed with the user directly (2026-09-27) rather than via a full `grill-me` session, since this is ops tooling, not a gated product feature.

## Done when

`docker compose -f docker-compose.admin.yml --env-file .env.admin.local up -d` runs cleanly on vm-app, pgAdmin is reachable at `http://<vm-app-tailscale-ip>:5050` from a tailnet-joined device, is unreachable from the public internet, and a registered connection to `10.0.0.20`/`noizera` succeeds.
