---
name: tdd
description: Enforces a strict red-green-refactor test-driven development workflow for implementing Noizera features. Use whenever the user asks to implement a feature, fix a bug, or add behavior to the codebase — not for pure research, docs, or config-only changes.
---

# Test-Driven Development

TDD is the red → green loop. This skill is the reference that makes that loop produce tests worth keeping: what a good test is, where tests go, the anti-patterns, and the rules of the loop. Every section applies on every cycle: consult them before and during the loop, not after.

Every feature has a home module (`identity`, `catalog`, `media`, `sharing`, `panels`, `listeners`, `responses`, `results`, `billing`, `editorial`, `admin` — see `CLAUDE.md`). Confirm which module owns the change, and read the relevant section of `docs/brief/tech-proposal/noizera-technical-overview.md` for that area, before writing the first test. Run [[grill-me]] first if the plan isn't already settled.

## What a good test is

Tests verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't. A good test reads like a specification: "panel result excludes segments below n=5" tells you exactly what capability exists, and it survives refactors because it doesn't care about internal structure.

See [tests.md](tests.md) for examples and [mocking.md](mocking.md) for mocking guidelines.

## Seams: where tests go

A **seam** is the public boundary you test at: the interface where you observe behavior without reaching inside. Tests live at seams, never against internals.

**Test only at pre-agreed seams.** Before writing any test, write down the seams under test and confirm them with the user. No test is written at an unconfirmed seam. You can't test everything, so agreeing the seams up front is how testing effort lands on the critical paths and complex logic instead of every edge case.

Ask: "What's the public interface, and which seams should we test?" In this codebase the natural seams are:

- **Domain logic** (`packages/domain`) — the entity/value-object/domain-event API itself. No framework, no mocks of your own types.
- **Repositories** (`packages/infra`) — the repository interface, backed by a real Postgres via Testcontainers, not a mocked Drizzle client. Mocking the query builder tests the mock, not the SQL.
- **API modules** (`apps/api`) — the Nest module's public contract (HTTP handler or message consumer), asserting on persisted state / outbox rows, not on internal method calls.
- **Listener flow** (`/l/[token]`) — the golden path only, via Playwright: blind comparison, submit, results. Don't chase full E2E coverage elsewhere.

## Anti-patterns

- **Implementation-coupled**: mocks internal collaborators, tests private methods, or verifies through a side channel (querying the database instead of using the interface). The tell: the test breaks when you refactor but behavior hasn't changed.
- **Tautological**: the assertion recomputes the expected value the way the code does (`expect(add(a, b)).toBe(a + b)`, a snapshot derived by hand the same way, a constant asserted equal to itself), so it passes by construction and can never disagree with the code. Expected values must come from an independent source of truth: a known-good literal, a worked example, the spec.
- **Horizontal slicing**: writing all tests first, then all implementation. Bulk tests verify _imagined_ behavior: you test the _shape_ of things rather than user-facing behavior, the tests go insensitive to real changes, and you commit to test structure before understanding the implementation. Work in **vertical slices** instead: one test → one implementation → repeat, each test a **tracer bullet** that responds to what the last cycle taught you.

## Rules of the loop

- **Red before green.** Write the failing test first, confirm it fails for the expected reason (not a typo, import error, or missing fixture), then write only enough code to pass it. Don't anticipate future tests or add speculative features.
- **One slice at a time.** One seam, one test, one minimal implementation per cycle.
- **Refactoring is not part of the loop.** Once the suite is green, refactoring belongs to a separate review pass — re-run the full suite after every refactor step, and never add behavior in that pass.
- Commit at green, not mid-red.

## Domain invariants to encode as tests, not comments

These are called out in `CLAUDE.md` / the tech proposal as correctness-critical — each deserves an explicit test at the appropriate seam, not just careful code:

- Blindness: a listener session must never resolve to a real version ID, label, or filename in any response payload.
- No composite/aggregate readiness score is ever computed or stored.
- Segments below n=5 are excluded from headline results and rendered with their "too few to read" caveat.
- Storage quota is enforced from the actual object size after upload completes, never from a client-declared size.
- Listener invitation fatigue caps (`invites_this_month < monthly_cap`) are respected by pool matching.

## Running tests

No test runner is wired up yet (see repo state in `CLAUDE.md`). Once `apps/`/`packages/` scaffolding exists, check `package.json` scripts (expect something like `pnpm test`, `pnpm test path/to/file.spec.ts -t "test name"` for Vitest) rather than assuming a command — update this section once the scaffolding lands.
