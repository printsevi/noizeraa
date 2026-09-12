// Cross-module infrastructure that every backend module may import:
// the Drizzle client/transaction helper, the transactional outbox,
// processed_messages (consumer idempotency), the S3 client and the
// AMQP client. Module-owned repositories live in ../<module>/ and are
// exported as @noizera/infra/<module>; dependency-cruiser only allows
// apps/api/src/<module> to import its own subpath plus this one.
export {};
