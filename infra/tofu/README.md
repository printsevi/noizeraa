# OpenTofu — Hetzner + Cloudflare estate

**Applied for real since 2026-09-14** — both VMs, the private network, firewalls, DNS records, and the media/backups buckets exist on Hetzner/Cloudflare (see `docs/artefacts/2026-09-12-project-setup.md` §13 for the apply-time bugs and fixes, and `docs/tickets/001`/`002` for what's since been discovered and fixed by hand). Do not run `tofu apply` without the user's explicit go-ahead: it changes real, billed cloud infrastructure and is hard to reverse (tech proposal §0, §15).

## Layout

- `versions.tf` — pinned provider versions (`hcloud`, `cloudflare`, `aws` — the `aws` provider targets Hetzner Object Storage's S3-compatible endpoint, not AWS)
- `main.tf` — provider configuration (the `aws` provider is pointed at Hetzner with path-style addressing and metadata/STS checks disabled)
- `variables.tf` — all inputs; none has a secret default
- `network.tf` — private network, subnet, NAT route for vm-db, firewalls (tech proposal §11; note Hetzner firewalls filter the public interface only)
- `servers.tf` — vm-app, vm-db, the PGDATA volume (tech proposal §11)
- `storage.tf` — media + backups buckets, versioning, lifecycle rules
- `dns.tf` — Cloudflare records: app hostnames (proxied), edge hostname (unproxied, for on-demand TLS), mail SPF/DKIM/DMARC (tech proposal §9, §11.2)
- `outputs.tf` — IPs and bucket names for the deploy workflow
- `terraform.tfvars.example` — the variable list; copy to `terraform.tfvars` (gitignored) or use `TF_VAR_*` env vars

## Bootstrap order (tech proposal §11.3)

Object storage and DNS first, then network and firewalls, then servers — apply in that dependency order the first time rather than everything at once, so a partial failure is easy to reason about. cloud-init (see `../cloud-init/`) brings a VM to "Docker running, SSH hardened, user created" and stops; it does not deploy the application.

vm-app must exist and have finished cloud-init (NAT service up) **before** vm-db is created — vm-db has no public IP and its cloud-init reaches apt/PGDG through vm-app. `servers.tf` encodes that with `depends_on`, but a manual `-target` apply has to respect it too.

One-time manual steps after the first apply (not automatable from here):

1. On vm-app: `tailscale up --advertise-tags=tag:server` with an auth key from the Tailscale admin console (ADR 001) — **done** (2026-09-27); the tailnet's ACL needed a `tagOwners` entry for `tag:server`/`tag:ci` added first (a new tailnet signup starts with no tags defined).
2. On vm-app: place `/opt/noizera/age.key` (0600, owner `deploy`) and `/opt/noizera/infra/compose/.env.enc`. The `.env` this decrypts to must set `DATABASE_URL=postgres://noizera:<db_app_password>@pgbouncer:6432/noizera` and `DB_PASSWORD=<db_app_password>` — the same value as the `db_app_password` tofu var, kept in sync by hand (docs/tickets/001-vm-db-bootstrap.md). — **`age.key` is placed** (2026-09-27, a fresh keypair — see ticket 002); **`.env.enc` is still not provisioned**, which also blocks `docker compose up` for the app stack.
3. Cloudflare Origin Certificate for Caddy: `docs/tickets/002-caddy-origin-cert.md`. — **cert generated, encrypted, and provisioned to vm-app**; the compose config referencing it is synced, but Caddy hasn't been restarted to pick it up yet (blocked on the same `.env`/image gap as above), and the Cloudflare Full (Strict) flip is still open — see the ticket.

vm-db's cloud-init (`../cloud-init/db.yaml`) was _supposed_ to do the rest of ticket 001 itself, but on the real apply its `runcmd` hit a DNS failure partway through boot (the private network wasn't up yet — the same interface-timing issue described below for vm-app) and silently skipped everything from the `apt-get install postgresql-17 pgbackrest` line onward. This was found and fixed by hand on 2026-09-27 (ticket 001's status note has the full remediation) — Postgres is now installed, tuned, and verified working, including a live pgBackRest check. If either VM is ever rebuilt from scratch, expect to hit this same class of bug again unless `db.yaml`/`app.yaml` gain an explicit wait-for-network step before their first `apt-get update`.

Also found and fixed by hand on 2026-09-27: vm-app's own private-network interface (`enp7s0`) came up with no IP at all after the real apply — likely the network attachment landed slightly after `cloud-init`'s one-time network detection at first boot. A reboot let `cloud-init`/netplan re-detect it correctly; nothing in `app.yaml` needed to change. Symptom was a hard-to-diagnose one: ICMP (ping) to vm-db worked the whole time, while TCP (SSH, Postgres) silently timed out, because traffic was falling back to the public interface for a private-range destination — don't rule out a private-network routing gap just because ping succeeds.

What's confirmed working now (was ticket 001's "still needs verifying" list):

- The volume device path (`/dev/disk/by-id/scsi-0HC_Volume_<id>`) was correct — `var-lib-postgresql-17-main.mount` mounted cleanly (after clearing a stray `lost+found` left by `mkfs.ext4`, which blocked `initdb`).
- `psql`/Postgres access from vm-app over the private IP works; unreachable from anywhere else (`ufw`/`pg_hba` both confirmed correct).
- `pgbackrest --stanza=noizera check` passes — WAL archiving to the backups bucket over the NAT path confirmed live.
- `docker compose run --rm api node dist/migrate.js` is still blocked until `dist/migrate.js` exists (ticket 003) — this remains the one item not yet done.

## State

Per tech proposal §11.3: **local state, encrypted with SOPS + age, committed to the repo** — not a remote backend. This is a one-operator decision; revisit (a real backend with locking) the day a second engineer joins. `terraform.tfstate` exists locally (gitignored, plaintext) from the real applies since 2026-09-14, but has never gone through the SOPS-encrypt-and-commit step — that only happens inside `infra-apply.yml`, which has never run for real (no CI workflow has). Never commit plaintext state — it contains resource IDs and can contain secrets.

## Before applying anything for real

- Both VMs are `cx23` (ADR 002), not the CPX32/CPX22 the tech proposal originally sized — Hetzner's CX/CAX line has been flaky to order (tech proposal §15); re-check `cx23` is actually available in `nbg1` before applying.
- Hetzner Object Storage's conditional-write support isn't confirmed against the `aws_s3_bucket*` resources used here — verify before depending on versioning/lifecycle behaving exactly like AWS S3 (tech proposal §11.3).
- Brevo's actual MX target and DKIM value (placeholders in `dns.tf`) come from Brevo's sending-domain setup, not from guessing.
