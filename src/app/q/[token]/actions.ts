"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { quotes } from "@/db/schema";
import { logPublicActivity } from "@/lib/activity-log";
import { createJobFromQuote } from "@/lib/create-job-from-quote";
import { isQuoteExpired } from "@/lib/quote-status";
import {
  ConflictError,
  NotFoundError,
  toSafeError,
  type SafeError,
} from "@/lib/errors";

export interface PublicQuoteResult {
  success: boolean;
  error?: SafeError;
}

async function loadQuoteByToken(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  token: string,
) {
  const [quote] = await tx
    .select()
    .from(quotes)
    .where(eq(quotes.publicToken, token))
    .limit(1);
  if (!quote) throw new NotFoundError("That quote couldn't be found.");
  return quote;
}

/** Accepting creates a Draft job via the shared createJobFromQuote. */
export async function acceptQuoteAction(
  token: string,
): Promise<PublicQuoteResult> {
  try {
    const db = getDb();
    await db.transaction(async (tx) => {
      const quote = await loadQuoteByToken(tx, token);

      if (quote.status === "accepted" || quote.status === "declined") {
        throw new ConflictError(`This quote has already been ${quote.status}.`);
      }
      if (quote.status === "draft") {
        throw new NotFoundError("That quote couldn't be found.");
      }
      if (isQuoteExpired(quote)) {
        throw new ConflictError(
          "This quote has expired. Please contact us for an updated quote.",
        );
      }

      const createdJob = await createJobFromQuote(tx, quote);

      await tx
        .update(quotes)
        .set({
          status: "accepted",
          respondedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(quotes.id, quote.id));

      await logPublicActivity({
        entityType: "quote",
        entityId: quote.id,
        action: "status_changed",
        summary: `accepted this quote via the public link — created job #${createdJob.jobNumber}`,
        metadata: { from: quote.status, to: "accepted", jobId: createdJob.id },
        tx,
      });
      await logPublicActivity({
        entityType: "job",
        entityId: createdJob.id,
        action: "created",
        summary: `created from quote #${quote.quoteNumber}, accepted via the public link`,
        tx,
      });
    });

    revalidatePath(`/q/${token}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}

export async function declineQuoteAction(
  token: string,
): Promise<PublicQuoteResult> {
  try {
    const db = getDb();
    await db.transaction(async (tx) => {
      const quote = await loadQuoteByToken(tx, token);

      if (quote.status === "accepted" || quote.status === "declined") {
        throw new ConflictError(`This quote has already been ${quote.status}.`);
      }
      if (quote.status === "draft") {
        throw new NotFoundError("That quote couldn't be found.");
      }
      if (isQuoteExpired(quote)) {
        throw new ConflictError("This quote has expired.");
      }

      await tx
        .update(quotes)
        .set({
          status: "declined",
          respondedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(quotes.id, quote.id));

      await logPublicActivity({
        entityType: "quote",
        entityId: quote.id,
        action: "status_changed",
        summary: "declined this quote via the public link",
        metadata: { from: quote.status, to: "declined" },
        tx,
      });
    });

    revalidatePath(`/q/${token}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}
