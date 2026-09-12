# Noizera

Artist hub with unreleased tracks — test unreleased music with real listeners and get an honest signal on whether a track is ready to release. See `docs/brief/product-roadmap/noizera-pitch.md` for the product pitch and `docs/brief/tech-proposal/noizera-technical-overview.md` for the technical plan. Start with `CLAUDE.md` for repo orientation.

## Quickstart

```bash
corepack enable
pnpm install
pnpm dev        # apps/api + apps/web, via turbo
pnpm test       # all packages
pnpm lint
pnpm typecheck
```

Run a single test: `pnpm --filter @noizera/api test src/health/health.controller.spec.ts`.

## Layout

```
apps/api/        NestJS backend
apps/web/        Next.js frontend
packages/        contracts, domain, infra — shared code
docs/            pitch, tech proposal, ADRs, specs, tickets, bugs, tech-debt, glossary
```
