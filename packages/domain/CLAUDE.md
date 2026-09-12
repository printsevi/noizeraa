# packages/domain

Entities, value objects, and domain events. This is the innermost layer — see tech proposal §3.2 and root `CLAUDE.md`.

## Rules

- **No framework imports.** No Nest, no Drizzle, no Express, no HTTP concepts. If a file here needs to import from `@nestjs/*` or a Drizzle type, the code belongs in `apps/api` or `packages/infra` instead.
- **Never imports from `@noizera/infra`.** Dependency direction is one-way: `infra` depends on `domain`, never the reverse. Repositories in `infra` map rows to these types at the repository edge.
- This is where product invariants live — e.g. blindness (no real version ID/filename ever attached to a listener-facing object), fatigue caps, quota checks. Enforce them here, not only in controllers, so they hold regardless of caller.
- Vitest unit tests are the primary test level for this package (per the `tdd` skill) — no database, no HTTP, pure objects and events.
