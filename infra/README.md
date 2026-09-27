# Infrastructure

Two layers, deliberately not three (tech proposal §11.3):

- `tofu/` — OpenTofu owns things that change monthly: servers, network, firewalls, buckets, DNS. See `tofu/README.md` before touching anything here — **applied for real since 2026-09-14**; both VMs and the rest of the estate exist.
- `cloud-init/` — brings a fresh VM to "Docker running, SSH hardened, user created" (plus Tailscale and NAT on vm-app) and stops. Referenced by `tofu/servers.tf` via `templatefile()`, not run standalone. On the real apply, both VMs' `runcmd` hit a network-timing bug (private interface not up yet) that silently skipped later steps — see `tofu/README.md` and `docs/tickets/001` for what that broke and how it was fixed by hand.
- `compose/` — owns things that change daily: the application containers, plus `docker-compose.admin.yml` for Tailscale-only ops tooling (pgAdmin — `docs/tickets/009`), which is deliberately separate from the deploy pipeline. The deploy workflow (tech proposal §12) rsyncs the main compose file to `/opt/noizera/infra/compose` on vm-app and runs it over SSH via Tailscale (ADR 001); `tofu apply` never touches this layer. No CI deploy has run for real yet — `docker compose up` for the app stack is blocked on `.env`/`.env.enc` provisioning and on images actually existing in GHCR.

Local development does not need any of this: the repo-root `docker-compose.dev.yml` brings up Postgres/RabbitMQ/Valkey for `pnpm dev`. `compose/docker-compose.yml` is deploy-target shaped (GHCR image tags, `.env` from the deploy host) — don't repurpose it for local work.

Postgres and pgBackRest run directly on vm-db's host, not in containers (tech proposal §11); their setup is now confirmed working end to end (bootstrapped by hand on 2026-09-27 after cloud-init's `runcmd` partially failed) — see `docs/tickets/001-vm-db-bootstrap.md`.
