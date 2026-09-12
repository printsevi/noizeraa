---
status: open
module: sharing
---

# `/internal/tls/allow` — the on-demand TLS gate for custom domains

## Problem / motivation

`infra/compose/Caddyfile` points `on_demand_tls.ask` at `http://api:3000/internal/tls/allow`. The endpoint doesn't exist. Until it does, on-demand TLS refuses everything (Caddy treats a non-200 as "don't issue"), which is safe — but the moment a Pro/Team customer domain is sold, this endpoint is "the one line in the config that must not be wrong" (tech proposal §11.1): a permissive implementation turns the VM into an open certificate-issuance endpoint and Let's Encrypt rate-limits the whole domain.

## Scope

In:

- `GET /internal/tls/allow?domain=<host>` → `200` iff `<host>` is a **verified** custom domain on an account whose `PlanEntitlements.customDomain` is true; otherwise `403`. No body needed.
- Reachable only from the Docker network (Caddy) — not routed through Caddy's public site blocks; assert that in the Caddyfile (`handle /internal/*` → 404 on the public sites).
- Verification model: a `custom_domains(account_id, hostname, verification_token, verified_at)` row, verified by a TXT record check — ownership belongs to `sharing` (the public card / share surfaces are what a custom domain fronts). If that ownership feels wrong during grill-me, `identity` is the alternative.
- Rate-limit the endpoint per hostname (Valkey) so a flood of unknown hostnames can't make the API do a DB lookup per request.

Out: the customer-facing "add a custom domain" UI (Pro tier, week 9 territory and Gate 1-gated).

## Seams

- API module (`sharing`) public contract: `GET /internal/tls/allow` with a verified domain → 200; unverified / unknown / entitlement missing → 403. Persisted state via the module's application service, not by inserting rows directly.

## Open questions

- Gate 1: this is a product feature dependency, not scaffolding. Build only when the custom-domain feature itself is scheduled; until then Caddy's default-deny holds.

## Done when

The three integration cases pass and a `curl` from the public side of Caddy to `/internal/tls/allow` returns 404.
