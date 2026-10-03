import {
  boolean,
  date,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { customers } from "./customers";
import { jobRecurrences } from "./job-recurrences";
import { sites } from "./sites";
import { users } from "./users";

export const jobStatusEnum = pgEnum("job_status", [
  "draft",
  "scheduled",
  "assigned",
  "traveling",
  "arrived",
  "in_progress",
  "paused",
  "completed",
  "incomplete",
  "cancelled",
]);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid().primaryKey().defaultRandom(),
    jobNumber: integer()
      .notNull()
      .unique()
      .generatedAlwaysAsIdentity({ startWith: 1001 }),
    customerId: uuid()
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    siteId: uuid().references(() => sites.id, { onDelete: "restrict" }),
    oneOffLocation: text(),
    assignedToUserId: uuid().references(() => users.id, {
      onDelete: "set null",
    }),
    status: jobStatusEnum().notNull().default("draft"),
    title: text().notNull(),
    jobType: text(),
    description: text(),
    reference: text(),
    scheduledDate: date({ mode: "string" }),
    scheduledTime: text(),
    notes: text(),
    followUpFromJobId: uuid().references((): AnyPgColumn => jobs.id, {
      onDelete: "set null",
    }),
    recurrenceId: uuid().references(() => jobRecurrences.id, {
      onDelete: "set null",
    }),
    occurrenceDate: date({ mode: "string" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.recurrenceId, table.occurrenceDate)],
);

export const jobChecklistItems = pgTable("job_checklist_items", {
  id: uuid().primaryKey().defaultRandom(),
  jobId: uuid()
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  label: text().notNull(),
  completed: boolean().notNull().default(false),
  sortOrder: integer().notNull().default(0),
});
