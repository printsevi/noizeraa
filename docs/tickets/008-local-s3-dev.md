---
status: open
module: infra
---

# Local S3-compatible store for `docker-compose.dev.yml`

## Problem / motivation

`docker-compose.dev.yml` brings up Postgres, RabbitMQ and Valkey but nothing S3-compatible, so the upload pipeline (tech proposal §5 — presigned multipart, `HEAD` for the real byte count, quota enforcement after upload) has nothing to develop or integration-test against locally. Needed the week `media` starts (build week 2), not before.

## Scope

In:

- Add a LocalStack community (Apache-2.0) service exposing S3 on `:4566`, or SeaweedFS (Apache-2.0) with its S3 gateway — **not MinIO**, which is AGPL and fails the proposal's permissive-licence rule even for dev tooling by the letter of §0
- `.env.example`: `S3_ENDPOINT=http://localhost:4566`, `S3_FORCE_PATH_STYLE=true`, a dummy key pair, `S3_BUCKET=noizera-media-dev`
- A one-shot init container or `pnpm` script that creates the bucket
- Testcontainers equivalent for the `media` repository/integration tests (LocalStack has an official Testcontainers module)

Out: CORS/presign parity testing against real Hetzner — that's a ticket for the first deploy of `media`.

## Seams

Integration — the `media` upload-completion seam (`HEAD` → real bytes → quota decision) runs green against the local store in CI.

## Open questions

- Presigned multipart behaviour differs subtly between LocalStack and real S3-compatible stores; note any divergence found in `docs/tech-debt/`.

## Done when

`pnpm dev` + `docker compose -f docker-compose.dev.yml up` gives a working presigned upload end to end.
