# apps/web

Next.js 15 App Router + React 19. BFF pattern: this app holds the httpOnly auth cookie and proxies to `apps/api` — it is not just a static frontend, and route handlers here are a legitimate place for server-side logic that talks to the API on the user's behalf.

## Current state

Only a placeholder `app/page.tsx` and `app/layout.tsx` exist. No auth, no API proxying, no real routes/components yet.

## Conventions

- Shared request/response shapes come from `@noizera/contracts` (Zod schemas + generated OpenAPI types) — don't hand-roll parallel types for data the API already validates.
- Listener-facing pages must never receive real version IDs, filenames, or labels from the API — blindness is enforced server-side (root CLAUDE.md "Non-obvious constraints"), but this app must not leak it back out via query params, client state, or error messages either.
- No composite "readiness" score in any UI — always render raw counts with denominators, and suppress segments below n=5 (root CLAUDE.md).

## Testing

Playwright is reserved for the listener flow only (per the `tdd` skill), not general component testing — `pnpm --filter @noizera/web test:e2e`. Specs live under `e2e/`.
