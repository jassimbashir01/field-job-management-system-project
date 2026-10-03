"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { jobs } from "@/db/schema";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-catalog";
import { computeAutoStatus } from "@/lib/job-status";
import { ConflictError, toSafeError, type SafeError } from "@/lib/errors";

export interface FormState {
  success: boolean;
  error: SafeError | null;
}

export async function reassignJobAction(
  jobId: string,
  assignedToUserId: string | null,
  scheduledDate: string | null,
  scheduledTime: string | null,
): Promise<FormState> {
  try {
    await requirePermission(PERMISSIONS.JOBS_WRITE);

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

      await tx
        .update(jobs)
        .set({
          assignedToUserId,
          scheduledDate,
          scheduledTime,
          status: computeAutoStatus(
            currentStatus,
            Boolean(scheduledDate),
            Boolean(assignedToUserId),
          ),
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, jobId));
    });

    revalidatePath("/schedule");
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}
