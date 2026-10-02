import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { jobEquipment } from "./job-equipment";
import { jobs } from "./jobs";
import { users } from "./users";

export const jobFiles = pgTable("job_files", {
  id: uuid().primaryKey().defaultRandom(),
  jobId: uuid()
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  jobEquipmentId: uuid().references(() => jobEquipment.id, {
    onDelete: "set null",
  }),
  storageKey: text().notNull().unique(),
  fileName: text().notNull(),
  contentType: text().notNull(),
  sizeBytes: integer().notNull(),
  caption: text(),
  uploadedByUserId: uuid().references(() => users.id, {
    onDelete: "set null",
  }),
  uploadedByDisplayName: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
