import { date, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sites } from "./sites";

export const equipment = pgTable("equipment", {
  id: uuid().primaryKey().defaultRandom(),
  siteId: uuid()
    .notNull()
    .references(() => sites.id, { onDelete: "cascade" }),
  name: text().notNull(),
  manufacturer: text(),
  model: text(),
  serialNumber: text(),
  installDate: date({ mode: "string" }),
  warrantyExpiresAt: date({ mode: "string" }),
  lastServiceDate: date({ mode: "string" }),
  notes: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
