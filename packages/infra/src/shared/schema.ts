import {
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { newId } from "./id";

// Module-agnostic infrastructure tables, per tech proposal §4/§9. Module
// tables live in packages/infra/src/<module>/schema.ts (ticket 003 is
// scoped to these three only).

export const outboxMessages = pgTable("outbox_messages", {
  id: uuid("id").primaryKey().$defaultFn(newId),
  aggregateType: text("aggregate_type").notNull(),
  aggregateId: uuid("aggregate_id").notNull(),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
});

// PK is (message_id, consumer), not message_id alone: the same message
// can be delivered to more than one consumer (e.g. a media.uploaded
// event consumed by both a transcode worker and a notifier), and each
// must dedupe independently (tech proposal §9 "idempotency via
// processed_messages").
export const processedMessages = pgTable(
  "processed_messages",
  {
    messageId: uuid("message_id").notNull(),
    consumer: text("consumer").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.messageId, table.consumer] }),
  }),
);

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().$defaultFn(newId),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  subjectType: text("subject_type").notNull(),
  subjectId: uuid("subject_id").notNull(),
  meta: jsonb("meta"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});
