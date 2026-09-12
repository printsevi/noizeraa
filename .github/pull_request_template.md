## What

<!-- One paragraph. Link the ticket: docs/tickets/NNN-*.md -->

## Why

<!-- The problem, not the solution. If this reverses or refines a tech-proposal decision, link the ADR. -->

## Checklist

- [ ] Ticket/spec exists and `grill-me` was run for anything non-trivial
- [ ] Tests at the agreed seams (see `tdd` skill) — red first, then green
- [ ] No composite/readiness score, no real version ID/label/filename on any listener-facing path
- [ ] Any new outbound message goes through the outbox; any new consumer is idempotent
- [ ] Migrations reviewed as SQL (`drizzle-kit generate`, never `push`)
- [ ] Docs updated where a decision changed (tech proposal errata / ADR / glossary)
