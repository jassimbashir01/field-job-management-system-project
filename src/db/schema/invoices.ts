import {
  boolean,
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { customers } from "./customers";
import { jobs } from "./jobs";
import { quotes } from "./quotes";
import { sites } from "./sites";

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "sent",
  "viewed",
  "payment_reported",
  "paid",
  "void",
]);

export const paymentOptions = pgTable("payment_options", {
  id: uuid().primaryKey().defaultRandom(),
  label: text().notNull(),
  details: text(),
  url: text(),
  sortOrder: integer().notNull().default(0),
  isActive: boolean().notNull().default(true),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const invoices = pgTable("invoices", {
  id: uuid().primaryKey().defaultRandom(),
  invoiceNumber: integer()
    .notNull()
    .unique()
    .generatedAlwaysAsIdentity({ startWith: 1001 }),
  customerId: uuid()
    .notNull()
    .references(() => customers.id, { onDelete: "restrict" }),
  siteId: uuid().references(() => sites.id, { onDelete: "restrict" }),
  oneOffLocation: text(),
  jobId: uuid().references(() => jobs.id, { onDelete: "set null" }),
  quoteId: uuid().references(() => quotes.id, { onDelete: "set null" }),
  status: invoiceStatusEnum().notNull().default("draft"),
  title: text().notNull(),
  notes: text(),
  dueDate: date({ mode: "string" }),
  publicToken: text().notNull().unique(),
  sentAt: timestamp({ withTimezone: true }),
  viewedAt: timestamp({ withTimezone: true }),
  paymentReportedAt: timestamp({ withTimezone: true }),
  paidAt: timestamp({ withTimezone: true }),
  voidedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const invoiceLineItems = pgTable("invoice_line_items", {
  id: uuid().primaryKey().defaultRandom(),
  invoiceId: uuid()
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  description: text().notNull(),
  quantity: numeric({ precision: 10, scale: 2 }).notNull().default("1"),
  unitPriceCents: integer().notNull(),
  sortOrder: integer().notNull().default(0),
});

export const invoicePaymentOptions = pgTable(
  "invoice_payment_options",
  {
    invoiceId: uuid()
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    paymentOptionId: uuid()
      .notNull()
      .references(() => paymentOptions.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.invoiceId, table.paymentOptionId] }),
  ],
);
