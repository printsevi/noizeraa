# Infrastructure

Two layers, deliberately not three (tech proposal §11.3):

- `tofu/` — OpenTofu owns things that change monthly: servers, network, firewalls, buckets, DNS. See `tofu/README.md` before touching anything here — **nothing in this directory has been applied**.
- `cloud-init/` — brings a fresh VM to "Docker running, SSH hardened, user created" (plus Tailscale and NAT on vm-app) and stops. Referenced by `tofu/servers.tf` via `templatefile()`, not run standalone.
- `compose/` — owns things that change daily: the application containers. The deploy workflow (tech proposal §12) rsyncs this directory to `/opt/noizera/infra/compose` on vm-app and runs it over SSH via Tailscale (ADR 001); `tofu apply` never touches this layer.

Local development does not need any of this: the repo-root `docker-compose.dev.yml` brings up Postgres/RabbitMQ/Valkey for `pnpm dev`. `compose/docker-compose.yml` is deploy-target shaped (GHCR image tags, `.env` from the deploy host) — don't repurpose it for local work.

Postgres and pgBackRest run directly on vm-db's host, not in containers (tech proposal §11); their setup beyond "package installed" is tracked in `docs/tickets/001-vm-db-bootstrap.md`.
