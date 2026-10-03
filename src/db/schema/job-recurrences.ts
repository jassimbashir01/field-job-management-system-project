import {
  boolean,
  date,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { customers } from "./customers";
import { sites } from "./sites";
import { users } from "./users";

export const recurrenceIntervalUnitEnum = pgEnum("recurrence_interval_unit", [
  "day",
  "week",
  "month",
]);

export const jobRecurrences = pgTable("job_recurrences", {
  id: uuid().primaryKey().defaultRandom(),
  customerId: uuid()
    .notNull()
    .references(() => customers.id, { onDelete: "restrict" }),
  siteId: uuid().references(() => sites.id, { onDelete: "restrict" }),
  oneOffLocation: text(),
  assignedToUserId: uuid().references(() => users.id, { onDelete: "set null" }),
  title: text().notNull(),
  jobType: text(),
  description: text(),
  reference: text(),
  scheduledTime: text(),
  intervalUnit: recurrenceIntervalUnitEnum().notNull(),
  intervalCount: integer().notNull().default(1),
  startDate: date({ mode: "string" }).notNull(),
  endDate: date({ mode: "string" }),
  active: boolean().notNull().default(true),
  lastGeneratedDate: date({ mode: "string" }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
