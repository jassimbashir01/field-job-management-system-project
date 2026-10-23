"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import * as z from "zod";
import { getDb } from "@/db";
import {
  customFieldValues,
  invoiceLineItems,
  invoicePaymentOptions,
  invoices,
  jobs,
  paymentOptions,
  quotes,
} from "@/db/schema";
import { requirePermission } from "@/lib/auth/guards";
import { getResourceAccess } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-catalog";
import { logActivity } from "@/lib/activity-log";
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
import { isUuid } from "@/lib/uuid";

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
type Actor = Awaited<ReturnType<typeof requirePermission>>;
type InvoiceStatus = (typeof invoices.$inferSelect)["status"];

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

const invoiceSchema = z.object({
  oneOffLocation: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  notes: z.string().optional(),
  dueDate: z
    .string()
    .optional()
    .refine(
      (v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v),
      "The due date isn't a valid date",
    ),
  lineItems: z.string(), // raw JSON from the hidden field; parsed below
});

export interface FormState {
  success: boolean;
  error: SafeError | null;
}

export interface DuplicateInvoiceResult {
  success: boolean;
  newInvoiceId?: string;
  error?: SafeError;
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

async function readPaymentOptionIds(
  tx: Tx,
  formData: FormData,
  alreadyAttached: string[],
): Promise<string[]> {
  const ids = [
    ...new Set(
      formData
        .getAll("paymentOptionId")
        .filter((v): v is string => typeof v === "string"),
    ),
  ];
  if (ids.some((id) => !isUuid(id))) {
    throw new ValidationError(
      "One of the selected payment options isn't valid.",
    );
  }
  if (ids.length === 0) return [];

  const rows = await tx
    .select({
      id: paymentOptions.id,
      label: paymentOptions.label,
      isActive: paymentOptions.isActive,
    })
    .from(paymentOptions)
    .where(inArray(paymentOptions.id, ids));
  if (rows.length !== ids.length) {
    throw new ValidationError(
      "One of the selected payment options no longer exists.",
    );
  }
  const attached = new Set(alreadyAttached);
  const blocked = rows.find((row) => !row.isActive && !attached.has(row.id));
  if (blocked) {
    throw new ConflictError(
      `"${blocked.label}" has been deactivated and can't be added to this invoice.`,
    );
  }
  return ids;
}

async function resolveSources(
  tx: Tx,
  actor: Actor,
  formData: FormData,
): Promise<{ jobId: string | null; quoteId: string | null }> {
  const rawJob = formData.get("jobId");
  const rawQuote = formData.get("quoteId");
  let jobId: string | null = null;
  let quoteId: string | null = null;

  if (typeof rawJob === "string" && isUuid(rawJob)) {
    const access = await getResourceAccess(actor, "jobs");
    if (access.canRead) {
      const rows = await tx
        .select({ id: jobs.id })
        .from(jobs)
        .where(eq(jobs.id, rawJob))
        .limit(1);
      jobId = rows[0]?.id ?? null;
    }
  }
  if (typeof rawQuote === "string" && isUuid(rawQuote)) {
    const access = await getResourceAccess(actor, "quotes");
    if (access.canRead) {
      const rows = await tx
        .select({ id: quotes.id })
        .from(quotes)
        .where(eq(quotes.id, rawQuote))
        .limit(1);
      quoteId = rows[0]?.id ?? null;
    }
  }
  return { jobId, quoteId };
}

async function replaceLineItems(
  tx: Tx,
  invoiceId: string,
  items: z.infer<typeof lineItemSchema>[],
): Promise<void> {
  await tx
    .delete(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, invoiceId));
  await tx.insert(invoiceLineItems).values(
    items.map((item, index) => ({
      invoiceId,
      description: item.description,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      sortOrder: index,
    })),
  );
}

async function replacePaymentOptions(
  tx: Tx,
  invoiceId: string,
  optionIds: string[],
): Promise<void> {
  await tx
    .delete(invoicePaymentOptions)
    .where(eq(invoicePaymentOptions.invoiceId, invoiceId));
  if (optionIds.length > 0) {
    await tx
      .insert(invoicePaymentOptions)
      .values(
        optionIds.map((paymentOptionId) => ({ invoiceId, paymentOptionId })),
      );
  }
}

export async function createInvoiceAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  let newInvoiceId: string;

  try {
    const actor = await requirePermission(PERMISSIONS.INVOICES_WRITE);

    const parsed = invoiceSchema.safeParse(
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
    newInvoiceId = await db.transaction(async (tx) => {
      const customerId = await resolveCustomerId(tx, formData);
      const siteId = await resolveSiteId(tx, formData, customerId);
      const optionIds = await readPaymentOptionIds(tx, formData, []);
      const source = await resolveSources(tx, actor, formData);

      const [created] = await tx
        .insert(invoices)
        .values({
          customerId,
          siteId,
          oneOffLocation: siteId ? null : parsed.data.oneOffLocation || null,
          jobId: source.jobId,
          quoteId: source.quoteId,
          title: parsed.data.title,
          notes: parsed.data.notes || null,
          dueDate: parsed.data.dueDate || null,
          publicToken: randomBytes(32).toString("base64url"),
        })
        .returning();
      if (!created)
        throw new ConflictError(
          "Insert did not return the created invoice row",
        );

      await replaceLineItems(tx, created.id, lineItems);
      await replacePaymentOptions(tx, created.id, optionIds);

      const definitions = await getFieldDefinitions("invoice");
      if (definitions.length > 0) {
        const values = extractCustomFieldValues(formData, definitions);
        await setFieldValues(created.id, values, tx);
      }

      await logActivity({
        entityType: "invoice",
        entityId: created.id,
        action: "created",
        actor,
        summary: source.quoteId
          ? "created this invoice from a quote"
          : source.jobId
            ? "created this invoice from a job"
            : "created this invoice",
        metadata: { jobId: source.jobId, quoteId: source.quoteId },
        tx,
      });

      return created.id;
    });
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }

  revalidatePath("/invoices");
  redirect(`/invoices/${newInvoiceId}`);
}

export async function updateInvoiceAction(
  invoiceId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const actor = await requirePermission(PERMISSIONS.INVOICES_WRITE);
    if (!isUuid(invoiceId))
      throw new NotFoundError("That invoice couldn't be found.");

    const parsed = invoiceSchema.safeParse(
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
      const [current] = await tx
        .select({ status: invoices.status })
        .from(invoices)
        .where(eq(invoices.id, invoiceId))
        .limit(1);
      if (!current) throw new NotFoundError("That invoice couldn't be found.");
      if (current.status !== "draft") {
        throw new ConflictError(
          "This invoice has already been sent and can no longer be edited. Duplicate it to make changes.",
        );
      }

      const attachedRows = await tx
        .select({ id: invoicePaymentOptions.paymentOptionId })
        .from(invoicePaymentOptions)
        .where(eq(invoicePaymentOptions.invoiceId, invoiceId));
      const optionIds = await readPaymentOptionIds(
        tx,
        formData,
        attachedRows.map((row) => row.id),
      );

      const customerId = await resolveCustomerId(tx, formData);
      const siteId = await resolveSiteId(tx, formData, customerId);

      await tx
        .update(invoices)
        .set({
          customerId,
          siteId,
          oneOffLocation: siteId ? null : parsed.data.oneOffLocation || null,
          title: parsed.data.title,
          notes: parsed.data.notes || null,
          dueDate: parsed.data.dueDate || null,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, invoiceId));

      await replaceLineItems(tx, invoiceId, lineItems);
      await replacePaymentOptions(tx, invoiceId, optionIds);

      const definitions = await getFieldDefinitions("invoice");
      if (definitions.length > 0) {
        const values = extractCustomFieldValues(formData, definitions);
        await setFieldValues(invoiceId, values, tx);
      }

      await logActivity({
        entityType: "invoice",
        entityId: invoiceId,
        action: "updated",
        actor,
        summary: "updated the invoice details",
        tx,
      });
    });

    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath("/invoices");
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}

async function transitionInvoice(opts: {
  invoiceId: string;
  allowedFrom: InvoiceStatus[];
  blockedMessage: string;
  to: InvoiceStatus;
  changes: Partial<typeof invoices.$inferInsert>;
  summary: string;
  check?: (tx: Tx) => Promise<void>;
}): Promise<FormState> {
  try {
    const actor = await requirePermission(PERMISSIONS.INVOICES_WRITE);
    if (!isUuid(opts.invoiceId))
      throw new NotFoundError("That invoice couldn't be found.");

    const db = getDb();
    await db.transaction(async (tx) => {
      const [current] = await tx
        .select({ status: invoices.status })
        .from(invoices)
        .where(eq(invoices.id, opts.invoiceId))
        .limit(1);
      if (!current) throw new NotFoundError("That invoice couldn't be found.");
      if (!opts.allowedFrom.includes(current.status)) {
        throw new ConflictError(opts.blockedMessage);
      }
      if (opts.check) await opts.check(tx);

      const updated = await tx
        .update(invoices)
        .set({ ...opts.changes, status: opts.to, updatedAt: new Date() })
        .where(
          and(
            eq(invoices.id, opts.invoiceId),
            eq(invoices.status, current.status),
          ),
        )
        .returning({ id: invoices.id });
      if (updated.length === 0) {
        throw new ConflictError(
          "This invoice was just changed by someone else. Refresh the page and try again.",
        );
      }

      await logActivity({
        entityType: "invoice",
        entityId: opts.invoiceId,
        action: "status_changed",
        actor,
        summary: opts.summary,
        metadata: { from: current.status, to: opts.to },
        tx,
      });
    });

    revalidatePath(`/invoices/${opts.invoiceId}`);
    revalidatePath("/invoices");
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}

export async function markInvoiceSentAction(
  invoiceId: string,
): Promise<FormState> {
  return transitionInvoice({
    invoiceId,
    allowedFrom: ["draft"],
    blockedMessage: "Only a Draft invoice can be marked as sent.",
    to: "sent",
    changes: { sentAt: new Date() },
    summary: "marked this invoice as sent — the public link is now live",
    check: async (tx) => {
      const options = await tx
        .select({ id: invoicePaymentOptions.paymentOptionId })
        .from(invoicePaymentOptions)
        .where(eq(invoicePaymentOptions.invoiceId, invoiceId))
        .limit(1);
      if (options.length === 0) {
        throw new ConflictError(
          "Attach at least one payment option before sending, so the customer knows how to pay. Tick one in the form below and save.",
        );
      }
      const lines = await tx
        .select({ id: invoiceLineItems.id })
        .from(invoiceLineItems)
        .where(eq(invoiceLineItems.invoiceId, invoiceId))
        .limit(1);
      if (lines.length === 0) {
        throw new ConflictError("Add at least one line item before sending.");
      }
    },
  });
}

export async function markInvoicePaidAction(
  invoiceId: string,
): Promise<FormState> {
  return transitionInvoice({
    invoiceId,
    allowedFrom: ["sent", "viewed", "payment_reported"],
    blockedMessage: "Only a sent invoice can be marked as paid.",
    to: "paid",
    changes: { paidAt: new Date() },
    summary: "marked this invoice as paid",
  });
}

export async function markPaymentNotReceivedAction(
  invoiceId: string,
): Promise<FormState> {
  return transitionInvoice({
    invoiceId,
    allowedFrom: ["payment_reported"],
    blockedMessage: "There is no reported payment on this invoice to reverse.",
    to: "viewed",
    changes: { paymentReportedAt: null },
    summary:
      "marked the reported payment as not received — the invoice is back to Viewed",
  });
}

export async function voidInvoiceAction(invoiceId: string): Promise<FormState> {
  return transitionInvoice({
    invoiceId,
    allowedFrom: ["sent", "viewed", "payment_reported"],
    blockedMessage:
      "Only a sent invoice can be voided. A Paid invoice is a permanent record, and a Draft can simply be deleted.",
    to: "void",
    changes: { voidedAt: new Date() },
    summary: "voided this invoice",
  });
}

export async function duplicateInvoiceAction(
  invoiceId: string,
): Promise<DuplicateInvoiceResult> {
  try {
    const actor = await requirePermission(PERMISSIONS.INVOICES_WRITE);
    if (!isUuid(invoiceId))
      throw new NotFoundError("That invoice couldn't be found.");

    const db = getDb();
    const newInvoiceId = await db.transaction(async (tx) => {
      const [source] = await tx
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoiceId))
        .limit(1);
      if (!source) throw new NotFoundError("That invoice couldn't be found.");

      const sourceLines = await tx
        .select()
        .from(invoiceLineItems)
        .where(eq(invoiceLineItems.invoiceId, invoiceId))
        .orderBy(invoiceLineItems.sortOrder);
      const sourceOptions = await tx
        .select({ id: paymentOptions.id })
        .from(invoicePaymentOptions)
        .innerJoin(
          paymentOptions,
          eq(invoicePaymentOptions.paymentOptionId, paymentOptions.id),
        )
        .where(
          and(
            eq(invoicePaymentOptions.invoiceId, invoiceId),
            eq(paymentOptions.isActive, true),
          ),
        );

      const [created] = await tx
        .insert(invoices)
        .values({
          customerId: source.customerId,
          siteId: source.siteId,
          oneOffLocation: source.oneOffLocation,
          jobId: source.jobId,
          quoteId: source.quoteId,
          title: `Copy of ${source.title}`,
          notes: source.notes,
          dueDate: null,
          publicToken: randomBytes(32).toString("base64url"),
        })
        .returning();
      if (!created)
        throw new ConflictError(
          "Insert did not return the created invoice row",
        );

      if (sourceLines.length > 0) {
        await tx.insert(invoiceLineItems).values(
          sourceLines.map((item) => ({
            invoiceId: created.id,
            description: item.description,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            sortOrder: item.sortOrder,
          })),
        );
      }
      await replacePaymentOptions(
        tx,
        created.id,
        sourceOptions.map((option) => option.id),
      );

      await logActivity({
        entityType: "invoice",
        entityId: created.id,
        action: "created",
        actor,
        summary: `created as a duplicate of invoice #${source.invoiceNumber}`,
        tx,
      });

      return created.id;
    });

    revalidatePath("/invoices");
    return { success: true, newInvoiceId };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}

export async function deleteInvoiceAction(
  invoiceId: string,
): Promise<FormState> {
  try {
    const actor = await requirePermission(PERMISSIONS.INVOICES_DELETE);
    if (!isUuid(invoiceId))
      throw new NotFoundError("That invoice couldn't be found.");

    const db = getDb();
    await db.transaction(async (tx) => {
      const [current] = await tx
        .select({ status: invoices.status })
        .from(invoices)
        .where(eq(invoices.id, invoiceId))
        .limit(1);
      if (!current) throw new NotFoundError("That invoice couldn't be found.");
      if (current.status !== "draft" && current.status !== "void") {
        throw new ConflictError(
          current.status === "paid"
            ? "A paid invoice is a permanent record and can't be deleted."
            : "Void this invoice first - only Draft or Void invoices can be deleted.",
        );
      }

      await logActivity({
        entityType: "invoice",
        entityId: invoiceId,
        action: "deleted",
        actor,
        summary: "deleted this invoice",
        tx,
      });
      await tx
        .delete(customFieldValues)
        .where(eq(customFieldValues.entityId, invoiceId));
      await tx.delete(invoices).where(eq(invoices.id, invoiceId));
    });

    revalidatePath("/invoices");
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}
