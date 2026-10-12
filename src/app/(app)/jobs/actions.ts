"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { getDb } from "@/db";
import { resolveCustomerId, resolveSiteId } from "@/lib/resolve-customer-site";
import { customFieldValues, jobChecklistItems, jobs } from "@/db/schema";
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
  computeAutoStatus,
  deriveStatusFromData,
  JOB_STATUS_LABELS,
  type JobStatus,
} from "@/lib/job-status";
import { isDateTimeInPast } from "@/lib/week";
import { ConflictError, toSafeError, type SafeError } from "@/lib/errors";

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

      const scheduledDate = parsed.data.scheduledDate || null;
      const assignedToUserId = parsed.data.assignedToUserId || null;

      const [created] = await tx
        .insert(jobs)
        .values({
          customerId,
          siteId,
          oneOffLocation: siteId ? null : parsed.data.oneOffLocation || null,
          assignedToUserId,
          title: parsed.data.title,
          jobType: parsed.data.jobType || null,
          description: parsed.data.description || null,
          reference: parsed.data.reference || null,
          scheduledDate,
          scheduledTime: parsed.data.scheduledTime || null,
          notes: parsed.data.notes || null,
          status: deriveStatusFromData(
            Boolean(scheduledDate),
            Boolean(assignedToUserId),
          ),
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
      const rows = await tx
        .select({ status: jobs.status })
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1);
      const currentStatus = rows[0]?.status;
      if (!currentStatus) {
        throw new ConflictError("Job not found.");
      }

      const scheduledDate = parsed.data.scheduledDate || null;
      const assignedToUserId = parsed.data.assignedToUserId || null;

      await tx
        .update(jobs)
        .set({
          assignedToUserId,
          title: parsed.data.title,
          jobType: parsed.data.jobType || null,
          description: parsed.data.description || null,
          reference: parsed.data.reference || null,
          scheduledDate,
          scheduledTime: parsed.data.scheduledTime || null,
          notes: parsed.data.notes || null,
          status: computeAutoStatus(
            currentStatus,
            Boolean(scheduledDate),
            Boolean(assignedToUserId),
          ),
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

export async function reopenJobAction(jobId: string): Promise<FormState> {
  try {
    const actor = await requirePermission(PERMISSIONS.JOBS_WRITE);

    const db = getDb();
    await db.transaction(async (tx) => {
      const rows = await tx
        .select({
          status: jobs.status,
          scheduledDate: jobs.scheduledDate,
          assignedToUserId: jobs.assignedToUserId,
        })
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1);
      const current = rows[0];
      if (!current) {
        throw new ConflictError("Job not found.");
      }
      if (current.status !== "incomplete") {
        throw new ConflictError("Only an incomplete job can be reopened.");
      }

      const nextStatus = deriveStatusFromData(
        Boolean(current.scheduledDate),
        Boolean(current.assignedToUserId),
      );

      await tx
        .update(jobs)
        .set({ status: nextStatus, updatedAt: new Date() })
        .where(eq(jobs.id, jobId));

      await logActivity({
        entityType: "job",
        entityId: jobId,
        action: "status_changed",
        actor,
        summary: `reopened the job — changed the status from "Incomplete" to "${JOB_STATUS_LABELS[nextStatus]}"`,
        metadata: { from: "incomplete", to: nextStatus },
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
