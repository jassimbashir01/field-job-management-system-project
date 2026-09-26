import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { equipment } from "./equipment";
import { jobs } from "./jobs";

export const jobEquipment = pgTable(
  "job_equipment",
  {
    id: uuid().primaryKey().defaultRandom(),
    jobId: uuid()
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    equipmentId: uuid()
      .notNull()
      .references(() => equipment.id, { onDelete: "cascade" }),
    notes: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.jobId, table.equipmentId)],
);
