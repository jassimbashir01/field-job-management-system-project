import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const userPermissions = pgTable(
  "user_permissions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    permissionKey: text().notNull(),
    grantedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    grantedByUserId: uuid().references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [unique().on(table.userId, table.permissionKey)],
);
