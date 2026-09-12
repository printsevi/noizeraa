// Drizzle schema + repositories, the S3 client, and the AMQP client live
// here. Repositories return domain objects from @noizera/domain, never
// raw Drizzle row types — see tech proposal §3.2 and CLAUDE.md.
//
// Layout: src/shared/ (db client, outbox, S3, AMQP — importable by any
// module) and src/<module>/ (that module's schema + repositories,
// importable only by apps/api/src/<module>). Each is a package subpath
// export; this root index deliberately re-exports nothing module-owned
// so a module can't reach another's repository through it.
export * from "./shared";
