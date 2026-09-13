---
status: done
module: infra
---

# Drizzle config and the advisory-locked migration runner

## Problem / motivation

The deploy workflow runs `docker compose run --rm api node dist/migrate.js` (tech proposal §12) and `packages/infra` has a `db:generate` script — but there is no `drizzle.config.ts`, no `migrate.ts`, no migrations directory, and no `pg_advisory_lock` wrapper. This is the first thing week 1 of the build needs and the deploy job fails without it.

## Scope

In:

- `packages/infra/drizzle.config.ts`: dialect `postgresql`, schema glob `src/*/schema.ts` (per-module schema files, matching the `@noizera/infra/<module>` layout), out `packages/infra/drizzle/`
- `apps/api/src/migrate.ts` → `dist/migrate.js`: opens one connection, `SELECT pg_advisory_lock(<constant>)`, runs `drizzle-orm/node-postgres/migrator` against the committed SQL, unlocks, exits non-zero on failure. Two concurrent deploys serialise instead of racing.
- The `shared/` schema for infrastructure tables the proposal names: `outbox_messages`, `processed_messages`, `audit_log` (§4) — these are module-agnostic and belong in `packages/infra/src/shared/schema.ts`
- CI: a job step that runs `drizzle-kit generate` and fails if it produces a diff (schema and committed SQL drifted)
- Rule from §3.2 enforced by the Claude hook: `drizzle-kit push` is blocked (already in `.claude/hooks/guard-bash.mjs`)

Out: any module's tables (each module's ticket owns its schema).

## Seams

- Integration (Testcontainers Postgres): running the migrator twice is idempotent; a second migrator started while the first holds the lock waits and then finds nothing to do.

## Open questions

- ~~Whether `migrate.ts` lives in `apps/api` (as §12's command implies) or `packages/infra` with a thin bin in the api image.~~ Resolved: the advisory-locked `runMigrations()` logic lives in `packages/infra/src/shared/migrate.ts` (tested there via Testcontainers); `apps/api/src/migrate.ts` is a thin CLI wrapper that reads `DATABASE_URL`, calls it, and sets the exit code.
- `processed_messages`' PK is `(message_id, consumer)`, not `message_id` alone as the proposal's §4 listing literally shows — a message consumed by more than one consumer type needs each to dedupe independently (§9). Worth a one-line ADR or a §4 erratum if that listing is treated as authoritative elsewhere.

## Done when

`pnpm --filter @noizera/infra db:generate` produces SQL for the shared tables, the integration test above passes, and `docker compose run --rm api node dist/migrate.js` works against `docker-compose.dev.yml`'s Postgres.

**Status note:** all done. `drizzle.config.ts` + `packages/infra/src/shared/schema.ts` (outbox_messages, processed_messages, audit_log — UUIDv7 ids via an app-side `$defaultFn`, see `packages/infra/src/shared/id.ts`) generate `packages/infra/drizzle/0000_sloppy_captain_america.sql`. `runMigrations()` (`packages/infra/src/shared/migrate.ts`) holds `pg_advisory_lock(72190001)` for the duration; three Testcontainers tests in `migrate.integration.spec.ts` cover applying migrations, idempotent re-runs, and a concurrent run waiting on the lock instead of racing. `apps/api/src/migrate.ts` compiles to `dist/migrate.js` under plain `nest build` (verified) and was run by hand against a real Postgres 17 container using the same image/credentials as `docker-compose.dev.yml` (the literal compose service was blocked locally by an unrelated pre-existing native Postgres service already bound to host port 5432 — not a defect in this ticket). CI: `.github/workflows/ci-cd.yml`'s `lint` job now runs `db:generate` and fails on any uncommitted diff under `packages/infra/drizzle`.
