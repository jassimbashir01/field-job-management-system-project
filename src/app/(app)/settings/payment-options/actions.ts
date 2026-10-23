"use server";

import { revalidatePath } from "next/cache";
import { count, eq } from "drizzle-orm";
import * as z from "zod";
import { getDb } from "@/db";
import { invoicePaymentOptions, paymentOptions } from "@/db/schema";
import { requireRole } from "@/lib/auth/guards";
import {
  ConflictError,
  NotFoundError,
  toSafeError,
  type SafeError,
} from "@/lib/errors";

function isHttpsUrl(value: string): boolean {
  if (!/^https:\/\//i.test(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

const optionSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "A name is required")
    .max(80, "Keep the name under 80 characters"),
  details: z
    .string()
    .trim()
    .max(2000, "Keep the details under 2000 characters")
    .optional(),
  url: z
    .string()
    .trim()
    .max(500, "That link is too long")
    .optional()
    .refine(
      (value) => !value || isHttpsUrl(value),
      "The link must be a full address starting with https://",
    ),
});

export interface FormState {
  success: boolean;
  error: SafeError | null;
}

function validationFailure(message: string): FormState {
  return { success: false, error: { code: "VALIDATION_ERROR", message } };
}

export async function createPaymentOptionAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await requireRole("admin");

    const parsed = optionSchema.safeParse(
      Object.fromEntries(formData.entries()),
    );
    if (!parsed.success) {
      return validationFailure(
        parsed.error.issues[0]?.message ?? "Invalid input",
      );
    }

    const db = getDb();
    await db.insert(paymentOptions).values({
      label: parsed.data.label,
      details: parsed.data.details || null,
      url: parsed.data.url || null,
    });

    revalidatePath("/settings/payment-options");
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}

export async function updatePaymentOptionAction(
  optionId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await requireRole("admin");

    const parsed = optionSchema.safeParse(
      Object.fromEntries(formData.entries()),
    );
    if (!parsed.success) {
      return validationFailure(
        parsed.error.issues[0]?.message ?? "Invalid input",
      );
    }

    const db = getDb();
    const updated = await db
      .update(paymentOptions)
      .set({
        label: parsed.data.label,
        details: parsed.data.details || null,
        url: parsed.data.url || null,
        updatedAt: new Date(),
      })
      .where(eq(paymentOptions.id, optionId))
      .returning({ id: paymentOptions.id });

    if (updated.length === 0)
      throw new NotFoundError("That payment option couldn't be found.");

    revalidatePath("/settings/payment-options");
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}

export async function setPaymentOptionActiveAction(
  optionId: string,
  isActive: boolean,
): Promise<FormState> {
  try {
    await requireRole("admin");

    const db = getDb();
    const updated = await db
      .update(paymentOptions)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(paymentOptions.id, optionId))
      .returning({ id: paymentOptions.id });

    if (updated.length === 0)
      throw new NotFoundError("That payment option couldn't be found.");

    revalidatePath("/settings/payment-options");
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}

export async function deletePaymentOptionAction(
  optionId: string,
): Promise<FormState> {
  try {
    await requireRole("admin");

    const db = getDb();
    const [usage] = await db
      .select({ invoices: count() })
      .from(invoicePaymentOptions)
      .where(eq(invoicePaymentOptions.paymentOptionId, optionId));

    const attached = usage?.invoices ?? 0;
    if (attached > 0) {
      throw new ConflictError(
        `This option is attached to ${attached} invoice${attached === 1 ? "" : "s"}. Deactivate it instead — those invoices will keep showing it.`,
      );
    }

    await db.delete(paymentOptions).where(eq(paymentOptions.id, optionId));

    revalidatePath("/settings/payment-options");
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}
