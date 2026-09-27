---
status: in-progress
module: infra
---

# Caddy behind Cloudflare: Origin Certificate + Full (Strict)

## Problem / motivation

`noizera.com` and `www` are orange-clouded (`infra/tofu/dns.tf`), so Caddy can't complete an HTTP-01 challenge for them — the challenge hits Cloudflare's edge, not Caddy. Tech proposal §11.2 consequence 1 names the fix (a Cloudflare Origin Certificate on Caddy with Full (Strict) mode) but nothing in the scaffold does it. As written, the first deploy serves `noizera.com` with a failed cert and Cloudflare's 526.

## Scope

In:

- Generate a Cloudflare Origin CA cert (15-year, RSA or ECDSA) for `noizera.com, *.noizera.com`; store the key SOPS-encrypted; provision to `/opt/noizera/certs/` on vm-app by the same manual step as `.env.enc` — **still manual, not done from here** (see "Remaining" below)
- `Caddyfile`: `tls /certs/origin.pem /certs/origin.key` on the `noizera.com, www.noizera.com` site block only; the `https://` on-demand block for customer domains stays ACME (those hostnames are never proxied — `edge.noizera.com`) — **done**
- Cloudflare zone SSL mode → Full (Strict); managed via Tofu (`cloudflare_zone_settings_override`, `dns.tf`) so it's not a console click — **done in source; not yet applied to the live zone**
- Optionally restrict vm-app's 80/443 firewall rules to Cloudflare's published IP ranges (proposal §11.2 "origin IP concealment") — **decided: no**, and recorded as a comment on `hcloud_firewall.app` in `network.tf`. The custom-domain path needs 80/443 open to the world for HTTP-01 from Let's Encrypt's validators, which don't originate from Cloudflare's ranges.

Out: DNS-01 via a Caddy Cloudflare module build (more moving parts than a 15-year cert).

## Remaining (manual, needs the user — credentials never go through chat)

Order matters: the cert must land on vm-app (step 3) **before** the Full (Strict) flip (step 5), or Cloudflare gets a TLS failure against the origin and the site 526s until the cert catches up.

1. **Generate the cert in Cloudflare.** Dashboard → your zone → SSL/TLS → Origin Server → **Create Certificate**. Key type RSA (2048) or ECDSA — either works with Caddy. Hostnames `noizera.com, *.noizera.com`. Validity 15 years. Save the two blocks Cloudflare shows to local files: "Origin Certificate" → `origin.pem`, "Private Key" → `origin.key`. Neither should be pasted into a chat session. — **done** (2026-09-23)

2. **Encrypt `origin.key`** with the same age keypair that protects `.env.enc` (you'll need the private age key file, or its derived public key):

   ```
   age-keygen -y age.key          # prints the public key, safe to share
   sops --encrypt --age <public key> --input-type binary --output-type binary origin.key > origin.key.enc
   ```

   `origin.pem` is public and travels unencrypted; `origin.key.enc` is the only sensitive artifact leaving your machine. — **done** (2026-09-23); the original age keypair from the first tofu-apply session (2026-09-14) wasn't recoverable, so a fresh keypair was generated for this and everything downstream. Nothing had been encrypted with the old one yet (no `.env.enc`, no `terraform.tfstate.enc` existed), so nothing was lost. The `SOPS_AGE_KEY`/`SOPS_AGE_PUBLIC_KEY` GitHub repo secrets are set from the new keypair; the private half lives only in the user's local `age.key`, backed up outside the repo.

3. **Provision both files to vm-app** over Tailscale, the same channel used for `age.key`/`.env.enc`:

   ```
   scp origin.pem origin.key.enc deploy@<vm-app-tailscale-host>:/tmp/
   ssh deploy@<vm-app-tailscale-host>
   sudo mkdir -p /opt/noizera/certs
   sudo mv /tmp/origin.pem /opt/noizera/certs/origin.pem
   SOPS_AGE_KEY_FILE=/opt/noizera/age.key sops -d --input-type binary --output-type binary /tmp/origin.key.enc | sudo tee /opt/noizera/certs/origin.key > /dev/null
   sudo chmod 644 /opt/noizera/certs/origin.pem
   sudo chmod 600 /opt/noizera/certs/origin.key
   rm /tmp/origin.key.enc
   ```

   — **done** (2026-09-23); this was also the first secret provisioned to vm-app at all, so `age.key` itself went up alongside the cert files (same channel, same step).

4. **Sync the updated compose config and restart Caddy** so it picks up the new `/certs` volume mount and `tls` directive — via the normal CI deploy, or a manual rsync of `infra/compose/` to `/opt/noizera/infra/compose` followed by:

   ```
   docker compose up -d --no-deps --wait caddy
   ```

   — **partially done**: the compose config is synced to `/opt/noizera/infra/compose` on vm-app, but `docker compose up` has **not** been run — `docker compose config` fails because every service references `env_file: ../../.env`, which doesn't exist yet (that's `.env.enc`'s decrypted form, out of scope for this ticket), and separately no CI run has ever pushed the `api`/`web` images to GHCR for `docker compose up` to pull. This step is blocked on those two things, tracked outside this ticket (ticket 003 and the CI/CD gap noted in `CLAUDE.md`).

5. **Flip Cloudflare to Full (Strict).** From `infra/tofu`, with real `terraform.tfvars`:

   ```
   tofu plan     # should show only cloudflare_zone_settings_override.main being added
   tofu apply
   ```

   This is the one step Claude Code's guard-bash hook refuses to run — always user-run. — **not done**; also blocked behind step 4, since flipping to Full (Strict) before Caddy is actually serving the cert would 526 the site.

6. **Verify:**
   ```
   curl -sI https://noizera.com
   curl -sI --resolve noizera.com:443:<vm-app-public-ip> https://noizera.com --cacert <cloudflare-origin-root-ca>
   ```
   Both should return 200; check against "Seams" below. — **not done**, blocked behind steps 4–5.

## Seams

Infra — `curl -sI https://noizera.com` returns 200 through Cloudflare; `curl --resolve` straight to the origin IP with the Origin CA root trusted also returns 200; a test custom domain CNAMEd to `edge.noizera.com` gets a Let's Encrypt cert on first request once `/internal/tls/allow` (ticket 004) says yes.

## Open questions

- ~~Whether the `_acme` records the proposal's §11.3 layout mentions are needed at all once this is the approach~~ — resolved: no, they're DNS-01 only and this ticket uses an Origin CA cert instead.

## Done when

Both curls above pass and the SSL mode is in Tofu state — the Tofu/Caddy/Compose source side is done; the live-zone flip and cert provisioning (steps 1–5 above) are still open and require the user.
