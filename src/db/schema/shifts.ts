import {
  date,
  index,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const shiftStatusEnum = pgEnum("shift_status", [
  "draft",
  "published",
  "cancelled",
]);

export const shifts = pgTable(
  "shifts",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    shiftDate: date({ mode: "string" }).notNull(),
    startTime: time().notNull(),
    endTime: time().notNull(),
    note: text(),
    status: shiftStatusEnum().notNull().default("draft"),
    notifiedAt: timestamp({ withTimezone: true }),
    createdByUserId: uuid().references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index().on(table.shiftDate),
    index().on(table.userId, table.shiftDate),
  ],
);
