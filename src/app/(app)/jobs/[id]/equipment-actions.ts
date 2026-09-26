"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { getDb } from "@/db";
import { jobEquipment } from "@/db/schema";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-catalog";
import { ConflictError, toSafeError, type SafeError } from "@/lib/errors";

export interface FormState {
  success: boolean;
  error: SafeError | null;
}

const addSchema = z.object({
  equipmentId: z.uuid(),
  notes: z.string().optional(),
});

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

export async function addJobEquipmentAction(
  jobId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await requirePermission(PERMISSIONS.JOBS_WRITE);

    const parsed = addSchema.safeParse(Object.fromEntries(formData.entries()));
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
    try {
      await db.insert(jobEquipment).values({
        jobId,
        equipmentId: parsed.data.equipmentId,
        notes: parsed.data.notes || null,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(
          "That equipment is already linked to this job.",
        );
      }
      throw error;
    }

    revalidatePath(`/jobs/${jobId}`);
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}

export async function removeJobEquipmentAction(
  jobId: string,
  linkId: string,
): Promise<void> {
  await requirePermission(PERMISSIONS.JOBS_WRITE);
  const db = getDb();
  await db.delete(jobEquipment).where(eq(jobEquipment.id, linkId));
  revalidatePath(`/jobs/${jobId}`);
}
