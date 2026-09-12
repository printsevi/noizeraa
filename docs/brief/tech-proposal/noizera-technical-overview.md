# Noizera — Technical Implementation, Architecture & Infrastructure

**v1.0 · September 2026 · companion to the v3.0 pitch**

Scope: the nine-week build in §7 of the pitch (features 1–14), the infrastructure it runs on, and the decisions still open.

---

## 0. Constraints this design is built against

| Constraint | Where it comes from | What it forces |
|---|---|---|
| One engineer, nine weeks | Pitch §7 | Modular monolith. No microservices, no Kubernetes, no service mesh. |
| Fixed infra €50–70/month | Pitch §10 | Two VMs, one object store, no managed anything. |
| 95% gross margin at cap | Pitch §10 | Storage and transcode must be cheap per unit and hard-capped. |
| Unreleased masters | Whole product | Leak protection is a first-class requirement, not a feature. |
| GDPR, EU hosting, listener data | Pitch §12 risk 10 | EU regions only, consent records, export/delete from day one. |
| Permissive licences only | Your standing rule | Flagged per component below; several obvious defaults fail this. |
| API-first, mobile later | Your standing rule | REST + OpenAPI, no server-coupled RPC. |
| Build nothing before Gate 1 | Pitch §8 | Week 0 provisioning starts the day the pilot passes, not before. |

### One thing that affects the pilot, before any of this

The pilot (pitch §7, weeks 1–2) compares two mixes with no code. If the two files are not loudness-matched, **the louder one wins** — that is the single most replicated finding in audio A/B testing, and it will silently corrupt the most important number in the pitch (decision impact, ≥10 of 20).

Before sending any pilot pair, run both through:

```bash
# pass 1 — measure
ffmpeg -i mix_a.wav -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null -
# pass 2 — apply, using measured_* values from pass 1
ffmpeg -i mix_a.wav -af loudnorm=I=-14:TP=-1:LRA=11:measured_I=...:measured_TP=...:\
measured_LRA=...:measured_thresh=...:offset=...:linear=true -c:a aac -b:a 192k mix_a.m4a
```

Two commands per file, and Gate 1 measures preference instead of gain. This is also the exact pipeline productised in §5 below.

---

## 1. Stack

**Given** = your decision, taken as fixed. **Decided** = settled in discussion, with the rejected option and why. **Suggested** = my proposal and the alternative I'd accept. Full list in §18.

| Layer | Choice | Status | Notes |
|---|---|---|---|
| Backend | NestJS 11 (Node 22 LTS) | Given | MIT |
| Frontend | Next.js 15 App Router + React 19 | Given | MIT |
| Database | PostgreSQL 17, dedicated VM | Given | PostgreSQL licence |
| Object storage | Hetzner Object Storage (S3) | Given | Falkenstein or Nuremberg |
| Messaging | RabbitMQ 4 | Given | MPL-2.0, quorum queues |
| Containers | Docker + Compose | Given | |
| Hosting | Hetzner Cloud, 2 VMs | Given | eu-central |
| **ORM** | **Drizzle** | Decided | SQL-first, no runtime magic, TypeScript types inferred from the schema. Migrations via `drizzle-kit`. Trade-off and mitigations in §3.2. *Rejected: MikroORM (closer to EF Core, but a heavier abstraction than this codebase needs); Prisma (anemic models, no unit of work).* |
| **Cache / locks / rate limits** | **Valkey 8** | Suggested | Drop-in Redis fork, BSD-3. Redis went SSPL/RSAL in 2024 and fails your licence rule; Valkey is the same protocol, same clients. |
| **Audio processing** | **ffmpeg + ffprobe** | Suggested | Invoked as a subprocess, never linked — the usual practice, keeps its GPL/LGPL build out of your licence surface. Pin the build in the worker image. |
| **Waveform peaks** | **Own ffmpeg → PCM → peaks JSON** | Suggested | BBC `audiowaveform` is GPLv3; ~60 lines of your own code reading raw PCM from an ffmpeg pipe avoids it entirely and gives you the exact bucket count the player wants. |
| **Player** | **hls.js + Web Audio API** | Suggested | Apache-2.0. Web Audio is what makes instant, click-free A/B switching possible (§6). |
| **Auth** | **Own NestJS module** | **Decided** | Artists: argon2id + rotating refresh tokens in httpOnly cookies. Listeners: no account at all (§7). Design in §3.1. *Rejected: Logto/Zitadel self-hosted — a container and 500MB of RAM for a two-day module; Clerk/Auth0 — a monthly line item and a US processor in your GDPR surface.* |
| **Email** | **Brevo** | Decided | French, EU-hosted, transactional API plus bulk sending in one account, bounce and complaint webhooks. Deliverability setup in §9 — that matters more than the vendor. Watch the free tier's daily send cap (a few hundred/day); a pool-wide invitation batch needs a paid plan, so budget it from week 6. |
| **Payments** | **Stripe Billing + Stripe Tax** | Decided | As named in the pitch. Stripe Tax calculates and reports; **you remain the merchant of record**, so VAT OSS registration and quarterly filing are yours. Integration and the obligation in §15.1. |
| **Provisioning** | **OpenTofu + cloud-init** | Suggested | MPL-2.0. Terraform went BUSL in 2023 and fails your licence rule; OpenTofu is the fork, same `hcloud` provider, same HCL. No Ansible — cloud-init plus Compose covers everything a two-VM estate needs. §11.3 |
| **Reverse proxy / TLS** | **Caddy 2** | Suggested | Apache-2.0. Automatic ACME, HTTP/3, and **on-demand TLS**, which is what makes the Pro tier's custom-domain promise a config block instead of a project. §11.1 |
| **DNS / edge** | **Cloudflare (free)** | Suggested | DNS, WAF, bot rules and Turnstile in front of the app — but deliberately **not** in front of audio. §11.2 |
| **Audio CDN** | **None at MVP** | Suggested | Listeners are Benelux; Hetzner FSN is ~10ms away. Add Bunny (~€0.01/GB EU, token auth) when the pool goes pan-European. Do not put a cache in front of signed URLs without token auth — you will cache a private object under a shared key. |
| Search | Postgres `pg_trgm` + `tsvector` | Suggested | A few thousand tracks. Meilisearch (MIT) if and when the public surface grows. |
| Product analytics | Umami self-hosted | Suggested | MIT. Plausible CE is AGPL, PostHog is partly proprietary — both fail your rule. |
| Errors | GlitchTip self-hosted or Sentry free tier | Suggested | GlitchTip is MIT and Sentry-SDK-compatible. |
| Metrics / logs / traces | OpenTelemetry → Grafana Cloud free tier | Suggested | Loki and Grafana are AGPL; using the hosted free tier keeps that off your machines entirely and costs nothing at this volume. |
| Monorepo | pnpm workspaces + Turborepo | Suggested | Both MIT. |
| Validation / contracts | Zod + `@asteasolutions/zod-to-openapi` | Suggested | One schema package, server validation and generated OpenAPI from the same source. |
| Testing | Vitest + Testcontainers + Playwright | Suggested | Real Postgres and RabbitMQ in integration tests; Playwright on the listener flow only. |
| CI/CD | GitHub Actions → GHCR → SSH deploy | Suggested | §12. |
| Secrets | SOPS + age | Suggested | Both permissive. Encrypted in the repo, decrypted on the VM at deploy. |

---

## 2. System architecture

```
                        ┌───────────────────────────────┐
   artists ──────────►  │  Next.js (SSR + BFF routes)   │
   listeners ────────►  │  · artist workspace           │
   public/Google ────►  │  · listener flow (/l/[token]) │
                        │  · public card  (/a/[slug])   │
                        └───────────────┬───────────────┘
                                        │ REST /api/v1 (OpenAPI)
                        ┌───────────────▼───────────────┐
                        │  NestJS API (modular monolith)│
                        │  identity · catalog · media   │
                        │  sharing · panels · listeners │
                        │  results · billing · admin    │
                        └──┬──────────┬─────────────┬───┘
                           │          │             │
                  outbox   │          │ signed URLs │ cache, locks,
                  relay    │          │             │ rate limits, nonces
                           ▼          ▼             ▼
                    ┌──────────┐  ┌─────────┐  ┌─────────┐
                    │ RabbitMQ │  │ Hetzner │  │ Valkey  │
                    └────┬─────┘  │   S3    │  └─────────┘
                         │        └────┬────┘
        ┌────────────────┼─────────────┼────────────────┐
        ▼                ▼             │                ▼
  ┌───────────┐   ┌────────────┐       │        ┌──────────────┐
  │ transcode │   │  mailer    │       │        │  aggregator  │
  │  worker   │──►│  worker    │       │        │   worker     │
  │ (ffmpeg)  │   └────────────┘       │        └──────┬───────┘
  └─────┬─────┘                        │               │
        └────────────── writes ────────┘               │
                         │                             │
                         ▼                             ▼
                 ┌───────────────────────────────────────┐
                 │  PostgreSQL 17  (separate VM, private)│
                 └───────────────────────────────────────┘
```

All workers are the same NestJS codebase started with a different `APP_ROLE`, sharing the domain layer. One image, four container roles: `api`, `worker-media`, `worker-general`, `web`.

---

## 3. Backend structure

A modular monolith with enforced boundaries — modules talk through application services and domain events, never through each other's repositories. This gives you the extraction path if `media` ever needs to become its own service, without paying distributed-systems cost in week 3.

```
apps/
  api/          NestJS — HTTP + workers, one image
  web/          Next.js
packages/
  contracts/    zod schemas + generated OpenAPI types (shared by api & web)
  domain/       entities, value objects, domain events — no framework imports
  infra/        Drizzle schema + repositories, S3 client, AMQP client
```

**Modules**

| Module | Owns |
|---|---|
| `identity` | accounts, users, memberships, seats, sessions |
| `catalog` | projects, tracks, **versions (version stacking)**, metadata |
| `media` | upload sessions, assets, renditions, transcode orchestration, quota |
| `sharing` | tracked links, recipients, view analytics, revocation |
| `panels` | panel definition, questions, invitations, listener sessions |
| `listeners` | listener identities, declared roles, consent, pool matching, fatigue caps |
| `responses` | comparisons, timestamped reactions, free text, playback telemetry |
| `results` | aggregation, segmentation, confidence language |
| `billing` | Stripe sync, plan entitlements, quota limits |
| `editorial` | placements — revenue from week 1, needs almost no code |
| `admin` | internal ops, moderation, DMCA takedown, impersonation-free support views |

**Entitlements as one object.** Plan limits (storage bytes, panel size, seats, targeting, custom domain) live in a single `PlanEntitlements` value object resolved from the subscription, not scattered as `if (plan === 'pro')` checks. Pricing will change — the pitch already says label pricing should rise once density exists.

### 3.1 Auth

Two populations with almost nothing in common, so two mechanisms and one shared session table.

**Artists and label seats**

- argon2id, `memoryCost=64MB, timeCost=3, parallelism=4`. Not bcrypt.
- Access token: JWT, 15 minutes, in memory on the client only. Refresh token: opaque 256-bit random, hashed at rest, httpOnly + `SameSite=Lax` + `Secure` cookie scoped to the BFF.
- **Refresh rotation with reuse detection.** Every refresh issues a new token and marks the old one used. A second use of a used token means the cookie leaked: revoke the whole token family and force re-login. This is the one piece worth building carefully — it is what makes a stolen cookie a nuisance rather than a breach.
- `sessions` table with device label, IP hash, last seen; a "sign out everywhere" button that actually works. Label accounts hold several artists' unreleased catalogues and will ask for this.
- Password reset and email verification as single-use hashed tokens, 30-minute TTL, invalidated on use and on password change.
- TOTP optional, enforced for accounts with more than one seat. `otplib` (MIT), half a day, week 9.
- Rate limits on `/auth/*` keyed by IP *and* by account: 5 attempts per 15 minutes, then exponential lockout. Valkey-backed.

**Seats and membership.** `memberships(account_id, user_id, role)` with roles `owner | admin | member`. Authorisation is a Nest guard reading membership plus `PlanEntitlements.seats` — a Team account downgrading below its seat count locks the excess members out rather than silently deleting them.

**Listeners** never get a password, a user row, or a session in this table. They get an invitation token and a `listening_sessions` row (§7). Keeping these two systems separate is deliberate: it means a listener database compromise yields no credentials, and it keeps the GDPR deletion path for listeners independent of artist accounts.

**Not now:** social login. Add Google OAuth if signup conversion disappoints after launch — it is a day's work against the same `users` table, and adding it early means two auth paths to secure during the build.

### 3.2 Persistence with Drizzle

Drizzle is a typed query builder, not an ORM in the EF Core sense. It gives you SQL you can read, types inferred from the schema, and no hidden N+1s — which suits the analytics-heavy half of this product, where you'd be dropping to raw SQL anyway. What it does not give you is a Unit of Work, an Identity Map, or change tracking. Three things to do about that, because the domain layer assumes aggregates:

**1. Transactions are explicit and own the aggregate boundary.** One application-service method, one `db.transaction()`, everything inside it — including the outbox insert.

```ts
await db.transaction(async (tx) => {
  const [version] = await tx.insert(versions).values({...}).returning();
  await tx.insert(assets).values({...});
  await tx.insert(outboxMessages).values({
    aggregateType: 'version', aggregateId: version.id,
    type: 'media.uploaded', payload: {...},
  });
});
```

No dirty-checking means no accidental partial writes, but it also means nothing saves itself — the discipline is that a use case never issues writes outside a transaction scope.

**2. Repositories return domain objects, not rows.** Drizzle's inferred row types are tempting to pass straight into the domain, and that's the path to an anemic model. Keep `packages/domain` free of Drizzle imports and map at the repository edge. The mapping is dull and it's the thing that keeps the module boundaries in §3 real.

**3. Optimistic concurrency is manual.** Add a `version int` column to aggregates that can be edited concurrently (panels, subscriptions, accounts) and write `WHERE id = ? AND version = ?`, checking the affected row count. EF Core would have done this from `[ConcurrencyCheck]`; here it's a repository convention you apply deliberately.

**Migrations:** `drizzle-kit generate` produces SQL files that you commit and read before applying. Do not use `drizzle-kit push` outside local development — it diffs against the live database and will happily drop a column. The deploy step applies committed SQL under the advisory lock described in §12.

**Where Drizzle pays off:** the results aggregation in §8 and the pool matching in §7 are set-based queries with window functions and lateral joins. Those would be raw SQL under any ORM; here they're the same tool as everything else, with types on the result.

**Where you'll feel it:** deeply nested loads (panel → invitations → sessions → responses) are explicit joins or several queries you compose yourself. For those, write the SQL once in a repository method and give it a name from the domain.

---

## 4. Data model — the parts that aren't obvious

UUIDv7 primary keys everywhere (time-ordered, index-friendly, no PK-guessing). Timestamps `timestamptz`, UTC.

```sql
-- versions are siblings under a track, not separate tracks
tracks(id, project_id, title, genre_tags[], created_at)
versions(id, track_id, label, ordinal, source_asset_id, is_archived)

-- one original, N renditions; originals are never modified
assets(id, account_id, kind, bucket_key, bytes, mime, checksum_sha256,
       duration_ms, sample_rate, channels, created_at)
renditions(id, version_id, profile, bucket_prefix, lufs_in, lufs_out,
           true_peak, lra, state, error, created_at)

-- listeners exist without accounts
listeners(id, email_hash, email_encrypted, declared_role, genre_affinity jsonb,
          source, created_at, last_invited_at, invites_this_month)
listener_consents(id, listener_id, purpose, granted_at, revoked_at, evidence jsonb)

-- the panel is the unit of work
panels(id, track_id, audience, question_set, target_size, state, opened_at, closed_at)
panel_invitations(id, panel_id, listener_id, token_hash, sent_at, opened_at,
                  started_at, completed_at, state)

-- one row per listener per panel; holds the randomisation seed
listening_sessions(id, panel_id, listener_id, order_seed, version_alias jsonb,
                   ua, ip_hash, started_at, completed_at)

-- append-only, high volume, partition by month once it hurts
playback_events(id, session_id, alias, event, position_ms, at)
reactions(id, session_id, alias, position_ms, kind, at)
comparisons(id, session_id, chosen_alias, confidence, at)
free_text(id, session_id, body, at)

-- infrastructure tables
outbox_messages(id, aggregate_type, aggregate_id, type, payload jsonb,
                created_at, published_at)
processed_messages(message_id PK, consumer, processed_at)
audit_log(id, actor, action, subject_type, subject_id, meta jsonb, at)
```

Three details that matter:

1. **`version_alias`** maps the real version id to a per-session opaque label (`"7f3a" → version_id`). Nothing sent to the listener's browser — not the manifest URL, not the analytics payload, not an error message — ever contains the version id, the label ("Mix B — final master v3"), or the original filename. Blindness is enforced by the data model, not by the UI.
2. **`processed_messages`** gives you consumer idempotency with a unique constraint, in the same transaction as the side effect.
3. **`email_hash`** (HMAC with a server pepper) lets you dedupe and rate-limit listeners without decrypting anything; `email_encrypted` is only read when actually sending.

---

## 5. Audio pipeline

This is the part with real engineering in it. Everything else is CRUD.

```
 browser                  API                  S3                worker
    │                      │                    │                   │
    │ POST /uploads ──────►│ create session,    │                   │
    │                      │ presign multipart  │                   │
    │◄── part URLs ────────│                    │                   │
    │ PUT part 1..N ───────────────────────────►│                   │
    │ POST /uploads/:id/complete ──►│           │                   │
    │                      │ CompleteMultipart─►│                   │
    │                      │ HEAD → real bytes  │                   │
    │                      │ quota check        │                   │
    │                      │ outbox: MediaUploaded                  │
    │◄── 202 accepted ─────│                    │                   │
    │                      │                    │◄── GET original ──│
    │                      │                    │                   │ ffprobe
    │                      │                    │                   │ loudnorm p1
    │                      │                    │                   │ loudnorm p2
    │                      │                    │                   │ HLS package
    │                      │                    │                   │ peaks JSON
    │                      │                    │◄── PUT renditions │
    │                      │◄── RenditionReady ─────────────────────│
    │◄── SSE: ready ───────│                    │                   │
```

**Upload.** Direct-to-bucket presigned multipart (8MB parts). A 500MB WAV master never touches the app VM. The client is Uppy (MIT) with the AWS S3 multipart plugin; resumable, which matters on a phone tethered in a studio.

**Quota, enforced after the fact** — as the pitch specifies. `HEAD` the completed object for the true byte count, compare against `PlanEntitlements.storageBytes`, and on overage delete the object and return `413` with the actual overage. Never trust a client-declared size. A nightly reconciliation job re-sums `assets.bytes` per account against the S3 inventory and repairs drift from failed or abandoned uploads.

**Validation.** `ffprobe` before anything else: real audio, duration under a ceiling, sane sample rate. Reject on mismatch between declared MIME and actual container — the upload path is the one place a stranger can put bytes on your infrastructure.

**Transcode.** Per version:

| Output | Profile | Purpose |
|---|---|---|
| `hls/160k/` | AAC-LC 160kbps, fMP4, 6s segments | Default playback |
| `hls/96k/` | AAC-LC 96kbps | ABR fallback on mobile data |
| `peaks.json` | 1000 buckets, min/max pairs | Waveform, ~8KB |
| `preview.m4a` | 30s, 128kbps | Public card, share previews |

Loudness normalisation is two-pass `loudnorm` to **-14 LUFS integrated, -1 dBTP**, applied to the renditions only. The original is never touched — it is the artist's delivery copy to labels and press, and the pitch sells it as exactly that.

Store the measured values (`lufs_in`, `true_peak`, `lra`). Two uses: show producers the real numbers, which is credibility with the one role that will check; and expose a per-panel **"match loudness" toggle, default on** — an artist testing two masters where loudness *is* the difference needs to turn it off deliberately.

**Cost sanity.** A 4-minute track: ffprobe ~0.2s, two loudnorm passes ~8s, two HLS renditions ~12s, peaks ~2s. Roughly 25 CPU-seconds per version, ~50s per two-version panel. Even 500 panels a month is under four CPU-hours. The pitch's €0.05/track transcode line holds comfortably.

**Concurrency.** Prefetch 1, `--cpus=2` on the media worker container so a burst of uploads can't starve the API. Queue depth is the metric to alert on, not CPU.

---

## 6. Blind A/B — where correctness actually matters

The comparison mechanic is table stakes per the pitch. Getting it *right* is not, and four things have to hold simultaneously:

1. **Loudness matched** — §5.
2. **Order randomised per listener**, stored as `order_seed` so results are reproducible and you can prove there was no position bias.
3. **Identity hidden end to end** — opaque aliases, §4. Also: strip `title`, `artist`, `comment` tags from renditions, and never expose `Content-Disposition` with a real filename.
4. **Instant switching.** If switching from A to B means "stop, seek, buffer, play", the listener judges the transition, not the mix. Load both HLS sources into two `<audio>` elements, wire both through `MediaElementAudioSourceNode` → `GainNode` → destination, keep both playing in sync, and cross-fade the gains over ~20ms on switch. Both start in the same user gesture, which is what iOS requires.

Position sync drifts on mobile; resync B to A's `currentTime` whenever the delta exceeds ~30ms.

**Playback telemetry** is what produces the "attention drops on A at 0:20" line in pitch §5.4:

- `play`, `pause`, `seek`, `switch`, `ended`, plus a heartbeat every 5s with `position_ms`
- batched, sent on `visibilitychange` and via `sendBeacon` on unload
- server-side reconstruction into per-second coverage per alias → drop-off curve, replay count (`18 of 40 listened twice` falls straight out of this)

Telemetry is best-effort and lossy; the comparison choice is not. The choice is a normal authenticated `POST` with its own idempotency key.

---

## 7. Listeners, invitations and the pool

**No accounts.** Pitch §5.2: "no account friction beyond an email." The flow:

```
invitation email ──► /l/{token}
   token = base64(invitation_id).hmac(server_key), single-use, 14-day TTL
        │
        ├─ token valid & unused ──► create listening_session
        │                            set httpOnly session cookie
        │                            record consent (purpose, timestamp, text version)
        │                            ask declared_role if unknown
        │                            ──► comparison flow
        └─ used or expired ───────► "request a new link" → magic link
```

The token is stored hashed. Consuming it is a conditional `UPDATE ... WHERE state = 'sent'` so a double-click cannot open two sessions.

**Pool matching (feature 11 — the moat in product form).** Deterministic SQL scoring in year one, not ML:

```
score = genre_affinity_match * 3
      + role_match_for_requested_segment * 2
      + recency_penalty(last_invited_at)
      - fatigue_penalty(invites_this_month)
where invites_this_month < monthly_cap
  and listener has no open invitation for this artist
```

`monthly_cap` is a config value, start at 4. Pitch §10 names listener burnout as a critical, unrecoverable risk — this cap is the code that implements that policy, and it should be visible in an admin dashboard from day one alongside repeat-participation rate (the kill criterion is below 30% by month 6, so instrument it in week 8, not month 5).

**Closing the loop.** The same §10 mitigation requires telling listeners what happened: when a panel closes, the artist can publish a short result note, and every participant gets one email — "the artist chose mix B". This is one queue consumer and it is the cheapest retention mechanism you will ever build.

---

## 8. Results and statistical honesty

Aggregation runs as a worker on `panel.closed` and on a debounce during an open panel, writing to a `panel_results` snapshot. Raw response tables are never queried directly by the UI.

Honesty is enforced in code, not in copy:

- Always render **raw counts with the denominator** — `31 of 40`, never a bare `78%`.
- Segments below a floor (start at n=5) render as `4 of 5 producers — too few to read` and are excluded from any headline.
- No composite score, no letter grade, no "readiness" number. Pitch §5.4 makes refusing to fake certainty a positioning decision against Unreleased's AI score. That means there is no `overall_score` column in the schema — the absence is deliberate, and it should be a code comment so future-you doesn't add one during a growth push.

---

## 9. Messaging

**Topology**

```
noizera.events    (topic, durable)   domain events, fan-out
noizera.commands  (direct)           work items
noizera.dlx       (topic)            dead letters
noizera.retry     (direct + TTL)     5s / 30s / 5m staged retry
```

**Queues** (all quorum): `media.probe`, `media.transcode`, `media.transcode.priority`, `notifications.email`, `panels.matching`, `panels.results`, `analytics.rollup`, `storage.reconcile`.

The `.priority` queue exists so a Team-tier upload doesn't sit behind a free-tier batch. Same consumer, higher weight.

**Transactional outbox.** Domain writes and their events commit in one Postgres transaction. A relay polls every 250ms with `SELECT ... FOR UPDATE SKIP LOCKED LIMIT 100`, publishes with publisher confirms, marks `published_at`. No dual writes anywhere in the codebase — the API never calls `channel.publish()` directly.

**Consumer contract**, uniformly: idempotency via `processed_messages`, manual ack after commit, staged retry then DLQ, structured log with `message_id` and `correlation_id`. Every DLQ has an alert; a silently filling DLQ is the classic solo-founder outage.

**Email deliverability** deserves a paragraph because it is a real failure mode here. You are sending several hundred invitations to people who have never received mail from your domain. Non-negotiable:

- dedicated subdomain (`mail.noizera.app`), SPF + DKIM + DMARC (`p=quarantine`)
- separate streams for transactional and invitations, so a bad invitation batch can't take down password resets
- `List-Unsubscribe` and `List-Unsubscribe-Post` headers on every invitation
- bounce and complaint webhooks → automatic suppression list, enforced at send time
- warm-up: start at ~50/day and climb, which means the pool email flow should exist by week 6, not week 9

**Brevo specifics.** Transactional and campaign sending live in one account — use the transactional API for both, and separate them with tags and a distinct sending subdomain rather than relying on Brevo's campaign tooling, so suppression logic stays in your database where the fatigue caps already are. Wire the bounce, spam and unsubscribe webhooks to a single `POST /webhooks/brevo` handler on day one, verified by signature, writing to a `suppressions` table checked at send time. Keep templates in your repo and pass them as raw HTML rather than using Brevo's template editor — a template that only exists in a vendor UI is a piece of your product you can't review, diff or roll back. No dedicated IP at this volume; a shared pool with good DKIM alignment outperforms a cold dedicated IP until you're sending tens of thousands a month.

---

## 10. Frontend

Three surfaces with genuinely different requirements:

| Surface | Route | Rendering | Requirement |
|---|---|---|---|
| Artist workspace | `/app/*` | Client-heavy, server components for loading | Uploads, versions, panels, results |
| Listener flow | `/l/[token]` | SSR, minimal JS, mobile-first | Under 3 minutes, works on a bus, no account |
| Public card | `/a/[slug]` | Static + ISR | Indexed by Google, JSON-LD `MusicGroup` / `MusicRecording`, sitemap |
| Share link | `/s/[token]` | SSR | Tracked, revocable, per-recipient analytics |

**BFF pattern.** Next.js route handlers hold the httpOnly cookie and proxy to NestJS. No access token ever reaches client JS. The public REST API stays token-authenticated and unchanged, so a mobile client later uses the same endpoints.

**Listener flow budget:** under 150KB of JS before audio. This is the only page whose performance affects the company's core metric — a listener who bounces on load is indistinguishable in your Gate 1 data from a listener who didn't care.

**Realtime:** SSE from NestJS for transcode progress. WebSockets buy nothing here and cost you sticky-session handling.

---

## 11. Infrastructure

```
                         Internet
                             │
                    ┌────────▼────────┐
                    │  Hetzner FW     │  22 (key only, IP-restricted), 80, 443
                    └────────┬────────┘
                             │
        ┌────────────────────▼──────────────────────┐
        │  vm-app   (CPX32-class, 4 vCPU / 8 GB)    │
        │  ┌─────────────────────────────────────┐  │
        │  │ caddy    TLS, HTTP/3, reverse proxy │  │
        │  │ web      Next.js standalone         │  │
        │  │ api      NestJS  (x2 replicas)      │  │
        │  │ worker-media    ffmpeg, --cpus=2    │  │
        │  │ worker-general  email, results      │  │
        │  │ rabbitmq        quorum queues       │  │
        │  │ valkey          cache, locks        │  │
        │  │ umami           analytics           │  │
        │  └─────────────────────────────────────┘  │
        └────────────────────┬──────────────────────┘
                             │ private network 10.0.0.0/16
                             │ (no public IP on db)
        ┌────────────────────▼──────────────────────┐
        │  vm-db   (CPX22-class, 2 vCPU / 4 GB)     │
        │  postgres 17  +  pgbackrest               │
        │  attached volume for PGDATA (resizable)   │
        └───────────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │ Hetzner S3      │  originals, renditions, backups
                    │ eu-central      │  versioning on, lifecycle rules
                    └─────────────────┘
```

**Network.** Private network between the VMs, Postgres bound to the private interface only, no public IPv4 on `vm-db`. Cloud firewall allows 443/80 to `vm-app` and 5432 only from `vm-app`'s private IP. SSH by key, restricted to your IP plus a fallback; Tailscale (MIT) is worth the ten minutes if you administer from more than one place.

**Postgres config** for 4GB: `shared_buffers=1GB`, `effective_cache_size=3GB`, `work_mem=16MB`, `max_connections=100` with PgBouncer in transaction mode on the app side (Node connection pools plus workers will otherwise exhaust it). Enable `pg_stat_statements` on day one.

**Volumes.** `PGDATA` on an attached Hetzner volume rather than the VM disk — resizing a volume is a live operation, resizing a VM disk is not.

**Backups.**

| What | How | Target | Retention |
|---|---|---|---|
| Postgres | pgBackRest, weekly full + daily incremental + WAL archiving | S3 bucket | 30 days, PITR |
| Restore verification | automated restore into a scratch container, checksum a known row | — | monthly, alerting |
| Originals | bucket versioning + weekly `rclone` copy to a Storage Box | second location | 90 days |
| Renditions | none — regenerable from originals | — | lifecycle-expire orphans at 30d |
| VM state | Hetzner snapshots | Hetzner | weekly, 4 |

The asymmetry is deliberate. Renditions are derived and cheap to rebuild. **An artist's unreleased master is not recoverable and losing one is a trust event the company does not survive** — hence versioning plus an off-bucket copy for originals only.

### 11.1 Reverse proxy — Caddy

The deciding factor is a product requirement, not a preference. Pro and Team tiers promise custom domains (pitch §9), which means issuing a TLS certificate for a hostname you did not know about at deploy time. Caddy does that natively:

```caddyfile
{
  on_demand_tls {
    ask http://api:3000/internal/tls/allow    # 200 = issue, anything else = refuse
    interval 2m
    burst 5
  }
}

noizera.app, www.noizera.app {
  encode zstd gzip
  handle /api/* { reverse_proxy api:3000 { lb_policy least_conn; health_uri /healthz } }
  handle       { reverse_proxy web:3000 }
}

https:// {
  tls { on_demand }                            # customer custom domains
  reverse_proxy web:3000 { header_up X-Custom-Domain {host} }
}
```

The `ask` endpoint checks the hostname against verified custom domains in your database. Without it, on-demand TLS is an open certificate-issuance endpoint and Let's Encrypt will rate-limit you off the internet — this is the one line in the config that must not be wrong.

Everything else follows: HTTP/3, automatic renewals, health-checked round-robin over two `api` replicas for zero-downtime deploys, and a Caddyfile short enough to read in one screen.

Traefik (MIT) is the reasonable alternative — Docker label routing is nice, and if you later run several products on one host it ages better. It handles custom domains through its ACME resolver, but without an equivalent of the `ask` gate you end up writing that check into a dynamic-config generator. nginx is the wrong choice here specifically: certbot plus a reload loop per customer domain is a moving part you'd be maintaining by hand.

### 11.2 Cloudflare — yes for the app, no for the audio

**Use it for**

| Function | Plan | Why |
|---|---|---|
| Authoritative DNS | Free | Fast API, first-class OpenTofu provider, and where your SPF/DKIM/DMARC records live anyway |
| Proxy + WAF on `noizera.app` | Free | DDoS absorption and managed rules in front of a single unredundant VM |
| Bot and rate rules | Free | The signup and invitation endpoints are the abuse surface |
| **Turnstile** | Free | CAPTCHA on signup and listener email capture that doesn't ask a listener to identify a bus. The listener flow has a three-minute budget; a puzzle spends a third of it |
| Caching for `/a/[slug]` | Free | The public card is static and SEO-facing |
| Origin IP concealment | Free | With the Hetzner firewall restricted to Cloudflare's IP ranges, the VM isn't directly reachable |

**Don't use it for audio.** Two independent reasons. Mechanically, your segment requests 302 to a presigned Hetzner URL, so the bytes bypass Cloudflare regardless of what's orange-clouded. Contractually, Cloudflare's terms restrict serving large media files through the CDN on the free and Pro plans outside Stream or R2 — routing a music platform's streaming traffic through a free zone is the classic way to receive an unpleasant email. Audio stays on Hetzner's bill at ~€1/TB, which is cheap and unambiguous.

**Three consequences to handle:**

1. **Caddy can't use HTTP-01 on proxied hostnames.** Either install a Cloudflare Origin Certificate on Caddy with Full (Strict) mode, or build Caddy with the Cloudflare DNS module and use DNS-01. The origin certificate is simpler and lasts 15 years.
2. **Custom domains must not be orange-clouded.** Customers CNAME to a separate unproxied hostname (`edge.noizera.app`) so Caddy's on-demand TLS sees a real HTTP-01 challenge.
3. **Cloudflare terminates TLS, so it sees plaintext** — including listener email addresses. That makes it a processor under GDPR. Their DPA covers it and SCCs apply, but data localisation to the EU is a paid add-on. If that sits badly against a pitch that sells EU hosting, the fallback is DNS-only (grey cloud) with Caddy terminating TLS directly: you keep the DNS and lose the WAF. Turnstile stays available either way.

My read: orange-cloud the app, note Cloudflare in the subprocessor list, and revisit if a label asks for a data-residency guarantee.

**Cloudflare R2** is worth knowing about but not switching to — zero egress is genuinely better than €1/TB, but you'd be trading an EU-jurisdiction store for a US one to save a few euros a month on a line item that's already inside your included allowance.

### 11.3 Infrastructure as code

Two layers, deliberately not three.

```
infra/
  tofu/
    main.tf            hcloud + cloudflare providers
    network.tf         private net 10.0.0.0/16, subnet, firewalls
    servers.tf         vm-app, vm-db, volume, cloud-init user_data
    storage.tf         buckets (S3 provider), lifecycle rules, versioning
    dns.tf             A/AAAA, MX, SPF, DKIM, DMARC, _acme
    outputs.tf         IPs consumed by the deploy workflow
  cloud-init/
    app.yaml           users, sshd hardening, docker, fail2ban, node_exporter
    db.yaml            same + postgres, pgbackrest, volume mount
  compose/
    docker-compose.yml         app services
    docker-compose.db.yml      postgres
```

**OpenTofu owns things that change monthly**: servers, volumes, private network, firewall rules, buckets and lifecycle policies, DNS records, SSH keys, Cloudflare zone settings and WAF rules. **Compose owns things that change daily**: the application containers. Keeping the deploy path out of Tofu is what stops a routine release from ever running `tofu apply`.

**State.** The usual advice — S3 backend with locking — doesn't transfer cleanly, because Hetzner Object Storage's support for the conditional writes that OpenTofu's native S3 locking depends on isn't something to assume; verify it before relying on it. For a single operator the simpler answer is better: local state encrypted with SOPS + age and committed to the repo. You already have age keys for `.env`. One operator means no lock contention, and the state file is then versioned alongside the config that produced it. Revisit if a second engineer joins — that's the trigger, not scale.

**Bootstrap order.** Object storage and DNS first, then network and firewalls, then servers. cloud-init brings a VM to "Docker running, SSH hardened, user created" and stops — it does not deploy the app. A destroyed and recreated `vm-app` should be back in service from `tofu apply` plus one deploy workflow run, and that recovery path is the actual point of doing this rather than clicking in the console.

**In CI:** `tofu plan` on pull requests against `infra/**`, `apply` manual and gated. Never on push to main — infrastructure and application releases want different blast radii.

**Worth pinning:** provider versions, the Ubuntu image, and the ffmpeg build in the worker Dockerfile. Reproducibility on a solo project means being able to rebuild the estate in a year, and unpinned versions are how that quietly stops being true.

---

## 12. Deployment

```
git push main
   └─► GitHub Actions
         ├─ lint, typecheck, unit
         ├─ integration (Testcontainers: postgres + rabbitmq)
         ├─ playwright on the listener flow
         ├─ docker buildx → ghcr.io/…/{api,web}:sha
         └─ ssh vm-app:
              sops -d .env.enc > .env
              docker compose pull
              docker compose run --rm api node dist/migrate.js   # advisory-locked
              docker compose up -d --no-deps --wait api web workers
```

Migrations run as a one-shot container holding a Postgres advisory lock, so two concurrent deploys can't both migrate. Caddy handles TLS and does the zero-downtime part via healthchecks and two `api` replicas.

No staging environment until Gate 2. One environment plus a full local compose stack is the right trade for nine weeks; add staging the week you take a paying label account.

Alternatives if you'd rather not hand-roll the deploy step: **Kamal 2** (MIT, built for exactly this shape — Docker on plain VMs, zero-downtime, no orchestrator), **Dokploy** or **Coolify** (both Apache-2.0, a UI over the same idea).

---

## 13. Observability

| Signal | Tool | Cost |
|---|---|---|
| Errors | GlitchTip (self-hosted, MIT) or Sentry free | €0 |
| Logs / metrics / traces | pino + prom-client + OTel → Grafana Cloud free | €0 |
| Uptime | Uptime Kuma on a €4 box, or Better Stack free | ~€0–5 |
| Product | Umami self-hosted | €0 |

**Alerts worth having on day one** (everything else is noise at this scale):

1. Any DLQ depth > 0
2. `media.transcode` queue depth > 20 or oldest message > 10 min
3. p95 transcode latency > 120s
4. Listener-flow 5xx rate > 1%
5. Postgres disk > 75%, S3 usage > 80% of the current billing tier
6. Bounce rate > 3% or complaint rate > 0.1% on invitations
7. Failed backup or failed monthly restore verification

Correlation id generated at the edge, propagated through HTTP headers and AMQP message headers into every log line. Solo debugging without this is misery.

---

## 14. Security & GDPR

**Threat model, ranked by what actually hurts:**

1. An unreleased master leaks → primary trust failure
2. Listener email list is exfiltrated → GDPR incident plus the asset itself
3. Storage abuse by a free account → cost, but capped by design
4. Account takeover of a label account → multi-artist exposure

**Leak controls, layered:**

- **Delivery: signed URLs direct from the bucket, with the manifest and a redirect hop owned by the API.** Mechanics below.
- Object keys are random UUIDs. No filenames, no titles, no artist names, anywhere in a URL.
- **Revocation** (feature 6, sold as instant): revoking marks the share or session dead, so the manifest endpoint refuses on the next request; already-signed segments die at TTL, bounding exposure to five minutes. Say exactly that in the UI rather than implying a hard cut — "revoked, access ends within 5 minutes" is both true and more credible than "instant".
- Originals are downloadable only by the owning account, via a 60-second presigned URL, every download written to `audit_log`.
- Per-listener watermarking is deferred (pitch §7) but the `renditions` table is keyed to allow per-listener variants later without a migration.

**Playback delivery, in detail.** Audio bytes go straight from Hetzner to the listener; the app VM never carries them.

```
GET /playback/{session}/{alias}/master.m3u8      → API: authorise session, return
                                                   playlist with relative segment paths
GET /playback/{session}/{alias}/seg/{n}.m4s      → API: authorise, 302 →
                                                   presigned bucket URL, 120s TTL
                                                   (~250 bytes, no audio through the VM)
```

The redirect hop is what makes the choice work. Signing every segment inside the manifest at fetch time is the obvious approach and it has a quiet failure: an HLS VOD playlist is fetched once and never reloaded, so a listener who pauses for longer than the TTL and resumes gets 403s on the remaining segments. The options are a TTL long enough to cover any session — which is exactly the long-lived shareable URL you don't want on an unreleased master — or re-signing on demand. The redirect gives you the second at ~1KB of bandwidth per playback.

It also buys three things worth having:

- **Revocation is genuinely immediate for anything not yet fetched.** Segments already in the browser cache are gone; nothing further loads. "Access ends now for anything they haven't already heard" is defensible in the UI.
- **Per-segment audit.** You see exactly how far a recipient got on a tracked link, which is feature 5's analytics for free.
- **Abuse detection.** A client pulling every segment of every version in sequence with no playback events is someone ripping the vault, not listening. Rate-limit segment requests per session to modestly above real-time and alert on the pattern.

Cost of the hop: one Valkey lookup and one HMAC per segment, roughly 40 requests per track. Negligible, and `--cpus` limits on the media worker keep transcode bursts from competing with it.

`hls.js` follows 302s natively, so this needs no custom loader. Set `Cache-Control: private, max-age=0` on the redirect so intermediaries never hold it.

**GDPR, built in rather than retrofitted:**

- Hetzner EU regions only; subprocessor list and DPAs for the email provider, Stripe, and Grafana Cloud from day one
- Consent records with purpose, timestamp and the version of the text consented to
- `GET /me/export` (JSON + audio manifest) and `DELETE /me` with a 30-day soft window, implemented as a saga: anonymise responses, drop PII, keep aggregate counts so a deletion doesn't silently rewrite a panel result an artist already acted on
- IP addresses hashed with a rotating salt, never stored raw
- Retention: playback telemetry 24 months, then roll into aggregates and drop rows
- A record-of-processing document — as a solo controller you still need one, and writing it takes an hour

**DMCA / takedown** (pitch risk 10): a documented address, an admin action that disables an asset and all its share links in one transaction, and an audit trail. Half a day in week 9.

---

## 15. Cost

Hetzner raised cloud prices twice in 2026 (April, then June 15), and the cheap CX/CAX cost-optimised line has been showing as unavailable to order as recently as early September — plan against CPX pricing, and re-check before provisioning.

| Line | Spec | €/month |
|---|---|---|
| vm-app | 4 vCPU / 8 GB, 20TB traffic | ~40 |
| vm-db | 2 vCPU / 4 GB | ~20 |
| Volume for PGDATA | 40 GB | ~2 |
| Object storage | base: 1 TB storage + 1 TB egress | 4.99 |
| Snapshots | ~30 GB | ~0.5 |
| Email | ~5k messages | 1–10 |
| Domain, TLS, observability | Caddy + free tiers | 0 |
| **Total** | | **~€68–78** |

Slightly above the pitch's €50–70, and the June price increase is why. Two ways to respond:

- **Consolidate** — one dedicated server (AX-line auction, ~€37–40/month) gives you 6–12 real cores and 64GB for less than the two VMs, and transcoding is CPU-bound. The cost is losing VM-level isolation between app and database, and a slower path back from hardware failure. Given backups to object storage and a rebuild script, that is a defensible trade for a pre-revenue product.
- **Absorb it** — €78 is still break-even at 6 paying artists, which is exactly what the pitch claims. The claim survives the price rise.

**Egress is not actually zero**, which the pitch's unit economics assume. Hetzner Object Storage includes 1 TB of egress in the €4.99 base and charges roughly €1/TB beyond. At 30 listeners × 2 versions × 4 minutes × 160kbps ≈ 230 MB per panel, you get ~4,300 panels inside the included allowance. The zero holds in practice for year one; it is a rounding difference, not an error, but the line should read "included" rather than "free" if an investor reads it closely.

### 15.1 Billing integration and VAT

**Integration shape.** Stripe Checkout for the first purchase and the Customer Portal for upgrades, downgrades, payment-method changes and cancellation. That is a few hours of work instead of a few days, and it keeps card data entirely out of your PCI scope. Plans are Stripe Prices; your database stores only the subscription id, the resolved plan, and the period end.

**Webhooks are the source of truth**, not the Checkout redirect — a customer who closes the tab still paid. The handler:

```
POST /webhooks/stripe
  → verify signature
  → INSERT INTO stripe_events (id) ON CONFLICT DO NOTHING   -- idempotency, Stripe retries
  → if inserted: update subscription + entitlements, enqueue side effects via outbox
  → 200 fast; never do slow work inline, Stripe times out at 20s
```

Events that matter: `checkout.session.completed`, `customer.subscription.updated|deleted`, `invoice.paid`, `invoice.payment_failed`. Handle them in any order — they do arrive out of order — by treating each as "reconcile this subscription against Stripe's current state" rather than as a delta.

**Downgrade is the interesting case.** A Team account dropping to Artist goes from 500GB to 50GB. Deleting overage automatically is indefensible when the files are unreleased masters. Instead: freeze uploads, mark the account over quota, email a 30-day window, and after that make the excess read-only and downloadable rather than deleted. Write this rule down now — it will be a support conversation at some point and you want the answer to be policy, not improvisation.

**The VAT obligation you now own.** Stripe Tax calculates rates, validates VAT numbers and produces reports; it does not file anything. As a Belgian seller of digital services to EU consumers, you register for the **OSS scheme** through Intervat, charge each buyer's local rate, and file quarterly. B2B sales to VAT-registered businesses in other member states are reverse-charged — Stripe Tax handles the mechanics if you collect and validate the VAT number at checkout, so make that field prominent for the Team tier, where most customers will have one. Enable Stripe Tax before the first sale; retroactive fixes are miserable.

Budget ~2.9% + €0.25 per transaction, roughly €0.48 on a €15 subscription, which is what the pitch's unit economics already assume.

---

## 16. Nine-week sequence

Contingent on Gate 1. Mapped to pitch §7 feature numbers.

| Week | Ships | Features |
|---|---|---|
| 1 | Repo, CI, OpenTofu estate (VMs, network, firewall, buckets, DNS), cloud-init, Caddy, Postgres, RabbitMQ, auth, accounts, health checks, first deploy | — |
| 2 | Presigned multipart upload, quota enforcement, ffprobe validation, asset model | 1 |
| 3 | Transcode worker: loudnorm, HLS, peaks. Player with waveform. Outbox + first consumers | 1–2 |
| 4 | Projects, tracks, **version stacking**, artist workspace | 3 |
| 5 | Tracked share links, per-recipient analytics, revocation | 4–6 |
| 6 | Panels, invitations, listener onboarding, role declaration, email infrastructure + warm-up | 7, 12 |
| 7 | Blind comparison flow, A/B switching, timestamped reactions, telemetry | 8–9 |
| 8 | Results aggregation, segmented view, **Noizera pool matching + fatigue caps** | 10–11 |
| 9 | Stripe, public card + JSON-LD, GDPR export/delete, takedown, hardening, launch | 13–14 |

**Where this slips.** Weeks 3 and 7 are the ones with unknowns — ffmpeg edge cases on real-world files (broken WAV headers, 32-bit float, 88.2kHz, Apple Loops metadata) and mobile Web Audio behaviour, particularly iOS.

**The cut list, in order:** Instagram follower verification (feature 12 — see below), the 96k ABR rendition, Umami, the public card's design polish. Do not cut: loudness matching, blindness, the fatigue cap, backups.

**Feature 12 is a trap.** Instagram does not expose a user's follower list to third-party apps; there is no supported API that lets you verify "this person follows @noizera". Anything you build here is either a scraper (against terms, and it will break) or a manual honour-system claim. Recommend: drop verification, ask listeners to self-declare how they found you, and use invitation-source tracking instead — it gives you the same data for the pool, with none of the platform risk. This also softens pitch risk 8.

---

## 17. Deliberately not built

Kubernetes. Microservices. A separate auth service. Elasticsearch. A CDN. Multi-region. Read replicas. Event sourcing (the outbox gives you the integration benefits; the audit table gives you the forensic ones; full ES costs weeks and buys nothing at this size). A design system. A mobile app. Server-side rendering of waveforms. ML-based matching. Watermarking.

Each of these has a trigger condition rather than a "never": read replica when analytics queries exceed 100ms p95; CDN when more than 30% of listeners are outside the Benelux; Meilisearch when the public surface exceeds ~10k documents; a third VM for workers when transcode queue depth alerts fire more than twice a week.

---

## 18. Decisions

**Settled**

| # | Decision | Outcome | Where |
|---|---|---|---|
| 1 | Playback delivery | Signed URLs direct from the bucket, manifest and segment redirects owned by the API | §14 |
| 2 | Auth | Own NestJS module — argon2id, rotating refresh tokens with reuse detection, listeners passwordless | §3.1 |
| 3 | Worker placement | ffmpeg workers on `vm-app` with `--cpus=2`; split to a third VM when `media.transcode` depth alerts twice in a week | §11, §13 |
| 4 | Provisioning | OpenTofu + cloud-init, SOPS-encrypted local state; Compose owns releases, Tofu never does | §11.3 |
| 5 | Reverse proxy | Caddy, chosen for on-demand TLS behind an `ask` gate — the custom-domain feature | §11.1 |
| 6 | Edge | Cloudflare free for DNS, WAF, Turnstile and the public card; audio bypasses it entirely | §11.2 |
| 7 | Email | Brevo — EU-hosted, one account for transactional and bulk, suppression logic kept in your own database | §9 |
| 8 | Payments | Stripe Billing + Stripe Tax + Checkout/Portal; you are merchant of record and file VAT OSS quarterly | §15.1 |
| 9 | ORM | Drizzle — explicit transactions, mapping at the repository edge, manual optimistic concurrency | §3.2 |

**Still open**

Nothing blocking. Two things to decide during the build rather than before it:

| # | Decision | When | Note |
|---|---|---|---|
| 10 | Dedicated sending IP | ~month 6 | Only once volume justifies it; a cold dedicated IP is worse than a warm shared pool |
| 11 | Bunny CDN for audio | When >30% of listeners are outside the Benelux | §1, and it needs token auth rather than passed-through signed URLs |

Smaller ones, defaulted unless you object: UUIDv7 keys · Caddy over Traefik · pnpm + Turborepo · SOPS+age for secrets · Grafana Cloud free tier over self-hosted Loki · Umami over Plausible (licence) · Valkey over Redis (licence) · no staging until Gate 2 · Postgres full-text search until ~10k documents.
