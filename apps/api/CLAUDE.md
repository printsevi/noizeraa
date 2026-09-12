# apps/api

NestJS 11 (Node 22) — HTTP API and background workers, one image, role selected by `APP_ROLE` (`api` | `worker-media` | `worker-general`), dispatched in `src/main.ts`. See root `CLAUDE.md` and the tech proposal (§1–§3) before adding a module here.

## Current state

Only `app.module.ts` and `health/` exist. No business modules, no Drizzle wiring, no RabbitMQ consumers. `worker-media`/`worker-general` boot via `NestFactory.createApplicationContext` and currently just log and idle — there is nothing to consume yet.

## Adding a module

- Each backend module (`identity`, `catalog`, `media`, `sharing`, `panels`, `listeners`, `responses`, `results`, `billing`, `editorial`, `admin`) owns its own directory under `src/`, its own tables, and is wired into `AppModule`. Never import another module's repository directly — go through its application service or a domain event.
- `grill-me` first for any new module's design, then `tdd` for the implementation loop (unit tests via Vitest at the module boundary; Testcontainers for anything touching Postgres/RabbitMQ/Valkey).
- Controllers validate with `@noizera/contracts` Zod schemas, not raw DTOs. Domain logic lives in `@noizera/domain`, persistence in `@noizera/infra` — this package should stay thin (HTTP/queue adapters + application services), not hold entities or Drizzle calls directly.
- Any RabbitMQ publish goes through the transactional outbox — never call `channel.publish()` directly (root CLAUDE.md, tech proposal §1).

## Testing

`pnpm --filter @noizera/api test` (Vitest). Colocate `*.spec.ts` next to the file under test, per `health/health.controller.spec.ts`.
