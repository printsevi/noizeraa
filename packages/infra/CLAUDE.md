# packages/infra

Drizzle schema + repositories, the S3 client, and the AMQP client. See tech proposal §1, §3.2 and root `CLAUDE.md`.

## Rules

- Repositories return `@noizera/domain` objects, **never raw Drizzle row types** — map at the repository boundary. Callers in `apps/api` should never see a Drizzle inferred type.
- Optimistic concurrency is manual: entities needing it carry an explicit `version` column, checked and incremented in the repository's update method — no ORM-level magic.
- Transactions are explicit (`db.transaction(...)`), not implicit — this is a deliberate tradeoff of typed SQL over a full ORM (tech proposal §1).
- Any outbound message goes through the transactional outbox pattern: write the outbox row in the same transaction as the domain change, never call `channel.publish()` directly from a repository or service. Inbound consumers must be idempotent via the `processed_messages` table.
- S3 usage is Hetzner's S3-compatible endpoint, EU region — audio bytes are presigned direct-to-bucket; this package should not proxy audio bytes through the app.
- Testcontainers (Postgres/RabbitMQ/Valkey) is the test level for this package per the `tdd` skill — no mocking the database in integration tests.
