"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { getDb } from "@/db";
import { jobRecurrences } from "@/db/schema";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-catalog";
import { ValidationError, toSafeError, type SafeError } from "@/lib/errors";

const recurrenceSchema = z.object({
  customerId: z.uuid("A customer is required."),
  siteId: z.union([z.uuid(), z.literal("")]).optional(),
  oneOffLocation: z.string().optional(),
  assignedToUserId: z.union([z.uuid(), z.literal("")]).optional(),
  title: z.string().min(1, "Job title is required"),
  jobType: z.string().optional(),
  description: z.string().optional(),
  reference: z.string().optional(),
  scheduledTime: z.string().optional(),
  intervalUnit: z.enum(["day", "week", "month"]),
  intervalCount: z.coerce.number().int().min(1).max(365),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  active: z.string().optional(),
});

export interface FormState {
  success: boolean;
  error: SafeError | null;
}

function toValues(parsed: z.infer<typeof recurrenceSchema>) {
  return {
    customerId: parsed.customerId,
    siteId: parsed.siteId || null,
    oneOffLocation: parsed.siteId ? null : parsed.oneOffLocation || null,
    assignedToUserId: parsed.assignedToUserId || null,
    title: parsed.title,
    jobType: parsed.jobType || null,
    description: parsed.description || null,
    reference: parsed.reference || null,
    scheduledTime: parsed.scheduledTime || null,
    intervalUnit: parsed.intervalUnit,
    intervalCount: parsed.intervalCount,
    startDate: parsed.startDate,
    endDate: parsed.endDate || null,
    active: parsed.active === "on",
  };
}

export async function createRecurrenceAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  let newId: string;

  try {
    await requirePermission(PERMISSIONS.RECURRING_JOBS_WRITE);

    const parsed = recurrenceSchema.safeParse(
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

    if (parsed.data.endDate && parsed.data.endDate < parsed.data.startDate) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "The end date can't be before the start date.",
        },
      };
    }

    const db = getDb();
    const [created] = await db
      .insert(jobRecurrences)
      .values(toValues(parsed.data))
      .returning();
    if (!created) {
      throw new ValidationError("Could not create the recurring job.");
    }
    newId = created.id;
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }

  revalidatePath("/jobs/recurring");
  redirect(`/jobs/recurring/${newId}`);
}

export async function updateRecurrenceAction(
  recurrenceId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await requirePermission(PERMISSIONS.RECURRING_JOBS_WRITE);

    const parsed = recurrenceSchema.safeParse(
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

    if (parsed.data.endDate && parsed.data.endDate < parsed.data.startDate) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "The end date can't be before the start date.",
        },
      };
    }

    const db = getDb();
    await db
      .update(jobRecurrences)
      .set({ ...toValues(parsed.data), updatedAt: new Date() })
      .where(eq(jobRecurrences.id, recurrenceId));
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }

  revalidatePath(`/jobs/recurring/${recurrenceId}`);
  revalidatePath("/jobs/recurring");
  return { success: true, error: null };
}

export async function deleteRecurrenceAction(
  recurrenceId: string,
): Promise<void> {
  await requirePermission(PERMISSIONS.RECURRING_JOBS_DELETE);

  const db = getDb();
  await db.delete(jobRecurrences).where(eq(jobRecurrences.id, recurrenceId));

  revalidatePath("/jobs/recurring");
}
