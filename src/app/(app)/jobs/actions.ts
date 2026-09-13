"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { getDb } from "@/db";
import { customFieldValues, jobs } from "@/db/schema";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-catalog";
import {
  getFieldDefinitions,
  setFieldValues,
  type CustomFieldValue,
} from "@/lib/custom-fields";
import {
  canTransition,
  JOB_STATUS_LABELS,
  type JobStatus,
} from "@/lib/job-status";
import { ConflictError, toSafeError, type SafeError } from "@/lib/errors";

const jobSchema = z.object({
  customerId: z.uuid(),
  siteId: z.union([z.uuid(), z.literal("")]).optional(),
  assignedToUserId: z.union([z.uuid(), z.literal("")]).optional(),
  title: z.string().min(1, "Title is required"),
  jobType: z.string().optional(),
  description: z.string().optional(),
  reference: z.string().optional(),
  scheduledDate: z.string().optional(),
  scheduledTime: z.string().optional(),
  notes: z.string().optional(),
});

export interface FormState {
  success: boolean;
  error: SafeError | null;
}

function extractCustomFieldValues(
  formData: FormData,
  definitions: { id: string; fieldType: string }[],
): Map<string, CustomFieldValue> {
  const values = new Map<string, CustomFieldValue>();

  for (const definition of definitions) {
    const name = `custom_${definition.id}`;

    switch (definition.fieldType) {
      case "boolean":
        values.set(definition.id, formData.get(name) === "on");
        break;
      case "multi_select":
        values.set(definition.id, formData.getAll(name).map(String));
        break;
      case "number":
      case "decimal": {
        const raw = formData.get(name);
        values.set(definition.id, raw ? Number(raw) : null);
        break;
      }
      case "measurement": {
        const rawValue = formData.get(`${name}_value`);
        const unit = formData.get(`${name}_unit`);
        values.set(
          definition.id,
          rawValue
            ? { value: Number(rawValue), unit: String(unit ?? "") }
            : null,
        );
        break;
      }
      default: {
        const raw = formData.get(name);
        values.set(definition.id, raw ? String(raw) : null);
      }
    }
  }

  return values;
}

export async function createJobAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  let newJobId: string;

  try {
    await requirePermission(PERMISSIONS.JOBS_WRITE);

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

    const db = getDb();
    const [created] = await db
      .insert(jobs)
      .values({
        customerId: parsed.data.customerId,
        siteId: parsed.data.siteId || null,
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

    if (!created) {
      throw new ConflictError("Insert did not return the created job row");
    }
    newJobId = created.id;

    const definitions = await getFieldDefinitions("job");
    if (definitions.length > 0) {
      const values = extractCustomFieldValues(formData, definitions);
      await setFieldValues(newJobId, values);
    }
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
    await requirePermission(PERMISSIONS.JOBS_WRITE);

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

    const db = getDb();
    await db
      .update(jobs)
      .set({
        customerId: parsed.data.customerId,
        siteId: parsed.data.siteId || null,
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
      await setFieldValues(jobId, values);
    }

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
    await requirePermission(PERMISSIONS.JOBS_WRITE);

    const db = getDb();
    const rows = await db
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

    await db
      .update(jobs)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(eq(jobs.id, jobId));

    revalidatePath(`/jobs/${jobId}`);
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}

export async function deleteJobAction(jobId: string): Promise<FormState> {
  try {
    await requirePermission(PERMISSIONS.JOBS_DELETE);

    const db = getDb();
    await db.transaction(async (tx) => {
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
