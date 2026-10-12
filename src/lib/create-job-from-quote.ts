import { type getDb } from "@/db";
import { jobs, type quotes } from "@/db/schema";
import { deriveStatusFromData } from "@/lib/job-status";
import { ConflictError } from "@/lib/errors";

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

export async function createJobFromQuote(
  tx: Tx,
  quote: typeof quotes.$inferSelect,
) {
  const [createdJob] = await tx
    .insert(jobs)
    .values({
      customerId: quote.customerId,
      siteId: quote.siteId,
      oneOffLocation: quote.oneOffLocation,
      title: quote.title,
      description: quote.notes,
      status: deriveStatusFromData(false, false),
      createdFromQuoteId: quote.id,
    })
    .returning();

  if (!createdJob)
    throw new ConflictError("Insert did not return the created job row");
  return createdJob;
}
