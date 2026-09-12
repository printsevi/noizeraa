---
status: open
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

- Whether `migrate.ts` lives in `apps/api` (as §12's command implies) or `packages/infra` with a thin bin in the api image. Recommendation: `apps/api/src/migrate.ts` importing from `@noizera/infra/shared`, so the image already has it.

## Done when

`pnpm --filter @noizera/infra db:generate` produces SQL for the shared tables, the integration test above passes, and `docker compose run --rm api node dist/migrate.js` works against `docker-compose.dev.yml`'s Postgres.
