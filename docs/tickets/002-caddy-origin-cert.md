---
status: open
module: infra
---

# Caddy behind Cloudflare: Origin Certificate + Full (Strict)

## Problem / motivation

`noizera.com` and `www` are orange-clouded (`infra/tofu/dns.tf`), so Caddy can't complete an HTTP-01 challenge for them — the challenge hits Cloudflare's edge, not Caddy. Tech proposal §11.2 consequence 1 names the fix (a Cloudflare Origin Certificate on Caddy with Full (Strict) mode) but nothing in the scaffold does it. As written, the first deploy serves `noizera.com` with a failed cert and Cloudflare's 526.

## Scope

In:

- Generate a Cloudflare Origin CA cert (15-year, RSA or ECDSA) for `noizera.com, *.noizera.com`; store the key SOPS-encrypted; provision to `/opt/noizera/certs/` on vm-app by the same manual step as `.env.enc`
- `Caddyfile`: `tls /certs/origin.pem /certs/origin.key` on the `noizera.com, www.noizera.com` site block only; the `https://` on-demand block for customer domains stays ACME (those hostnames are never proxied — `edge.noizera.com`)
- Cloudflare zone SSL mode → Full (Strict); managed via Tofu (`cloudflare_zone_settings_override`) so it's not a console click
- Optionally restrict vm-app's 80/443 firewall rules to Cloudflare's published IP ranges (proposal §11.2 "origin IP concealment") — decide here; the custom-domain path needs 80/443 open to the world for HTTP-01, so this may be a no

Out: DNS-01 via a Caddy Cloudflare module build (more moving parts than a 15-year cert).

## Seams

Infra — `curl -sI https://noizera.com` returns 200 through Cloudflare; `curl --resolve` straight to the origin IP with the Origin CA root trusted also returns 200; a test custom domain CNAMEd to `edge.noizera.com` gets a Let's Encrypt cert on first request once `/internal/tls/allow` (ticket 004) says yes.

## Open questions

- Whether the `_acme` records the proposal's §11.3 layout mentions are needed at all once this is the approach (probably not — they'd only matter for DNS-01).

## Done when

Both curls above pass and the SSL mode is in Tofu state.
