import { sql } from "drizzle-orm";
import {
  doublePrecision,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const punchLocationStatusEnum = pgEnum("punch_location_status", [
  "not_requested",
  "captured",
  "unavailable",
]);

export const punchSourceEnum = pgEnum("punch_source", ["self", "manager"]);

export const punches = pgTable(
  "punches",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    punchedInAt: timestamp({ withTimezone: true }).notNull(),
    punchedOutAt: timestamp({ withTimezone: true }),
    inLocationStatus: punchLocationStatusEnum()
      .notNull()
      .default("not_requested"),
    inLatitude: doublePrecision(),
    inLongitude: doublePrecision(),
    inAccuracyMeters: doublePrecision(),
    outLocationStatus: punchLocationStatusEnum()
      .notNull()
      .default("not_requested"),
    outLatitude: doublePrecision(),
    outLongitude: doublePrecision(),
    outAccuracyMeters: doublePrecision(),
    source: punchSourceEnum().notNull().default("self"),
    editedAt: timestamp({ withTimezone: true }),
    editedByUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    editReason: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index().on(table.userId, table.punchedInAt),
    index().on(table.punchedInAt),
    uniqueIndex("punches_one_open_per_user")
      .on(table.userId)
      .where(sql`${table.punchedOutAt} is null`),
  ],
);
