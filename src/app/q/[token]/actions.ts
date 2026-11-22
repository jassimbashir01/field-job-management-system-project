"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { customers, quotes } from "@/db/schema";
import { logPublicActivity } from "@/lib/activity-log";
import { createJobFromQuote } from "@/lib/create-job-from-quote";
import { isQuoteExpired } from "@/lib/quote-status";
import { notifyCategory } from "@/lib/notifications";
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

async function customerNameFor(customerId: string): Promise<string> {
  const [row] = await getDb()
    .select({ name: customers.name })
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);
  return row?.name ?? "A customer";
}

export async function acceptQuoteAction(
  token: string,
): Promise<PublicQuoteResult> {
  try {
    const db = getDb();
    const outcome: {
      accepted: {
        id: string;
        quoteNumber: number;
        title: string;
        customerId: string;
        jobNumber: number;
      } | null;
    } = { accepted: null };

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

      outcome.accepted = {
        id: quote.id,
        quoteNumber: quote.quoteNumber,
        title: quote.title,
        customerId: quote.customerId,
        jobNumber: createdJob.jobNumber,
      };
    });

    const a = outcome.accepted;
    if (a) {
      await notifyCategory({
        category: "quote_accepted",
        title: `Quote #${a.quoteNumber} accepted`,
        body: `${await customerNameFor(a.customerId)} accepted "${a.title}". Job #${a.jobNumber} was created as a draft.`,
        href: `/quotes/${a.id}`,
      });
    }

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
    const outcome: {
      declined: {
        id: string;
        quoteNumber: number;
        title: string;
        customerId: string;
      } | null;
    } = { declined: null };

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

      outcome.declined = {
        id: quote.id,
        quoteNumber: quote.quoteNumber,
        title: quote.title,
        customerId: quote.customerId,
      };
    });

    const d = outcome.declined;
    if (d) {
      await notifyCategory({
        category: "quote_declined",
        title: `Quote #${d.quoteNumber} declined`,
        body: `${await customerNameFor(d.customerId)} declined "${d.title}".`,
        href: `/quotes/${d.id}`,
      });
    }

    revalidatePath(`/q/${token}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}
