import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { customers } from "./customers";

export const sites = pgTable("sites", {
  id: uuid().primaryKey().defaultRandom(),
  customerId: uuid()
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  name: text().notNull(),
  addressLine1: text(),
  addressLine2: text(),
  city: text(),
  region: text(),
  postalCode: text(),
  country: text(),
  accessNotes: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
