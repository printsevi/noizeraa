---
status: open
module: infra
---

# Umami product analytics (cut-list item)

## Problem / motivation

Tech proposal §1/§13 suggests self-hosted Umami (MIT) for product analytics. The original compose scaffold had an `umami` service sharing the app's `env_file`, which would have pointed it at the app's `DATABASE_URL` and created its tables inside the product database, with no Caddy route to reach it — so it was removed. §16 puts Umami on the cut list ("the cut list, in order: Instagram follower verification, the 96k ABR rendition, Umami, the public card's design polish"). This ticket exists so the removal isn't mistaken for a decision against Umami.

## Scope

In (when scheduled):

- Its own Postgres database (`umami`) on vm-db with its own role; `DATABASE_URL` for Umami comes from a separate `umami.env.enc`, never the app's `.env`
- Caddy route (`analytics.noizera.app` or `/umami/*` behind an auth guard) — decide; DNS record in `dns.tf`
- Script tag only on the artist workspace and public card, never on the listener flow (`/l/[token]` has a 150 KB JS budget and a three-minute attention budget, §10)
- GDPR: Umami is cookieless; still list it in the record of processing

Out: replacing it with Plausible/PostHog (both fail the licence rule, §1).

## Seams

Infra — a page view on `/a/<slug>` appears in the Umami dashboard; a listener-flow page load makes no request to the analytics host.

## Open questions

- Whether product analytics is wanted before Gate 2 at all, given the kill criteria are measured from the app's own tables (§7 "instrument repeat-participation rate in week 8").

## Done when

Deployed with the isolation above, or explicitly closed as "not before Gate 2".
