import { runMigrations } from "@noizera/infra/shared";

// Thin CLI entrypoint for the deploy step (tech proposal §12):
// `docker compose run --rm api node dist/migrate.js`. All the logic
// (advisory lock, migrator) lives in @noizera/infra/shared, tested
// there via Testcontainers.
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to run migrations");
  }

  await runMigrations(connectionString);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
