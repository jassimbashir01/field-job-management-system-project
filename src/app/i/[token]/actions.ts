"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { customers, invoices } from "@/db/schema";
import { logPublicActivity } from "@/lib/activity-log";
import { notifyCategory } from "@/lib/notifications";
import {
  ConflictError,
  NotFoundError,
  toSafeError,
  type SafeError,
} from "@/lib/errors";

export interface PublicInvoiceResult {
  success: boolean;
  error?: SafeError;
}

export async function reportPaymentAction(
  token: string,
): Promise<PublicInvoiceResult> {
  try {
    if (typeof token !== "string" || token.length === 0 || token.length > 200) {
      throw new NotFoundError("That invoice couldn't be found.");
    }

    const db = getDb();
    const outcome: {
      reported: {
        id: string;
        invoiceNumber: number;
        title: string;
        customerId: string;
      } | null;
    } = { reported: null };

    await db.transaction(async (tx) => {
      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(eq(invoices.publicToken, token))
        .limit(1);
      if (!invoice || invoice.status === "draft") {
        throw new NotFoundError("That invoice couldn't be found.");
      }
      if (invoice.status === "payment_reported") {
        throw new ConflictError(
          "Thanks — we've already been told about your payment and are confirming it.",
        );
      }
      if (invoice.status === "paid") {
        throw new ConflictError("This invoice has already been paid.");
      }
      if (invoice.status === "void") {
        throw new ConflictError("This invoice has been cancelled.");
      }

      const updated = await tx
        .update(invoices)
        .set({
          status: "payment_reported",
          paymentReportedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(eq(invoices.id, invoice.id), eq(invoices.status, invoice.status)),
        )
        .returning({ id: invoices.id });
      if (updated.length === 0) {
        throw new ConflictError(
          "This invoice was just updated. Please refresh the page.",
        );
      }

      await logPublicActivity({
        entityType: "invoice",
        entityId: invoice.id,
        action: "status_changed",
        summary:
          "reported that they've paid, via the public link — waiting for confirmation",
        metadata: { from: invoice.status, to: "payment_reported" },
        tx,
      });

      outcome.reported = {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        title: invoice.title,
        customerId: invoice.customerId,
      };
    });

    const r = outcome.reported;
    if (r) {
      const [customer] = await db
        .select({ name: customers.name })
        .from(customers)
        .where(eq(customers.id, r.customerId))
        .limit(1);
      await notifyCategory({
        category: "invoice_payment_reported",
        title: `Payment reported on invoice #${r.invoiceNumber}`,
        body: `${customer?.name ?? "A customer"} says they've paid "${r.title}". Check your account, then mark it paid.`,
        href: `/invoices/${r.id}`,
      });
    }

    revalidatePath(`/i/${token}`);
    revalidatePath("/invoices");
    return { success: true };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}
