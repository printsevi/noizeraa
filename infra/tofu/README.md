# OpenTofu — Hetzner + Cloudflare estate

Scaffolding only. **Nothing here has been applied** — no VM, network, bucket, or DNS record from this directory exists yet, and no `tofu init`/`plan`/`apply` has been run in this environment. Do not run `tofu apply` without the user's explicit go-ahead: provisioning real cloud infrastructure is billed and hard to reverse (tech proposal §0, §15).

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

1. On vm-app: `tailscale up --advertise-tags=tag:server` with an auth key from the Tailscale admin console (ADR 001).
2. On vm-app: place `/opt/noizera/age.key` (0600, owner `deploy`) and `/opt/noizera/infra/compose/.env.enc`.
3. On vm-db: everything in `docs/tickets/001-vm-db-bootstrap.md`.
4. Cloudflare Origin Certificate for Caddy: `docs/tickets/002-caddy-origin-cert.md`.

## State

Per tech proposal §11.3: **local state, encrypted with SOPS + age, committed to the repo** — not a remote backend. This is a one-operator decision; revisit (a real backend with locking) the day a second engineer joins. No `.tfstate` exists in this repo yet; when one does, it must be SOPS-encrypted before it's committed. Never commit plaintext state — it contains resource IDs and can contain secrets.

## Before applying anything for real

- Hetzner's CPX/CAX server-type availability has been flaky (tech proposal §15) — re-check availability first.
- Hetzner Object Storage's conditional-write support isn't confirmed against the `aws_s3_bucket*` resources used here — verify before depending on versioning/lifecycle behaving exactly like AWS S3 (tech proposal §11.3).
- Brevo's actual MX target and DKIM value (placeholders in `dns.tf`) come from Brevo's sending-domain setup, not from guessing.
