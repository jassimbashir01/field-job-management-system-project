import {
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { customers } from "./customers";
import { sites } from "./sites";

export const quoteStatusEnum = pgEnum("quote_status", [
  "draft",
  "sent",
  "viewed",
  "accepted",
  "declined",
]);

export const quotes = pgTable("quotes", {
  id: uuid().primaryKey().defaultRandom(),
  quoteNumber: integer()
    .notNull()
    .unique()
    .generatedAlwaysAsIdentity({ startWith: 1001 }),
  customerId: uuid()
    .notNull()
    .references(() => customers.id, { onDelete: "restrict" }),
  siteId: uuid().references(() => sites.id, { onDelete: "restrict" }),
  oneOffLocation: text(),
  status: quoteStatusEnum().notNull().default("draft"),
  title: text().notNull(),
  notes: text(),
  expiresAt: date({ mode: "string" }),
  publicToken: text().notNull().unique(),
  sentAt: timestamp({ withTimezone: true }),
  viewedAt: timestamp({ withTimezone: true }),
  respondedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const quoteLineItems = pgTable("quote_line_items", {
  id: uuid().primaryKey().defaultRandom(),
  quoteId: uuid()
    .notNull()
    .references(() => quotes.id, { onDelete: "cascade" }),
  description: text().notNull(),
  quantity: numeric({ precision: 10, scale: 2 }).notNull().default("1"),
  unitPriceCents: integer().notNull(),
  sortOrder: integer().notNull().default(0),
});
