# Project setup session — 2026-09-12

**For humans.** A record of what was set up in this repo in one session, in order, with the reasoning — written so the same setup can be repeated on a future project without re-deriving each decision. Not read by Claude Code.

**Starting point:** a repo with only `README.md` and two planning docs (a business pitch and a companion technical proposal) — no code, no CI, no infra, no `CLAUDE.md`.

---

## 1. `CLAUDE.md` (via `/init`)

Ran the built-in `/init` flow to generate `CLAUDE.md`. Because the repo was planning-only at that point, the file orients Claude Code to that state rather than describing code that doesn't exist: what the product is, that a pre-build validation gate ("Gate 1" in the pitch) exists and gates _feature_ work but not tooling, and a summary of the technical proposal's key decisions so Claude doesn't have to re-read the whole 700-line document every session.

**Reusable takeaway:** for a project that starts as docs-only, don't wait for code to exist before running `/init`. Point `CLAUDE.md` at the planning docs explicitly and call out anything that gates implementation (a validation milestone, a design freeze, a "don't build yet" condition) — that's the single highest-leverage thing to get in front of a future session before it starts writing code.

## 2. Claude Code skills: `grill-me` and `tdd`

Two custom skills were added under `.claude/skills/`, first as project-specific drafts, then rewritten to incorporate the actual mechanics from **Matt Pocock's public skills repo** (`github.com/mattpocock/skills`) rather than reinventing them from a paraphrase.

- **`grill-me`** — a relentless, round-based interrogation of a plan before any code is written. The core mechanic (worth reusing verbatim on any project): model the plan as a **design tree**, work it in **rounds**, and in each round ask only the **frontier** — every question whose prerequisites are already answered — formatted as numbered `❓ Q1 / ➡️ recommended answer` pairs. The agent finds facts itself (never asks the user something it could look up); the user only answers genuine decisions. The session ends when the frontier is empty and the user confirms — the skill never proceeds to implementation itself.
- **`tdd`** — strict red-green-refactor, also lifted from Pocock's skill: tests only at **pre-agreed seams** (the public interface boundary, confirmed with the user before writing a test), three named anti-patterns to avoid (implementation-coupled, tautological, horizontal slicing), and the rule that **refactoring is a separate pass, not part of the red→green loop**.

Both were then layered with this project's specifics on top of the borrowed mechanics: which files count as "settled decisions" to ground `grill-me`'s recommended answers in, what this repo's actual testing seams are (domain package / repositories / API modules / one E2E flow), and which domain invariants must become tests rather than comments.

**Reusable takeaway:** when you want a skill that does something like "grill me" or "TDD," check if a known, already-refined version exists (Pocock's repo is a good source for engineering-discipline skills) and fetch the actual `SKILL.md` content — `curl raw.githubusercontent.com/...` — rather than paraphrasing from a blog post about it. Then add a **project-specific layer on top** (what's settled, what the real seams are) rather than replacing the mechanic.

## 3. Doc categories under `docs/`

Beyond the pitch and tech proposal, added one folder per kind of working document, each with its own `README.md` (and most a `TEMPLATE.md`):

- `docs/tickets/` — one file per unit of planned work, status in frontmatter
- `docs/bugs/` — found defects, paired with their regression test
- `docs/tech-debt/` — shortcuts with an explicit **trigger condition** for revisiting (not just "fix later") — seeded from trigger conditions the tech proposal had already named (e.g. "add a CDN when >30% of listeners are outside the target region")
- `docs/adrs/` — added a README + template to the already-existing empty folder; scoped narrowly to _reversals or additions_ to the tech proposal, not a duplicate of it
- `docs/specs/` — added a README to the already-existing empty folder; for a resolved, feature-level design (typically the output of a `grill-me` session), written down before the `tdd` loop starts
- `docs/glossary.md` — a single shared-vocabulary file, seeded with terms already used inconsistently across the pitch/tech proposal (panel, alias, seam, outbox, etc.)

**Reusable takeaway:** a doc-category folder is only worth creating if it has a _convention_ (a template, a naming pattern, a status field) — an empty folder with no README is not more useful than no folder. Seed `tech-debt` and `glossary` from whatever the existing planning docs already implied, rather than starting them blank.

## 4. Monorepo scaffold — confirmed scope before building

Before scaffolding code, asked the user two questions rather than assuming: **(a)** should this include a real code monorepo skeleton or just docs, given the repo's own `CLAUDE.md` said not to start the build before a validation gate passes, and **(b)** which doc categories (this surfaced item 3 above). The user chose "full monorepo scaffold" — an explicit decision to scaffold ahead of that gate, which was then written back into `CLAUDE.md` so a future session wouldn't mistake the scaffold's existence for the gate having passed.

Built (pnpm workspaces + Turborepo, per the tech proposal's already-decided stack):

- `apps/api` — NestJS skeleton with one real endpoint (`/healthz`) and its test
- `apps/web` — Next.js App Router skeleton with a placeholder page
- `packages/{contracts,domain,infra}` — empty export stubs with a doc-comment explaining what belongs there and what it must not import (kept deliberately empty rather than filled with speculative code)
- Root tooling: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `eslint.config.mjs`, `.prettierrc.json`, `vitest.workspace.ts`, `.env.example`, `.gitignore`, `.nvmrc`

**Reusable takeaway:** when a plan explicitly gates "real" work behind a milestone, don't silently scaffold past that gate — ask, and if the user says yes, write the exception back into the persistent guidance file so it's legible later. Keep new packages as empty, documented stubs rather than inventing placeholder business logic just to have something in the folder.

## 5. Hetzner + Cloudflare infra via OpenTofu — source only, nothing applied

Scaffolded `infra/` matching the tech proposal's two-layer design:

- `infra/tofu/` — OpenTofu source for the private network/firewalls, the two VMs + attached volume, object storage buckets, and Cloudflare DNS (including a deliberately _unproxied_ hostname so Caddy's on-demand TLS can complete its own challenge — proxying that hostname would silently break custom-domain TLS)
- `infra/cloud-init/` — hardens SSH and installs Docker / Postgres respectively; stops short of anything too site-specific to script blind (e.g. relocating PGDATA onto the attached volume is left as a documented manual step, not a guessed command)
- `infra/compose/` — the Caddy reverse-proxy config and the Compose files that actually run on each VM

Every file carries an explicit "nothing has been applied" caveat, and the repo's `.gitignore`/`CLAUDE.md` were updated so `tofu apply` is never something an agent runs without being asked.

**Reusable takeaway:** IaC can be scaffolded as pure source with zero risk — it's just files until someone runs `apply`. The two things worth being disciplined about: (1) mark clearly, in the files themselves and in `CLAUDE.md`, that nothing has been provisioned, so a future session doesn't assume real infrastructure exists; (2) don't invent values for anything that has to come from a real account (DKIM records, MX targets) — placeholder + a comment saying where the real value comes from beats a plausible-looking fake.

## 6. Cloudflare + audio — a decision worth writing down once

Answered a specific question mid-session (can music files go through Cloudflare's free tier?) by pointing back to what the tech proposal had already decided: **no** — audio bypasses Cloudflare entirely (direct signed-URL redirects to object storage), both because the proxy wouldn't see those bytes anyway and because Cloudflare's free/Pro terms restrict large media through their CDN outside Stream/R2. Free tier is fine for everything else (DNS, WAF, Turnstile, caching the public page).

**Reusable takeaway:** when a technical proposal has already reasoned through a tradeoff, answer follow-up questions from that reasoning rather than re-deriving it — and double check the _current_ scaffold actually reflects the decision (in this case, confirming the DNS file's unproxied hostname was already correct).

## 7. Docker — the monorepo detail that's easy to get wrong

Added `apps/api/Dockerfile` and `apps/web/Dockerfile` using the **`turbo prune --docker`** pattern: because this is a pnpm workspace, a naive `docker build apps/api` won't work — the build has to prune the workspace to just that package's dependency subset first, inside the Dockerfile, built from the **repo root** as context. The API image installs `ffmpeg` because the same image runs both the HTTP API and the media-processing worker role (dispatched at runtime by an `APP_ROLE` env var, which required a small, real change to `apps/api/src/main.ts` — not just a Dockerfile). The web image needed `output: "standalone"` added to `next.config.ts` for its multi-stage build to have something to copy.

Also added a **local-dev-only** `docker-compose.dev.yml` (Postgres/RabbitMQ/Valkey) at the root, separate from `infra/compose/`'s deploy-target Compose files — the two serve different purposes and shouldn't be merged.

**Reusable takeaway:** for any monorepo (pnpm/Turborepo, Yarn workspaces, etc.), look up the workspace-pruning Docker pattern for that specific tool before writing a Dockerfile by hand — a single-package Dockerfile copy-paste will build something bloated or broken. If one image serves multiple runtime roles, that's an application-code concern (an env-var dispatch in the entrypoint), not just a Dockerfile concern.

## 8. GitHub Actions — CI ungated, deploy and infra-apply gated

Three workflows:

- **`ci-cd.yml`** — lint/typecheck/test/e2e run on every push and PR (cheap, safe, no secrets needed beyond what's already public). Build-and-push-to-GHCR and the SSH deploy run **only** on push to `main`, and only after every check job passes.
- **`infra-plan.yml`** — `tofu plan` on PRs touching the infra directory. Read-only.
- **`infra-apply.yml`** — the _only_ workflow allowed to run `tofu apply`, behind manual `workflow_dispatch` plus a GitHub **environment** (`production`) with required reviewers configured — the environment protection rule is what actually gates the job, independent of where its secrets live.

Because the tech proposal's Tofu state is local + SOPS-encrypted rather than a remote backend, both infra workflows had to explicitly decrypt `terraform.tfstate.enc` before `tofu init` and (in the apply workflow) re-encrypt and commit it back afterward — otherwise CI's state would vanish after every run and Tofu would think nothing existed.

**Reusable takeaway:** the safe default for a new project's CI/CD is "tests run on everything, deploys run on nothing without a human in the loop" — encode that as `if:` conditions plus a GitHub environment with required reviewers, not just a comment saying "be careful." If your IaC's state isn't in a remote backend, CI needs its own explicit decrypt/re-encrypt step around every `init` — this is easy to forget and silently breaks state continuity between runs.

## 9. GitHub Secrets — where they live and how they're gated

Settled the practical setup:

- **Repository secrets** for everything (`Settings → Secrets and variables → Actions`, or `gh secret set NAME`) — simpler than splitting values between repo- and environment-scoped secrets.
- The actual gate is the `production` **environment**'s protection rules (required reviewers), which apply to any job that declares `environment: production` regardless of which scope its secrets came from.
- One SSH keypair generated locally serves two roles: the **public** half becomes a Terraform variable (installed on the VMs by cloud-init), the **private** half becomes the secret CI uses to SSH in and deploy.
- `age-keygen` produces both the private key (a CI secret, for decrypting Tofu state) and the public key (a CI secret, for re-encrypting it after apply) from one file.

**Reusable takeaway:** don't split secrets across repo/environment scope trying to be extra safe — it adds bookkeeping for no real security gain, since GitHub environment protection rules gate the _job_, not the secret's storage location. Generate SSH/age keypairs locally, upload both halves, and never let a value like this touch a committed file even as a placeholder.

---

## 10. Package-level `CLAUDE.md` files — one per code package, not per folder

Once the monorepo skeleton existed, added a `CLAUDE.md` to each of the five code packages (`apps/api`, `apps/web`, `packages/{contracts,domain,infra}`) rather than to every directory in the repo. Each one states what's already built there, the package-specific rules the root file only summarizes (no framework imports in `domain`, no raw Drizzle types leaving `infra`, outbox-only publishing, blindness/no-readiness-score constraints repeated where a _frontend_ dev could otherwise violate them), and points back to the root `CLAUDE.md` and tech proposal section rather than re-explaining them.

`infra/*` and `docs/*` were deliberately skipped: both already had `README.md` (+ `TEMPLATE.md`) files serving the same orienting purpose, and the root `CLAUDE.md`'s own "Doc categories" section documents that split — adding `CLAUDE.md` there would have meant two competing conventions for the same job.

**Reusable takeaway:** "add CLAUDE.md to every folder" and "add CLAUDE.md where needed" are different requests — check for an existing convention (a README a folder already has) before assuming a bare folder needs a Claude-specific file too. Scope package-level files to _packages_ (things with their own `package.json`/dependency boundary), not every subdirectory.

## 11. Repo hygiene sweep

While in there: removed `bash.exe.stackdump` (a crash artifact from a prior MSYS bash session, accidentally `git add`-ed alongside the real scaffold) from disk and the index, and added `*.stackdump` to `.gitignore` so a future shell crash doesn't get staged again. Checked for actual duplication between the new package `CLAUDE.md` files and the root one / infra READMEs — found none worth trimming, since the new files were written to reference back rather than restate. A lint/format pass was requested too, but skipped: `pnpm` isn't on `PATH` and `node_modules` doesn't exist in this environment, so there was nothing runnable.

**Reusable takeaway:** a stray crash-dump file in `git status` is worth a second look before committing — it's easy to `git add -A` it in by accident, and it belongs in `.gitignore`, not in history.

## Condensed checklist for a future project

1. `/init` → write `CLAUDE.md` immediately, even (especially) before code exists. Call out any milestone that gates real feature work.
2. Pull in `grill-me`/`tdd` (or equivalent discipline skills) from a known-good source, then add a project-specific layer on top — don't write the mechanic from scratch, don't skip the project layer either.
3. Add `docs/{tickets,bugs,tech-debt,adrs,specs}/` + `docs/glossary.md`, each with a real convention (template + status field), seeded from anything the planning docs already imply.
4. Before scaffolding code, confirm scope explicitly if the project's own docs say not to build yet — write the answer back into `CLAUDE.md`.
5. Scaffold the monorepo with real tooling configs (lint/typecheck/test wired up, even against empty packages) rather than bare folders.
6. IaC as pure source, loudly marked "nothing applied," secrets never hardcoded — placeholders with a comment on where the real value comes from.
7. Docker: look up the monorepo-specific build pattern (prune) rather than hand-rolling; any multi-role image needs an explicit runtime dispatch, not just multiple Dockerfiles.
8. CI ungated, deploy/infra-apply gated behind a GitHub environment with required reviewers — this is the one line of real protection, make sure it's actually configured, not just implied.
9. Secrets as repository secrets, gate via the environment, generate keypairs locally, never commit even a placeholder value that looks real.
10. Add `CLAUDE.md` per code _package_, not per folder — skip folders that already have a README-based convention. Sweep for stray files (crash dumps, editor artifacts) before the first real commit.
