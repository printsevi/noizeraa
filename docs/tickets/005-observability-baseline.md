---
status: open
module: infra
---

# Observability baseline: structured logs, metrics, errors, the seven alerts

## Problem / motivation

Tech proposal §13 lists the day-one alerts (DLQ depth, transcode queue depth/age, p95 transcode latency, listener-flow 5xx rate, disk/S3 usage, bounce/complaint rate, failed backup) and the tooling (pino + prom-client + OTel → Grafana Cloud free, GlitchTip or Sentry, Uptime Kuma or Better Stack). None of it is scaffolded; `cloud-init/app.yaml` explicitly leaves node_exporter out. Without at least correlation IDs and the DLQ alert, "solo debugging is misery" (§13) and a silently filling DLQ is the classic outage.

## Scope

In:

- `apps/api`: pino logger with `message_id` / `correlation_id` propagation through HTTP headers and AMQP message headers; JSON to stdout (Docker collects)
- OTel SDK in `apps/api` exporting traces/metrics to Grafana Cloud (OTLP); Grafana Alloy or the OTel collector as a compose service on vm-app shipping container logs
- node_exporter on both VMs (cloud-init) scraped by the same collector
- Error tracking: pick GlitchTip self-hosted vs Sentry free (proposal leaves both open) — GlitchTip is one more container + its own Postgres DB; Sentry free is zero ops but a US processor in the GDPR list. Decide in grill-me.
- The seven §13 alerts as Grafana alert rules, committed as code (Tofu `grafana` provider, or JSON in `infra/observability/`)
- Uptime check on `/healthz` and `/l/<known-token>` from outside

Out: dashboards beyond the alert rules; product analytics (ticket 007).

## Seams

Infra — each alert has a documented way to trigger it in staging-less production (e.g. publish a poison message to a DLQ) and was fired once on purpose.

## Open questions

- Grafana Cloud free tier limits vs. log volume from two `api` replicas + workers — check before shipping every request log line.

## Done when

Correlation IDs appear in every log line for a request that crosses HTTP → outbox → consumer; all seven alerts exist and have been test-fired.
