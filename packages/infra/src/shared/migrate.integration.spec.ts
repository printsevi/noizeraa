import { PostgreSqlContainer } from "@testcontainers/postgresql";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "./migrate";

describe("runMigrations", () => {
  let container: StartedPostgreSqlContainer;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:17").start();
  }, 120_000);

  afterAll(async () => {
    await container.stop();
  });

  it("applies the committed migrations against a fresh database", async () => {
    const connectionString = container.getConnectionUri();

    await runMigrations(connectionString);

    const client = new Client({ connectionString });
    await client.connect();
    try {
      const result = await client.query(
        "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
      );
      const tableNames = result.rows.map((row) => row.table_name as string);

      expect(tableNames).toEqual(
        expect.arrayContaining([
          "audit_log",
          "outbox_messages",
          "processed_messages",
        ]),
      );
    } finally {
      await client.end();
    }
  });

  it("is idempotent: running it twice does not error and does not touch existing data", async () => {
    const connectionString = container.getConnectionUri();

    await runMigrations(connectionString);

    const client = new Client({ connectionString });
    await client.connect();
    try {
      await client.query(
        "insert into audit_log (id, actor, action, subject_type, subject_id) values (gen_random_uuid(), 'test', 'seeded', 'thing', gen_random_uuid())",
      );

      await runMigrations(connectionString);

      const result = await client.query(
        "select count(*)::int as count from audit_log",
      );
      expect(result.rows[0].count).toBe(1);
    } finally {
      await client.end();
    }
  });

  it("a concurrent run waits for the advisory lock instead of racing", async () => {
    const connectionString = container.getConnectionUri();

    const holder = new Client({ connectionString });
    await holder.connect();
    // Same constant as runMigrations' MIGRATION_LOCK_KEY.
    await holder.query("select pg_advisory_lock(72190001)");

    let finished = false;
    const pending = runMigrations(connectionString).then(() => {
      finished = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(finished).toBe(false);

    await holder.query("select pg_advisory_unlock(72190001)");
    await holder.end();

    await pending;
    expect(finished).toBe(true);
  }, 30_000);
});
