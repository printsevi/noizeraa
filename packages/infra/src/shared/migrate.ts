import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";

// Arbitrary constant, shared by every deploy so two concurrent
// migration runs serialize instead of racing (tech proposal §12). Must
// never change once deployed — a different value stops serializing
// against runs already using the old one.
const MIGRATION_LOCK_KEY = 72190001;

// Opens one connection, holds a session-level Postgres advisory lock
// for the duration of the migration, and always releases it (even on
// failure) by closing the connection. `pg_advisory_lock` blocks until
// held, so a second concurrent call waits rather than racing.
export async function runMigrations(connectionString: string): Promise<void> {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query("select pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: `${__dirname}/../../drizzle` });
  } finally {
    await client.end();
  }
}
