import { defineConfig } from "drizzle-kit";

// `generate` diffs the schema against committed SQL in `drizzle/` and
// does not connect to a live database — `dbCredentials` is required by
// drizzle-kit's config schema regardless, so it reads DATABASE_URL for
// the commands (`push`, `studio`) that do connect. `drizzle-kit push`
// itself is blocked by .claude/hooks/guard-bash.mjs (tech proposal §3.2:
// only generate + committed SQL, never push, outside local dev).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/*/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgres://noizera:noizera@localhost:5432/noizera",
  },
});
