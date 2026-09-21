"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { getDb } from "@/db";
import {
  customers,
  customFieldValues,
  jobChecklistItems,
  jobs,
  sites,
} from "@/db/schema";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-catalog";
import { logActivity } from "@/lib/activity-log";
import {
  extractCustomFieldValues,
  getFieldDefinitions,
  setFieldValues,
} from "@/lib/custom-fields";
import { parseChecklistItems } from "@/lib/job-templates";
import {
  canTransition,
  JOB_STATUS_LABELS,
  type JobStatus,
} from "@/lib/job-status";
import { isDateTimeInPast } from "@/lib/week";
import {
  ConflictError,
  toSafeError,
  ValidationError,
  type SafeError,
} from "@/lib/errors";

const jobSchema = z.object({
  title: z.string().min(1, "Title is required"),
  assignedToUserId: z.union([z.uuid(), z.literal("")]).optional(),
  jobType: z.string().optional(),
  description: z.string().optional(),
  reference: z.string().optional(),
  scheduledDate: z.string().optional(),
  scheduledTime: z.string().optional(),
  notes: z.string().optional(),
  oneOffLocation: z.string().optional(),
});

export interface FormState {
  success: boolean;
  error: SafeError | null;
}

export async function createJobAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  let newJobId: string;

  try {
    const actor = await requirePermission(PERMISSIONS.JOBS_WRITE);

    const parsed = jobSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Invalid input",
        },
      };
    }

    if (
      isDateTimeInPast(
        parsed.data.scheduledDate ?? null,
        parsed.data.scheduledTime ?? null,
      )
    ) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Can't schedule a job in the past.",
        },
      };
    }

    const db = getDb();
    newJobId = await db.transaction(async (tx) => {
      const customerId = await resolveCustomerId(tx, formData);
      const siteId = await resolveSiteId(tx, formData, customerId);

      const [created] = await tx
        .insert(jobs)
        .values({
          customerId,
          siteId,
          oneOffLocation: siteId ? null : parsed.data.oneOffLocation || null,
          assignedToUserId: parsed.data.assignedToUserId || null,
          title: parsed.data.title,
          jobType: parsed.data.jobType || null,
          description: parsed.data.description || null,
          reference: parsed.data.reference || null,
          scheduledDate: parsed.data.scheduledDate || null,
          scheduledTime: parsed.data.scheduledTime || null,
          notes: parsed.data.notes || null,
        })
        .returning();

      if (!created)
        throw new ConflictError("Insert did not return the created job row");

      const definitions = await getFieldDefinitions("job");
      if (definitions.length > 0) {
        const values = extractCustomFieldValues(formData, definitions);
        await setFieldValues(created.id, values, tx);
      }

      const checklistItems = parseChecklistItems(
        formData.get("templateChecklistItems") as string | null,
      );

      if (checklistItems.length > 0) {
        await tx.insert(jobChecklistItems).values(
          checklistItems.map((label, index) => ({
            jobId: created.id,
            label,
            sortOrder: index,
          })),
        );
      }

      await logActivity({
        entityType: "job",
        entityId: created.id,
        action: "created",
        actor,
        summary: "created this job",
        tx,
      });

      return created.id;
    });
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }

  redirect(`/jobs/${newJobId}`);
}

export async function updateJobAction(
  jobId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const actor = await requirePermission(PERMISSIONS.JOBS_WRITE);

    const parsed = jobSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Invalid input",
        },
      };
    }

    if (
      isDateTimeInPast(
        parsed.data.scheduledDate ?? null,
        parsed.data.scheduledTime ?? null,
      )
    ) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Can't schedule a job in the past.",
        },
      };
    }

    const db = getDb();
    await db.transaction(async (tx) => {
      const customerId = await resolveCustomerId(tx, formData);
      const siteId = await resolveSiteId(tx, formData, customerId);

      await tx
        .update(jobs)
        .set({
          customerId,
          siteId,
          oneOffLocation: siteId ? null : parsed.data.oneOffLocation || null,
          assignedToUserId: parsed.data.assignedToUserId || null,
          title: parsed.data.title,
          jobType: parsed.data.jobType || null,
          description: parsed.data.description || null,
          reference: parsed.data.reference || null,
          scheduledDate: parsed.data.scheduledDate || null,
          scheduledTime: parsed.data.scheduledTime || null,
          notes: parsed.data.notes || null,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, jobId));

      const definitions = await getFieldDefinitions("job");
      if (definitions.length > 0) {
        const values = extractCustomFieldValues(formData, definitions);
        await setFieldValues(jobId, values, tx);
      }

      await logActivity({
        entityType: "job",
        entityId: jobId,
        action: "updated",
        actor,
        summary: "updated the job details",
        tx,
      });
    });

    revalidatePath(`/jobs/${jobId}`);
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}

export async function transitionJobStatusAction(
  jobId: string,
  nextStatus: JobStatus,
): Promise<FormState> {
  try {
    const actor = await requirePermission(PERMISSIONS.JOBS_WRITE);

    const db = getDb();
    await db.transaction(async (tx) => {
      const rows = await tx
        .select({ status: jobs.status })
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1);
      const currentStatus = rows[0]?.status;
      if (!currentStatus) {
        throw new ConflictError("Job not found.");
      }

      if (!canTransition(currentStatus, nextStatus)) {
        throw new ConflictError(
          `Can't move a job from "${JOB_STATUS_LABELS[currentStatus]}" to "${JOB_STATUS_LABELS[nextStatus]}" — that's not a valid transition.`,
        );
      }

      await tx
        .update(jobs)
        .set({ status: nextStatus, updatedAt: new Date() })
        .where(eq(jobs.id, jobId));

      await logActivity({
        entityType: "job",
        entityId: jobId,
        action: "status_changed",
        actor,
        summary: `changed the status from "${JOB_STATUS_LABELS[currentStatus]}" to "${JOB_STATUS_LABELS[nextStatus]}"`,
        metadata: { from: currentStatus, to: nextStatus },
        tx,
      });
    });

    revalidatePath(`/jobs/${jobId}`);
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}

export async function deleteJobAction(jobId: string): Promise<FormState> {
  try {
    const actor = await requirePermission(PERMISSIONS.JOBS_DELETE);

    const db = getDb();
    await db.transaction(async (tx) => {
      await logActivity({
        entityType: "job",
        entityId: jobId,
        action: "deleted",
        actor,
        summary: "deleted this job",
        tx,
      });

      await tx
        .delete(customFieldValues)
        .where(eq(customFieldValues.entityId, jobId));
      await tx.delete(jobs).where(eq(jobs.id, jobId));
    });

    revalidatePath("/jobs");
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }

  redirect("/jobs");
}

export async function resolveCustomerId(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  formData: FormData,
): Promise<string> {
  const newName = formData.get("newCustomerName");
  if (newName && String(newName).trim()) {
    const [created] = await tx
      .insert(customers)
      .values({
        name: String(newName).trim(),
        phone: (formData.get("newCustomerPhone") as string) || null,
        email: (formData.get("newCustomerEmail") as string) || null,
      })
      .returning();
    if (!created) throw new ConflictError("Could not create the new customer.");
    return created.id;
  }

  const existingId = formData.get("customerId");
  if (typeof existingId !== "string" || !existingId) {
    throw new ValidationError("A customer is required.");
  }
  return existingId;
}

export async function resolveSiteId(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  formData: FormData,
  customerId: string,
): Promise<string | null> {
  const newName = formData.get("newSiteName");
  if (newName && String(newName).trim()) {
    const [created] = await tx
      .insert(sites)
      .values({
        customerId,
        name: String(newName).trim(),
        addressLine1: (formData.get("newSiteAddressLine1") as string) || null,
        city: (formData.get("newSiteCity") as string) || null,
        postalCode: (formData.get("newSitePostalCode") as string) || null,
      })
      .returning();
    if (!created) throw new ConflictError("Could not create the new site.");
    return created.id;
  }

  const existingId = formData.get("siteId");
  return typeof existingId === "string" && existingId ? existingId : null;
}

export async function toggleChecklistItemAction(
  itemId: string,
  jobId: string,
  completed: boolean,
): Promise<FormState> {
  try {
    await requirePermission(PERMISSIONS.JOBS_WRITE);

    const db = getDb();
    await db
      .update(jobChecklistItems)
      .set({ completed })
      .where(eq(jobChecklistItems.id, itemId));

    revalidatePath(`/jobs/${jobId}`);
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}
