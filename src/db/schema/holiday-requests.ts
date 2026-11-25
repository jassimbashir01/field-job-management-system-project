import {
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const holidayStatusEnum = pgEnum("holiday_status", [
  "sent",
  "viewed",
  "accepted",
  "rejected",
]);

export const holidayRequests = pgTable(
  "holiday_requests",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startDate: date({ mode: "string" }).notNull(),
    endDate: date({ mode: "string" }).notNull(),
    note: text(),
    status: holidayStatusEnum().notNull().default("sent"),
    managerNote: text(),
    viewedAt: timestamp({ withTimezone: true }),
    viewedByUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamp({ withTimezone: true }),
    decidedByUserId: uuid().references(() => users.id, {
      onDelete: "set null",
    }),
    createdByUserId: uuid().references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index().on(table.userId),
    index().on(table.status),
    index().on(table.startDate, table.endDate),
  ],
);
