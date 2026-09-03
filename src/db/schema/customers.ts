import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const customers = pgTable("customers", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  companyName: text(),
  phone: text(),
  email: text(),
  notes: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const customerContacts = pgTable("customer_contacts", {
  id: uuid().primaryKey().defaultRandom(),
  customerId: uuid()
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  name: text().notNull(),
  title: text(),
  phone: text(),
  email: text(),
  isPrimary: boolean().notNull().default(false),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
