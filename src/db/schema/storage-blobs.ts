import { customType, pgTable, text, timestamp } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const storageBlobs = pgTable("storage_blobs", {
  key: text().primaryKey(),
  data: bytea().notNull(),
  contentType: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
