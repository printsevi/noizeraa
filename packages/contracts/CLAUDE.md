# packages/contracts

Zod schemas plus OpenAPI types generated from the same schemas (`@asteasolutions/zod-to-openapi`), shared by `apps/api` and `apps/web`. This is the single source of truth for request/response shapes crossing the API boundary — don't redefine the same shape as a plain TS interface in either app.

## Rules

- No framework imports (Nest, Next, Express) — this package is consumed by both apps and must stay framework-agnostic.
- No business logic — validation schemas and derived types only. Entities and invariants belong in `@noizera/domain`.
- A schema change here is an API contract change: check both `apps/api` (controllers/DTOs) and `apps/web` (BFF routes/client calls) for call sites before renaming or narrowing a field.
