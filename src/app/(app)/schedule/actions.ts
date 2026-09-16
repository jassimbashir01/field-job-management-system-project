"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { jobs } from "@/db/schema";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-catalog";
import { toSafeError, type SafeError } from "@/lib/errors";

export interface FormState {
  success: boolean;
  error: SafeError | null;
}

export async function reassignJobAction(
  jobId: string,
  assignedToUserId: string | null,
  scheduledDate: string | null,
): Promise<FormState> {
  try {
    await requirePermission(PERMISSIONS.JOBS_WRITE);

    const db = getDb();
    await db
      .update(jobs)
      .set({ assignedToUserId, scheduledDate, updatedAt: new Date() })
      .where(eq(jobs.id, jobId));

    revalidatePath("/schedule");
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}
