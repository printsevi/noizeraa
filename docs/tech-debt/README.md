# Tech debt register

One entry per known shortcut or deferred decision, each with an explicit **trigger condition** — the observable signal that means it's time to revisit, not a vague "later." An entry without a trigger condition isn't tech debt, it's just a TODO comment; give it one or move it out of this register.

The tech proposal already named several of these before any code existed — seeded below so they aren't lost. Add new entries as `NNN-short-slug.md` using `TEMPLATE.md`; keep the seeded ones updated in place rather than duplicating them once code exists.

## Seeded from the tech proposal (§17, §18)

| Debt                                                                     | Trigger condition                                                                 | Source                 |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ---------------------- |
| No CDN in front of audio                                                 | More than 30% of listeners are outside the Benelux                                | tech proposal §1, §18  |
| No dedicated Brevo sending IP                                            | ~month 6, once volume justifies it                                                | tech proposal §9, §18  |
| Workers co-located on `vm-app`                                           | `media.transcode` queue-depth alerts fire more than twice in a week               | tech proposal §11, §18 |
| No read replica                                                          | Analytics queries exceed 100ms p95                                                | tech proposal §17      |
| Postgres full-text search (`pg_trgm`/`tsvector`) instead of Meilisearch  | Public/search surface exceeds ~10k documents                                      | tech proposal §1, §18  |
| No staging environment                                                   | The first paying label account                                                    | tech proposal §12      |
| Local Tofu state (SOPS+age, no remote backend/locking)                   | A second engineer joins the project                                               | tech proposal §11.3    |
| Instagram follower verification dropped in favor of self-declared source | Revisit only if invitation-source self-report proves unreliable for pool matching | tech proposal §16      |
