import { and, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { customers } from "@/db/schema";
import { ConflictError } from "@/lib/errors";

export async function assertCustomerNameAvailable(
  name: string,
  excludeCustomerId?: string,
): Promise<void> {
  const trimmed = name.trim();
  const db = getDb();
  const rows = await db
    .select({ id: customers.id })
    .from(customers)
    .where(
      and(
        sql`lower(${customers.name}) = lower(${trimmed})`,
        excludeCustomerId ? ne(customers.id, excludeCustomerId) : undefined,
      ),
    )
    .limit(1);

  if (rows.length > 0) {
    throw new ConflictError(
      `A customer named "${trimmed}" already exists. Add a number, a letter or a word to tell them apart — for example "${trimmed} (North)".`,
    );
  }
}
