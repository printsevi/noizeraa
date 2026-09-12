# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

The **code monorepo skeleton exists but is unimplemented** — `apps/api` is a bare NestJS app with only a `/healthz` endpoint, `apps/web` is a bare Next.js app with a placeholder page, and `packages/{contracts,domain,infra}` are empty export stubs. No dependencies have been installed (`pnpm install` has never been run in this environment) and no feature-level business logic exists yet. `infra/` (OpenTofu + cloud-init + Compose) is scaffolded as source only — **no `tofu apply` has ever been run**, no cloud resources exist.

This scaffold was created ahead of Gate 1 pilot validation, at explicit user direction, to establish the repo shape — it is not itself evidence that Gate 1 has passed. **Before implementing a product feature** (as opposed to tooling/scaffolding work), confirm with the user whether Gate 1 has actually passed; see "What Noizera is" below.

Docs:

- `docs/brief/product-roadmap/noizera-pitch.md` — the business pitch (v3.0)
- `docs/brief/tech-proposal/noizera-technical-overview.md` — the technical implementation plan (v1.0), written as a companion to the pitch — **read this in full before writing any feature code.** It is a detailed, decision-level spec (stack choices with rejected alternatives, data model, sequencing) — not a vague proposal. Treat its "Decided"/"Given" items as settled unless the user says otherwise, and its "Suggested" items as defaults open to revisiting.
- `docs/adrs/`, `docs/specs/`, `docs/tickets/`, `docs/bugs/`, `docs/tech-debt/`, `docs/glossary.md` — see "Doc categories" below.

## Commands

No dependencies are installed yet — run `corepack enable && pnpm install` first (this repo uses pnpm workspaces + Turborepo, pinned via `packageManager` in the root `package.json`).

```bash
pnpm dev                                                       # apps/api + apps/web, via turbo
pnpm build                                                     # all packages, via turbo
pnpm lint                                                      # eslint, all packages
pnpm typecheck                                                 # tsc --noEmit, all packages
pnpm test                                                      # vitest, all packages
pnpm --filter @noizera/api test                                # one package's tests
pnpm --filter @noizera/api test src/health/health.controller.spec.ts   # one file
```

Package names are `@noizera/api`, `@noizera/web`, `@noizera/contracts`, `@noizera/domain`, `@noizera/infra` — match `pnpm --filter` to the `name` field in that package's `package.json`, not the directory name.

`docker-compose.dev.yml` (repo root) brings up local Postgres/RabbitMQ/Valkey for `pnpm dev` — matches `.env.example`'s default URLs. Building `apps/api`/`apps/web`'s Dockerfiles requires `docker build -f apps/api/Dockerfile .` (or `apps/web/Dockerfile`) from the **repo root**, not from inside the app directory — see "CI/CD and Docker" below.

## What Noizera is

A product for independent musicians to test unreleased track versions with real listeners (blind A/B comparisons, segmented by listener role) and get an honest, non-inflated signal on whether a track is ready to release. The business thesis (see pitch) is that the moat is _listener supply_ (an existing music-discovery audience), not the software — the software is closer to table stakes relative to competitors already in market.

**Gate 1.** Per pitch §7–8, a manual, no-code two-week pilot must validate listener supply and decision impact _before_ the nine-week product build begins in earnest. If asked to implement a product feature (panels, listeners, results, billing, etc.), confirm whether Gate 1 has passed. Tooling, scaffolding, and infrastructure setup are not gated the same way.

## Architecture

A **modular monolith**, one engineer, nine-week build, deployed on two Hetzner VMs — deliberately not microservices/Kubernetes.

```
apps/
  api/          NestJS 11 (Node 22) — HTTP + background workers, one image, role selected by APP_ROLE
  web/          Next.js 15 App Router + React 19 (BFF pattern — holds the httpOnly auth cookie, proxies to NestJS)
packages/
  contracts/    Zod schemas + generated OpenAPI types, shared by api & web
  domain/       Entities, value objects, domain events — no framework imports, no Drizzle imports
  infra/        Drizzle schema + repositories, S3 client, AMQP client
```

Backend modules (each owns its own tables, communicates via application services/domain events, never reaches into another module's repositories): `identity`, `catalog`, `media`, `sharing`, `panels`, `listeners`, `responses`, `results`, `billing`, `editorial`, `admin`. None of these exist as Nest modules yet — `apps/api/src` currently has only `app.module.ts` and a `health/` controller; the first real module should be added the same way (its own directory under `src/`, wired into `AppModule`), test-first per the `tdd` skill.

Key stack decisions (see tech proposal §1 and §18 for full rationale/rejected alternatives):

- **DB**: PostgreSQL 17 + Drizzle (typed SQL, not a full ORM — transactions are explicit, repositories map rows to domain objects manually, optimistic concurrency via manual `version` columns)
- **Object storage**: Hetzner S3-compatible storage, EU region — audio bytes never transit the app VM (direct presigned upload, signed-URL/redirect-hop playback)
- **Messaging**: RabbitMQ with a transactional outbox (no direct `channel.publish()` calls anywhere) + idempotent consumers (`processed_messages` table)
- **Cache/locks**: Valkey (Redis fork, license-compliant alternative to Redis SSPL)
- **Auth**: hand-rolled NestJS module — argon2id, rotating refresh tokens with reuse detection for artists; listeners are passwordless (invitation token + session, no user row)
- **Audio**: ffmpeg/ffprobe as subprocess workers; two-pass `loudnorm` to -14 LUFS / -1 dBTP is mandatory on all renditions (loudness-matching bias is called out as the single biggest threat to valid A/B results)
- **Reverse proxy**: Caddy, chosen specifically for on-demand TLS (customer custom domains)
- **IaC**: OpenTofu + cloud-init + Docker Compose (Tofu owns infra that changes monthly; Compose owns app releases — deploys never run `tofu apply`) — scaffolded under `infra/` (`infra/tofu`, `infra/cloud-init`, `infra/compose`, each with its own README); **nothing has been applied** — no real Hetzner/Cloudflare resources exist. Don't run `tofu apply`/`init`/`plan` against real credentials without explicit user go-ahead.

Full component list, data model, sequencing, and the "deliberately not built" list are in the tech proposal (§1–§18) — do not duplicate that content elsewhere; treat it as the source of truth and update it (or add an ADR under `docs/adrs/`) when a decision changes instead of leaving this file and the proposal in conflict.

## CI/CD and Docker

`apps/api/Dockerfile` and `apps/web/Dockerfile` build from the monorepo root using the `turbo prune --docker` pattern (a plain `docker build apps/api` won't work — the workspace needs pruning first). The same `apps/api` image serves `api`, `worker-media`, and `worker-general` via the `APP_ROLE` env var, dispatched in `apps/api/src/main.ts`.

Three GitHub Actions workflows, none of which have ever run for real in this environment:

- **`.github/workflows/ci-cd.yml`** — lint/typecheck/test/e2e on every push and PR; on push to `main` only, after all of those pass: build + push both images to GHCR, then SSH-deploy to vm-app (tech proposal §12's exact sequence). The deploy job will fail until vm-app is actually provisioned and `/opt/noizera/infra/compose/.env.enc` exists on the host — it's scaffolded to match the target design, not tested end to end.
- **`.github/workflows/infra-plan.yml`** — `tofu plan` only, on PRs touching `infra/tofu/**`.
- **`.github/workflows/infra-apply.yml`** — the _only_ place `tofu apply` may run, gated behind manual `workflow_dispatch` + a `production` GitHub environment (configure required reviewers on it in repo settings — the YAML alone doesn't enforce that). Never wire `apply` to an automatic trigger.

Both infra workflows decrypt/re-encrypt `infra/tofu/terraform.tfstate.enc` with SOPS+age around `tofu init` (tech proposal §11.3's local-state decision means CI has to carry state across runs itself, not rely on a remote backend) — the apply workflow commits the re-encrypted state back to the repo after applying.

Secrets these workflows expect (none are configured yet): `HCLOUD_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `HETZNER_S3_ACCESS_KEY`, `HETZNER_S3_SECRET_KEY`, `DEPLOY_SSH_PUBLIC_KEY`, `ADMIN_IP`, `SOPS_AGE_KEY` (private), `SOPS_AGE_PUBLIC_KEY`, `VM_APP_HOST`, `VM_APP_SSH_USER`, `VM_APP_SSH_KEY`. `GITHUB_TOKEN` (for GHCR push) is automatic.

## Non-obvious constraints worth internalizing

- **Blindness is enforced by the data model, not the UI**: listener-facing responses map real version IDs to per-session opaque aliases; no real filename/label/version ID may ever reach the listener's browser, an error message, or a `Content-Disposition` header.
- **No composite "readiness" score.** This is a deliberate product differentiator (see pitch §5.4 vs. competitor "AI Release Readiness Score"). Never add an aggregate score column/field — always render raw counts with denominators, and suppress segments below n=5.
- **Storage quota is enforced post-upload**, not from a client-declared size (uploads are presigned direct-to-bucket, so real byte count is only known via a completion callback / `HEAD` on the object).
- **Listener fatigue caps are a hard product requirement**, not a nice-to-have — pitch names listener pool burnout as a critical, unrecoverable risk.

## Doc categories

Beyond the pitch and tech proposal, `docs/` has a folder per kind of working document — each has its own `README.md` (and most a `TEMPLATE.md`) with the exact convention:

- `docs/adrs/` — architecture decision records: reversals or refinements of tech-proposal decisions, or new decisions it didn't anticipate.
- `docs/specs/` — resolved, feature-level designs (typically the output of a `grill-me` session), written down before the `tdd` loop starts on a non-trivial feature.
- `docs/tickets/` — units of planned work, one file per ticket, status in frontmatter.
- `docs/bugs/` — found defects and their regression tests.
- `docs/tech-debt/` — known shortcuts, each with an explicit trigger condition for revisiting (seeded with the ones the tech proposal already named).
- `docs/glossary.md` — shared domain vocabulary, so tickets/ADRs/tests/code all name the same concepts the same way.

## Workflow skills

Two project skills live under `.claude/skills/`:

- **`grill-me`** — run this before implementing any feature. It's a round-based, adversarial interrogation (design tree / frontier, per round) that checks a proposed plan against the settled decisions above and in the tech proposal, then questions scope, data-model fit, failure modes, privacy surface, statistical honesty, testability, and reversibility. It ends only when the user has confirmed a shared understanding — it does not write code.
- **`tdd`** — the implementation workflow once `grill-me` has cleared a plan: tests only at pre-agreed public seams, strict red-green-refactor (refactoring is a separate pass, not part of the loop), with test levels mapped to the tech proposal's stack (Vitest unit tests for `packages/domain`, Testcontainers integration tests for repositories/API modules, Playwright for the listener flow only).

Default sequence for a new feature: `grill-me` first, then a ticket under `docs/tickets/` if it's non-trivial, then `tdd`.
