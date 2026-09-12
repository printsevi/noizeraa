---
status: accepted
date: 2026-09-12
---

# 001. CI and admin SSH reach vm-app over Tailscale, not the public interface

## Context

Tech proposal §11 restricts public SSH on vm-app to the operator's IP ("SSH by key, restricted to your IP plus a fallback") and §12 has GitHub Actions SSH-deploying to vm-app. Those two are incompatible as written: GitHub-hosted runners have no stable IP, so the deploy job would be firewalled out. The proposal already suggested Tailscale as "worth the ten minutes if you administer from more than one place" but didn't make it part of the design.

Alternatives considered:

- **Punch the runner's IP into the Hetzner firewall around each deploy** via the hcloud API. Works, but puts a mutable firewall rule on the deploy path, races between concurrent runs, and leaves a hole open if a job is cancelled mid-way.
- **Self-hosted runner on vm-app.** Removes the network problem by moving CI onto the production host — the wrong direction for isolation, and a second thing to keep patched.
- **Open 22 to GitHub's published IP ranges.** Thousands of addresses shared with every other Actions user; not meaningfully better than open.

## Decision

- vm-app joins a Tailscale tailnet as `tag:server` (installed by cloud-init, joined once by hand with an auth key).
- The deploy job joins as an ephemeral node tagged `tag:ci` using an OAuth client (`TS_OAUTH_CLIENT_ID` / `TS_OAUTH_SECRET` secrets) via `tailscale/github-action`.
- Tailnet ACL: `tag:ci → tag:server:22` only. Nothing else on the tailnet can reach vm-app, and `tag:ci` can reach nothing else.
- Public port 22 stays open **only** to `admin_ip` as break-glass, so a tailnet outage can't lock the operator out of the only VM. It is never opened to CI.
- The tailnet is a **new signup** for this project (no existing account), on the free personal plan — record it in the account inventory.

## Rejected alternatives

See Context. Kamal/Dokploy-style deploy tools (proposal §12) would face the same network question and were not the point of this decision.

## Consequences

- Tailscale becomes a subprocessor: its coordination server sees node keys, tailnet IPs and connection metadata — never traffic (WireGuard end-to-end). Add it to the §14 subprocessor list alongside Brevo, Stripe, Grafana Cloud.
- One more one-time manual step in the bootstrap (join the tailnet), documented in `infra/tofu/README.md`.
- If Tailscale is ever removed, the fallback is the break-glass rule plus option 1 above; nothing in the compose or app layer depends on it.
- `VM_APP_TAILSCALE_HOST` (the MagicDNS name or tailnet IP) replaces `VM_APP_HOST` in the workflow secrets.
