import {
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

export const jobs = pgTable("jobs", {
  id: uuid().primaryKey().defaultRandom(),
  jobNumber: integer()
    .notNull()
    .unique()
    .generatedAlwaysAsIdentity({ startWith: 1001 }),
  customerId: uuid()
    .notNull()
    .references(() => customers.id, { onDelete: "restrict" }),
  siteId: uuid().references(() => sites.id, { onDelete: "restrict" }),
  assignedToUserId: uuid().references(() => users.id, { onDelete: "set null" }),
  status: jobStatusEnum().notNull().default("draft"),
  title: text().notNull(),
  jobType: text(),
  description: text(),
  reference: text(),
  scheduledDate: date({ mode: "string" }),
  scheduledTime: text(),
  notes: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
