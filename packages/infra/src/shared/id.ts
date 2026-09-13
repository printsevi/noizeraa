import { uuidv7 } from "uuidv7";

// Postgres 17 has no native uuidv7() (that lands in PG18), so ids are
// generated application-side and passed in as literal values. Use this
// as a Drizzle `$defaultFn` on every table's `id` column — tech
// proposal §4: "UUIDv7 primary keys everywhere".
export function newId(): string {
  return uuidv7();
}
