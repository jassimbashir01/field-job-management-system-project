import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "manager",
  "team_member",
]);

export const users = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  email: text().notNull().unique(),
  passwordHash: text().notNull(),
  role: userRoleEnum().notNull(),
  displayName: text().notNull(),
  jobTitle: text(),
  phone: text(),
  isActive: boolean().notNull().default(true),
  mustChangePassword: boolean().notNull().default(false),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
