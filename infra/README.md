# Infrastructure

Two layers, deliberately not three (tech proposal §11.3):

- `tofu/` — OpenTofu owns things that change monthly: servers, network, firewalls, buckets, DNS. See `tofu/README.md` before touching anything here — **nothing in this directory has been applied**.
- `cloud-init/` — brings a fresh VM to "Docker running, SSH hardened, user created" and stops. Referenced by `tofu/servers.tf` via `templatefile()`, not run standalone.
- `compose/` — owns things that change daily: the application containers. The deploy workflow (tech proposal §12) runs these via SSH; `tofu apply` never touches this layer.

Local development does not need any of this. `compose/docker-compose.yml` is deploy-target shaped (GHCR image tags, `.env` from the deploy host) — it is not a local dev compose file. A local Postgres/RabbitMQ/Valkey setup for `pnpm dev` hasn't been scaffolded yet; add a `docker-compose.dev.yml` (or equivalent) alongside `apps/`/`packages/` when that's needed, rather than repurposing this deploy-target file.
