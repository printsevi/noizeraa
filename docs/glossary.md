# Glossary

Domain language used consistently across tickets, ADRs, tests, and code — so a test named `"..."` and a ticket describing the same thing use the same words. Add a term here the first time it needs disambiguating; don't pre-populate speculatively.

| Term | Meaning |
|---|---|
| **Panel** | The unit of work for testing a track: a set of listener invitations against one or more versions, with a question set, a target size, and a state (open/closed). |
| **Version** | A specific mix/master of a track — versions are siblings under a track, not separate tracks. |
| **Rendition** | A derived, transcoded output of a version's original asset (e.g. an HLS profile, a peaks file) — always regenerable, never the artist's delivery copy. |
| **Original / asset** | The artist's uploaded source file for a version. Never modified; the only copy that matters for delivery to labels/press. |
| **Alias** | The opaque, per-session label (e.g. `"7f3a"`) a listener sees in place of a real version ID/label/filename — the mechanism that enforces blindness. |
| **Listener** | A person providing feedback on a panel. No account, no password — identified only by an invitation token and a `listening_sessions` row. |
| **Declared role** | The listener's self-selected lens for feedback: fan, peer, producer, DJ, curator, casual (pitch §5.3). Results are segmented by this. |
| **Fatigue cap** | The monthly limit on how many panel invitations one listener can receive, enforced in pool matching — the mitigation for listener pool burnout (pitch §12 risk 2). |
| **Segment suppression** | The rule that a result segment with fewer than 5 responses is excluded from headline results and rendered as "too few to read" rather than a misleadingly precise number. |
| **Seam** | The public interface boundary a test observes behavior through, per the `tdd` skill — never an internal implementation detail. |
| **Outbox** | The transactional-outbox pattern: a domain write and its published event commit in one Postgres transaction; a relay polls and publishes separately, so the API never calls the message broker directly. |
| **Gate 1** | The two-week, no-code manual pilot (pitch §7–8) that must validate listener supply and decision impact before the nine-week build begins. |
| **Entitlements** | The single `PlanEntitlements` value object (storage bytes, panel size, seats, targeting, custom domain) resolved from a subscription — never scattered `if (plan === ...)` checks. |
