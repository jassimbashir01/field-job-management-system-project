import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { storageBlobs } from "@/db/schema";
import type { StorageDriver } from "./types";

export const dbDriver: StorageDriver = {
  async put(key, data, contentType) {
    const db = getDb();
    await db
      .insert(storageBlobs)
      .values({ key, data, contentType })
      .onConflictDoUpdate({
        target: storageBlobs.key,
        set: { data, contentType },
      });
  },

  async get(key) {
    const db = getDb();
    const [row] = await db
      .select({
        data: storageBlobs.data,
        contentType: storageBlobs.contentType,
      })
      .from(storageBlobs)
      .where(eq(storageBlobs.key, key))
      .limit(1);
    if (!row) return null;
    return { data: row.data, contentType: row.contentType };
  },

  async delete(key) {
    const db = getDb();
    await db.delete(storageBlobs).where(eq(storageBlobs.key, key));
  },
};
