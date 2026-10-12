"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { getDb } from "@/db";
import { customFieldValues, quoteLineItems, quotes } from "@/db/schema";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-catalog";
import { logActivity } from "@/lib/activity-log";
import { createJobFromQuote } from "@/lib/create-job-from-quote";
import {
  extractCustomFieldValues,
  getFieldDefinitions,
  setFieldValues,
} from "@/lib/custom-fields";
import { resolveCustomerId, resolveSiteId } from "@/lib/resolve-customer-site";
import {
  ConflictError,
  NotFoundError,
  toSafeError,
  ValidationError,
  type SafeError,
} from "@/lib/errors";

const lineItemSchema = z.object({
  description: z.string().min(1, "Every line needs a description"),
  quantity: z
    .string()
    .refine(
      (v) => Number.parseFloat(v) > 0,
      "Quantity must be greater than zero",
    ),
  unitPriceCents: z.number().int().min(0),
});

const quoteSchema = z.object({
  oneOffLocation: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  notes: z.string().optional(),
  expiresAt: z.string().optional(),
  lineItems: z.string(), // raw JSON from the hidden field; parsed below
});

export interface FormState {
  success: boolean;
  error: SafeError | null;
}

function parseLineItems(raw: string): z.infer<typeof lineItemSchema>[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ValidationError(
      "Line items were submitted in an unreadable format.",
    );
  }
  const result = z
    .array(lineItemSchema)
    .min(1, "Add at least one line item")
    .safeParse(parsed);
  if (!result.success) {
    throw new ValidationError(
      result.error.issues[0]?.message ?? "Invalid line items",
    );
  }
  return result.data;
}

export async function createQuoteAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  let newQuoteId: string;

  try {
    const actor = await requirePermission(PERMISSIONS.QUOTES_WRITE);

    const parsed = quoteSchema.safeParse(
      Object.fromEntries(formData.entries()),
    );
    if (!parsed.success) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Invalid input",
        },
      };
    }

    const lineItems = parseLineItems(parsed.data.lineItems);

    const db = getDb();
    newQuoteId = await db.transaction(async (tx) => {
      const customerId = await resolveCustomerId(tx, formData);
      const siteId = await resolveSiteId(tx, formData, customerId);

      const [created] = await tx
        .insert(quotes)
        .values({
          customerId,
          siteId,
          oneOffLocation: siteId ? null : parsed.data.oneOffLocation || null,
          title: parsed.data.title,
          notes: parsed.data.notes || null,
          expiresAt: parsed.data.expiresAt || null,
          publicToken: randomBytes(32).toString("base64url"),
        })
        .returning();

      if (!created)
        throw new ConflictError("Insert did not return the created quote row");

      await tx.insert(quoteLineItems).values(
        lineItems.map((item, index) => ({
          quoteId: created.id,
          description: item.description,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          sortOrder: index,
        })),
      );

      const definitions = await getFieldDefinitions("quote");
      if (definitions.length > 0) {
        const values = extractCustomFieldValues(formData, definitions);
        await setFieldValues(created.id, values, tx);
      }

      await logActivity({
        entityType: "quote",
        entityId: created.id,
        action: "created",
        actor,
        summary: "created this quote",
        tx,
      });

      return created.id;
    });
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }

  redirect(`/quotes/${newQuoteId}`);
}

export async function updateQuoteAction(
  quoteId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const actor = await requirePermission(PERMISSIONS.QUOTES_WRITE);

    const parsed = quoteSchema.safeParse(
      Object.fromEntries(formData.entries()),
    );
    if (!parsed.success) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Invalid input",
        },
      };
    }

    const lineItems = parseLineItems(parsed.data.lineItems);

    const db = getDb();
    await db.transaction(async (tx) => {
      const rows = await tx
        .select({ status: quotes.status })
        .from(quotes)
        .where(eq(quotes.id, quoteId))
        .limit(1);
      const current = rows[0];
      if (!current) throw new NotFoundError("That quote couldn't be found.");
      if (current.status !== "draft") {
        throw new ConflictError(
          "This quote has already been sent and can no longer be edited. Duplicate it to make changes.",
        );
      }

      const customerId = await resolveCustomerId(tx, formData);
      const siteId = await resolveSiteId(tx, formData, customerId);

      await tx
        .update(quotes)
        .set({
          customerId,
          siteId,
          oneOffLocation: siteId ? null : parsed.data.oneOffLocation || null,
          title: parsed.data.title,
          notes: parsed.data.notes || null,
          expiresAt: parsed.data.expiresAt || null,
          updatedAt: new Date(),
        })
        .where(eq(quotes.id, quoteId));

      await tx
        .delete(quoteLineItems)
        .where(eq(quoteLineItems.quoteId, quoteId));
      await tx.insert(quoteLineItems).values(
        lineItems.map((item, index) => ({
          quoteId,
          description: item.description,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          sortOrder: index,
        })),
      );

      const definitions = await getFieldDefinitions("quote");
      if (definitions.length > 0) {
        const values = extractCustomFieldValues(formData, definitions);
        await setFieldValues(quoteId, values, tx);
      }

      await logActivity({
        entityType: "quote",
        entityId: quoteId,
        action: "updated",
        actor,
        summary: "updated the quote details",
        tx,
      });
    });

    revalidatePath(`/quotes/${quoteId}`);
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}

export async function markQuoteSentAction(quoteId: string): Promise<FormState> {
  try {
    const actor = await requirePermission(PERMISSIONS.QUOTES_WRITE);
    const db = getDb();

    await db.transaction(async (tx) => {
      const rows = await tx
        .select({ status: quotes.status })
        .from(quotes)
        .where(eq(quotes.id, quoteId))
        .limit(1);
      const current = rows[0];
      if (!current) throw new NotFoundError("That quote couldn't be found.");
      if (current.status !== "draft") {
        throw new ConflictError("Only a Draft quote can be marked as sent.");
      }

      await tx
        .update(quotes)
        .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
        .where(eq(quotes.id, quoteId));

      await logActivity({
        entityType: "quote",
        entityId: quoteId,
        action: "status_changed",
        actor,
        summary: "marked this quote as sent — the public link is now live",
        metadata: { from: "draft", to: "sent" },
        tx,
      });
    });

    revalidatePath(`/quotes/${quoteId}`);
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}

export async function setQuoteResponseManuallyAction(
  quoteId: string,
  response: "accepted" | "declined",
): Promise<FormState> {
  try {
    const actor = await requirePermission(PERMISSIONS.QUOTES_WRITE);
    const db = getDb();

    await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(quotes)
        .where(eq(quotes.id, quoteId))
        .limit(1);
      if (!current) throw new NotFoundError("That quote couldn't be found.");
      if (current.status === "accepted" || current.status === "declined") {
        throw new ConflictError(`This quote is already ${current.status}.`);
      }

      await tx
        .update(quotes)
        .set({
          status: response,
          respondedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(quotes.id, quoteId));

      if (response === "accepted") {
        const createdJob = await createJobFromQuote(tx, current);

        await logActivity({
          entityType: "quote",
          entityId: quoteId,
          action: "status_changed",
          actor,
          summary: `marked this quote as accepted manually — created job #${createdJob.jobNumber}`,
          metadata: {
            from: current.status,
            to: "accepted",
            manual: true,
            jobId: createdJob.id,
          },
          tx,
        });
        await logActivity({
          entityType: "job",
          entityId: createdJob.id,
          action: "created",
          actor,
          summary: `created from quote #${current.quoteNumber}, marked accepted manually`,
          tx,
        });
      } else {
        await logActivity({
          entityType: "quote",
          entityId: quoteId,
          action: "status_changed",
          actor,
          summary: "marked this quote as declined manually",
          metadata: { from: current.status, to: "declined", manual: true },
          tx,
        });
      }
    });

    revalidatePath(`/quotes/${quoteId}`);
    revalidatePath("/jobs");
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}

export interface DuplicateQuoteResult {
  success: boolean;
  newQuoteId?: string;
  error?: SafeError;
}

export async function duplicateQuoteAction(
  quoteId: string,
): Promise<DuplicateQuoteResult> {
  try {
    const actor = await requirePermission(PERMISSIONS.QUOTES_WRITE);
    const db = getDb();

    const newQuoteId = await db.transaction(async (tx) => {
      const [source] = await tx
        .select()
        .from(quotes)
        .where(eq(quotes.id, quoteId))
        .limit(1);
      if (!source) throw new NotFoundError("That quote couldn't be found.");

      const sourceLineItems = await tx
        .select()
        .from(quoteLineItems)
        .where(eq(quoteLineItems.quoteId, quoteId));

      const [created] = await tx
        .insert(quotes)
        .values({
          customerId: source.customerId,
          siteId: source.siteId,
          oneOffLocation: source.oneOffLocation,
          title: `Copy of ${source.title}`,
          notes: source.notes,
          expiresAt: null,
          publicToken: randomBytes(32).toString("base64url"),
        })
        .returning();

      if (!created)
        throw new ConflictError("Insert did not return the created quote row");

      if (sourceLineItems.length > 0) {
        await tx.insert(quoteLineItems).values(
          sourceLineItems.map((item) => ({
            quoteId: created.id,
            description: item.description,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            sortOrder: item.sortOrder,
          })),
        );
      }

      await logActivity({
        entityType: "quote",
        entityId: created.id,
        action: "created",
        actor,
        summary: `created as a duplicate of quote #${source.quoteNumber}`,
        tx,
      });

      return created.id;
    });

    revalidatePath("/quotes");
    return { success: true, newQuoteId };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}

export async function deleteQuoteAction(quoteId: string): Promise<FormState> {
  try {
    const actor = await requirePermission(PERMISSIONS.QUOTES_DELETE);

    const db = getDb();
    await db.transaction(async (tx) => {
      await logActivity({
        entityType: "quote",
        entityId: quoteId,
        action: "deleted",
        actor,
        summary: "deleted this quote",
        tx,
      });
      await tx
        .delete(customFieldValues)
        .where(eq(customFieldValues.entityId, quoteId));
      await tx
        .delete(quoteLineItems)
        .where(eq(quoteLineItems.quoteId, quoteId));
      await tx.delete(quotes).where(eq(quotes.id, quoteId));
    });

    revalidatePath("/quotes");
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }

  redirect("/quotes");
}
