import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const companies = pgTable("companies", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  logoUrl: text(),
  primaryColor: text(),
  contactEmail: text(),
  contactPhone: text(),
  addressLine1: text(),
  addressLine2: text(),
  city: text(),
  region: text(),
  postalCode: text(),
  country: text(),
  timezone: text().notNull().default("UTC"),
  defaultTeamMemberLabel: text().notNull().default("Team Member"),
  developerCreditText: text(),
  developerCreditUrl: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
