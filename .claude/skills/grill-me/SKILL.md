---
name: grill-me
description: Runs a relentless, round-based interrogation of a proposed Noizera feature or plan before any code is written. Use when the user says "grill me", "grill me on this", or asks for a pre-implementation review/challenge of a plan, spec, or approach — or before committing to a data-model change, an API contract, or a refactor that touches multiple modules.
---

# Grill me

Interview the user relentlessly about the plan until you reach a shared understanding. Nothing gets built until they confirm. This is adversarial by design — the job is to find the weakest points in the plan, not to reassure the user it's fine, and not to write code.

## Map the plan as a design tree

Every decision in the plan branches into the decisions that hang off it. Before asking anything, sketch that tree silently: what has to be decided, and what each decision depends on.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled — the questions you can ask *now* without guessing at answers you haven't heard yet. Ask the whole frontier in one round: number each question and give your recommended answer. Then wait for the user's answers before the next round.

Format a round like this:

```
❓ **Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>

---

❓ **Q2** - **<question title>**: <question body>

➡️ <your recommended answer>
```

Each round the user answers reshapes the tree: settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round. A question whose answer depends on another question still open in this round belongs to a *later* round, not this one.

**Finding facts is your job, never the user's.** When a frontier question needs a fact from the environment (the codebase, the docs, a running service), dispatch a sub-agent or read the file yourself — don't ask the user for anything you could look up. Don't block the whole round on it: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait; ask the rest of the frontier now.

The session is done when the frontier is empty — every branch of the design tree visited, nothing left silently assumed. Do not act on the plan until the user confirms you've reached a shared understanding.

## Where recommended answers come from, in this repo

Your `➡️` recommendation for a given question isn't a guess — ground it in the settled decisions before proposing anything new:

- `docs/brief/tech-proposal/noizera-technical-overview.md` §18 "Decisions" and the "Given"/"Decided" rows in §1 are settled. If a question's honest answer is "the plan contradicts one of these," say so as a conflict, not as a live option — the recommended answer is "conform to the existing decision," and the question becomes whether the user wants to override it.
- `CLAUDE.md` "Non-obvious constraints" (blindness enforced in the data model, no composite readiness score, post-upload quota enforcement, listener fatigue caps) are hard constraints on any recommendation touching those areas.
- Gate 1 (pitch §8): if the plan is a product feature rather than pilot/infra scaffolding, one frontier question is always whether this is getting ahead of pilot validation.
- Module boundaries (`identity`, `catalog`, `media`, `sharing`, `panels`, `listeners`, `responses`, `results`, `billing`, `editorial`, `admin`) — a plan that has one module reaching into another's repository is a design-tree branch that needs resolving, not something to wave through.

## Branches worth checking exist in the tree

Don't ask generic risk-management questions — only branches that are actually live for this plan. Check whether each of these has an unsettled decision hanging off it before skipping it:

- **Scope boundary** — smallest version that ships value; MAKE/TEST/DECIDE/RELEASE stage fit (pitch §7).
- **Data model** — new columns/tables, module ownership, optimistic-concurrency (`version` column, §3.2) needs.
- **Failure modes** — partial failure, retries, idempotency; does it reuse the outbox/idempotent-consumer/webhook-reconciliation patterns already decided (§9, §14, §15.1) rather than reinventing them?
- **Security/privacy** — listener PII, unreleased masters, auth — which threat-model item (§14) applies?
- **Statistical/product honesty** — if it touches results, does "raw counts with denominators, no composite score, n<5 suppressed" (§8) survive?
- **Seams** — per the [[tdd]] skill, what's the public interface this feature will be tested through, and is it precise enough to name right now? An unnamed seam is a frontier question, not an implementation detail to sort out later.
- **Reversibility** — one-way doors (destructive migrations, public API shape, pricing/entitlement changes) get a question even if the user seems to have already decided, unless they've explicitly confirmed it.
