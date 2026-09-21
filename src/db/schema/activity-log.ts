import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const activityLogEntries = pgTable(
  "activity_log_entries",
  {
    id: uuid().primaryKey().defaultRandom(),
    entityType: text().notNull(),
    entityId: uuid().notNull(),
    action: text().notNull(),
    actorUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    actorDisplayName: text().notNull(),
    summary: text().notNull(),
    metadata: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("activity_log_entity_idx").on(
      table.entityType,
      table.entityId,
      table.createdAt,
    ),
  ],
);
