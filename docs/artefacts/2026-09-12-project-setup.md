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

## 12. Full-repo audit via `grill-me` — what a "finished" scaffold was actually hiding

Later the same day, ran `grill-me` not on a feature but on the repo itself: "verify every file, is this ready for an enterprise-quality build, are the agentic files right, what's missing, what hooks/skills should exist." The skill's mechanic transferred cleanly — Claude read all 84 files itself (never asked for a fact it could look up), presented findings first, then worked the decisions as three rounds of numbered questions with a recommended answer each, and only started changing things after an explicit "start."

**What it found in a scaffold that had looked complete** (the full list was ~30 items; the ones worth remembering):

- _Nothing had ever been run._ No `pnpm-lock.yaml`, so every `--frozen-lockfile` in CI and both Dockerfiles would have failed on the first push. `vitest run` in an empty package exits 1 ("no test files"). Nest constructor injection can't resolve under Vitest's default esbuild transform (no decorator metadata) — the one existing test only passed because its controller had no dependencies.
- _Workspace packages weren't consumable at runtime._ `main: src/index.ts` with no build script means `nest build` compiles `../../packages` into the wrong place and `node dist/main.js` can't `require('@noizera/domain')`. The Dockerfile's `CMD` pointed at a path that would never exist.
- _CRLF was reaching Linux._ The earlier decision to force CRLF via `.gitattributes` was silently putting `\r` into cloud-init YAML (rendered through `templatefile()` into `user_data`), the Caddyfile and the `.tf` files. Reversed to LF everywhere.
- _`.gitignore` was hiding the one file the apply workflow commits back._ `*.tfstate.*` matched `terraform.tfstate.enc` and the negation pattern didn't — state would have been lost after the first real apply.
- _CI could never have deployed._ Public SSH was restricted to the admin IP; GitHub runners have no fixed IP. And vm-db, with no public IP, had a cloud-init that `apt-get`s from the internet with nothing providing NAT. Hetzner cloud firewalls also don't filter private-network traffic, so the "defense in depth" db firewall was inert.
- _Compose would have corrupted the product database._ `umami` shared the app's `env_file` — it would have read the app `DATABASE_URL` and created its tables there. The pgBackRest compose file couldn't take a backup as written.
- _Docs had drifted from code within hours._ `infra/README.md` said `docker-compose.dev.yml` "hasn't been scaffolded yet" (it existed); the `tdd` skill said "no test runner is wired up yet"; the proposal said "one image, four roles" when `web` is its own image.

**What was decided and done** (five commits, each group verified by running the whole pipeline, not by asserting it):

1. Toolchain: LF; packages build to `dist/` with `exports` maps (`@noizera/infra/shared`, `@noizera/infra/<module>`); SWC under Vitest (proved with a throwaway constructor-injection test); `dependency-cruiser` rules encoding the module boundaries that had only been prose in `CLAUDE.md` — proved by writing a violating import and watching it fail, then deleting it; lefthook + lint-staged + commitlint; Dependabot, PR template, CODEOWNERS, `.editorconfig`.
2. CI: least-privilege `permissions:`, SHA-pinned actions, a real sops checksum (fetched from the release, not invented), `tofu plan` posted as a PR comment, deploy over Tailscale with `rsync` of `infra/compose` and a `workflow_dispatch` `sha` input for rollback.
3. Infra: NAT route + masquerade for vm-db, ufw as the real 5432 control, umami and the db compose file removed, healthchecks so `--wait` means something, path-style flags on the S3 provider. ADR 001 records Tailscale (new signup; `admin_ip` on 22 kept as break-glass).
4. Docs: eight tickets for the gaps between proposal and scaffold; the proposal bumped to v1.1 with an errata block under its header and the factual fixes applied in place (ADRs are for decisions, errata for corrections); `CLAUDE.md`, the `tdd` skill and `.env.example` re-synced.
5. Claude tooling: `.claude/settings.json` with a PreToolUse Bash guard (Tofu apply/destroy, `drizzle-kit push`, force-push, `compose down -v`, `rm -rf` outside the scratchpad), a PostToolUse prettier hook, a read-only permission allowlist, and denied reads of `.env*`. The guard was tested against 24 cases — and tripped on its own commit message the first time, which led to anchoring patterns to command position rather than matching anywhere in the text.

**Skills:** searched the registry for NestJS/Drizzle/Playwright/Testcontainers/OpenTofu/Caddy. Only Playwright had a credible hit (`currents-dev/playwright-best-practices`, MIT, 80K+ installs) — vendored under `.claude/skills/` with provenance. The popular NestJS skill was read before installing and **rejected**: its rules mandate mocking the database and `class-validator`, which would have put it in permanent conflict with the project's `tdd` (Testcontainers, never mock your own modules) and `contracts` (Zod) skills. Nothing credible existed for Testcontainers, OpenTofu or Caddy.

**Environment notes worth knowing next time on this machine:** `corepack enable` needs admin (use `corepack pnpm …` or a user-dir shim); Node 24 is installed with no version manager, so `engines` had to be `>=22` rather than exact; Next's `standalone` output needs Windows Developer Mode (symlinks), so it's gated off on `win32` only; Docker Desktop wasn't running, so the image build is the one thing left unverified; `tofu` isn't installed, so `.tf` syntax is checked by the plan workflow, not locally.

**Reusable takeaways:**

- A scaffold that has never been _run_ isn't a scaffold, it's a sketch. `pnpm install` + `build` + `lint` + `typecheck` + `test` green is the minimum bar before calling it done — three of the five would have failed here on the first CI run.
- `grill-me` works as an audit tool, not just a feature-planning tool: "find facts yourself, present findings, then ask only real decisions" produced a shorter, better session than "review the repo" would have.
- Architectural rules that exist only in `CLAUDE.md` are wishes. If a boundary matters, write the lint rule and prove it fires — the first version of the dependency-cruiser config silently matched nothing because `dist/` was excluded and workspace imports resolve there.
- Test every hook and guard against a case file before trusting it, and expect the first false positive to be your own commit message.
- Read a third-party skill before installing it; the install count measures popularity, not compatibility with your own workflow skills.
- When the second session on a repo finds docs already stale, that's the signal to add the sync to the definition of done, not to fix it once.

## 13. First real deploy — Hetzner + Cloudflare, and what only showed up at apply time

A later session took the scaffolded `infra/tofu` from source-only to an actually-applied estate — the first time any of it touched real cloud accounts. Two categories of lesson came out of it: how to handle credentials safely across a chat-based session, and a handful of bugs that only exist once you run `tofu apply` for real, invisible from reading the `.tf` files.

**Credential handling.** The user pasted a live Hetzner API token directly into chat mid-conversation; it was flagged as compromised immediately and rotation was required before continuing, rather than treating "I've seen it now" as good enough. The durable pattern that came out of that: for every secret from then on (Cloudflare token, S3 keys, SSH keypair, DB password), walk through _where in the provider's UI to generate it and which permissions to pick_, but have the user paste the value into `terraform.tfvars` themselves, in their own editor, never through the chat. When a value's validity needed checking, it was verified server-side — small Node one-liners calling the provider's own API (Cloudflare's `/user/tokens/verify`, a raw SigV4-signed `GET` against Hetzner's S3-compatible endpoint) — reading the token out of the gitignored `terraform.tfvars` file, printing only the boolean result, never the secret itself back into the conversation.

**Sizing changed mid-flight, recorded as an ADR, not a silent edit.** The tech proposal had settled on CPX32 (vm-app)/CPX22 (vm-db) with real cost math behind it. The user asked to run cheaper CX-line VMs instead for the initial production estate — a real deviation from a "Decided" item, so it went into `docs/adrs/002-cx-line-for-both-vms.md` rather than just changing `servers.tf` quietly: what was traded away (dedicated vs. shared/burstable vCPU, vm-app's vCPU count), and a concrete trigger for revisiting it (the same transcode-queue-depth alert the tech proposal already names).

**Bugs that only exist once you actually apply:**

- **Wrong region on the `aws` provider.** `main.tf` hardcoded `region = "eu-central-1"` for the S3-compatible provider pointed at Hetzner Object Storage — Hetzner rejects a bucket `CreateBucket` whose region doesn't match the datacenter implied by the endpoint host (`LocationConstraintConflict`). Fixed by deriving the region from `hetzner_s3_endpoint` (`split(".", ...)[0]`) instead of a value that can silently drift out of sync with it.
- **A remembered server-type name was stale.** `cx22`/`cx32` don't exist in Hetzner's current catalog; the live names are `cx23`/`cx33`/etc. (2 vCPU/4GB, 4 vCPU/8GB). This wasn't discoverable by reading docs or code — it took querying `GET /v1/server_types` against the account's real token and filtering for the target location before trusting a name in `.tf` source. Don't assume a cloud provider's SKU names from memory; check the live catalog for the specific account/location before writing them into IaC.
- **A "which endpoint fails" question needed the dependency graph, not just the error list.** When several resources failed in one `apply`, the ones that _didn't_ show an error weren't necessarily fine — `cloudflare_record.root`/`www`/`edge` depend on `hcloud_server.app.ipv4_address`, so when that server failed, those records were silently skipped, not attempted. Read `depends_on` before concluding a resource without a printed error actually succeeded.
- **A terminal-scrollback illusion.** After a second apply attempt, the user reported only 2 remaining errors; `tofu state list` showed the real picture — all 7 Cloudflare records were still missing, not just the one whose error happened to still be visible in the pasted terminal output. Ground troubleshooting in `tofu state list`/`tofu plan`, not in how much of a long error block the user happened to paste.
- **A provider waiter can time out even when the underlying write succeeded.** `aws_s3_bucket_lifecycle_configuration` PUT to Hetzner's Object Storage worked both times, but the `aws` provider's post-write consistency check (poll until the read-back matches) timed out at 3 minutes regardless — confirmed by fetching the live lifecycle XML directly with a hand-signed request. Fix was `tofu import` of the already-correct resource into state (never re-attempt the same write/waiter pair once you've confirmed reality already matches intent), plus `lifecycle { ignore_changes = [...] }` on a provider-only computed attribute that would otherwise re-trigger the identical timeout on every future routine apply.
- **A mid-session Dependabot merge landed under the branch being worked on.** `git push` was rejected non-fast-forward partway through this session — Dependabot had merged an `aws` provider bump (`~> 5.60` → `~> 6.64`) plus two Docker base-image bumps to `main` in the meantime. Merged cleanly, then re-ran `tofu init -upgrade` + `tofu plan` against the _live, already-applied_ estate specifically to catch a breaking major-version change before pushing — came back clean (0 to add/change beyond a pre-existing cosmetic drift), but that verification step is what actually justified trusting the merge rather than assuming semver.

**Tooling friction on this machine:** neither `tofu` nor `pnpm` were reliably on `PATH` inside tool-driven shells even after installing/existing — `tofu` needed its `winget`-installed binary copied into a directory already on the Git Bash `PATH` (`~/bin`) since a running shell doesn't pick up a Windows PATH change; `pnpm`'s corepack shim needed the same `~/.corepack-bin` prefix for lefthook's pre-commit hook to find it when committing from that shell.

**Reusable takeaways:**

- Never let a secret's value pass through the chat, in either direction — walk the user through where to generate and paste it themselves, and verify server-side with a boolean-only check when you need confidence it's real.
- A cloud provider's SKU/type names drift; query the live catalog for the account and region in question before writing a server type into IaC, rather than trusting a remembered or documented name.
- When resources fail in a batch apply, check `depends_on` before assuming a resource with no printed error actually succeeded — dependency skips are silent.
- Trust `tofu state list`/a fresh `tofu plan` over a pasted error block; terminal scrollback truncates, state doesn't.
- A provider's own "verify" or "wait for consistency" logic can be wrong for a non-AWS S3-compatible backend even when the actual write succeeded — confirm reality directly (a raw signed API call) before deciding whether to retry, import, or `ignore_changes`.
- A sizing/SKU change that overrides a tech-proposal "Decided" item is exactly what an ADR is for, even mid-deploy — record the tradeoff and the trigger to revisit, don't just edit the `.tf` file.
- Re-verify a live plan against real state immediately after merging in an upstream dependency bump (especially a provider major-version bump) before pushing — don't rely on the changelog/semver promise alone when real, already-applied resources are on the line.

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
11. Before declaring the scaffold done, actually run it end to end (`install` → `build` → `lint` → `typecheck` → `test`) and commit the lockfile. Then run `grill-me` against the repo itself: it will find what the scaffold hid.
12. Enforce module boundaries with a lint rule proved against a deliberate violation; add a Bash guard hook for the user-run-only commands (IaC apply, schema push, force push) and test it against a case file.
13. Before the first real `tofu apply`: verify every SKU/type name and provider `region` against the account's live API, not memory or docs — provider catalogs and endpoint-to-region mappings drift and aren't visible from reading `.tf` source.
14. Route every credential through the user's own editor into a gitignored `tfvars`/env file, never through chat; verify a token/key server-side (a boolean-only check against the provider's own API) instead of trusting it or a wrapping tool's error text.
