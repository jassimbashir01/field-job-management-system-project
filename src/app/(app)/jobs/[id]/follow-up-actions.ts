"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { jobs } from "@/db/schema";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-catalog";
import { logActivity } from "@/lib/activity-log";
import {
  ConflictError,
  NotFoundError,
  toSafeError,
  type SafeError,
} from "@/lib/errors";

export interface CreateFollowUpResult {
  success: boolean;
  newJobId?: string;
  error?: SafeError;
}

export async function createFollowUpJobAction(
  sourceJobId: string,
): Promise<CreateFollowUpResult> {
  try {
    const actor = await requirePermission(PERMISSIONS.JOBS_WRITE);

    const db = getDb();
    const newJobId = await db.transaction(async (tx) => {
      const [source] = await tx
        .select()
        .from(jobs)
        .where(eq(jobs.id, sourceJobId))
        .limit(1);
      if (!source) {
        throw new NotFoundError("That job couldn't be found.");
      }

      const [created] = await tx
        .insert(jobs)
        .values({
          customerId: source.customerId,
          siteId: source.siteId,
          oneOffLocation: source.oneOffLocation,
          assignedToUserId: source.assignedToUserId,
          title: `Follow-up: ${source.title}`,
          jobType: source.jobType,
          followUpFromJobId: source.id,
        })
        .returning();

      if (!created) {
        throw new ConflictError("Insert did not return the created job row");
      }

      await logActivity({
        entityType: "job",
        entityId: created.id,
        action: "created",
        actor,
        summary: `created as a follow-up to job #${source.jobNumber}`,
        tx,
      });

      await logActivity({
        entityType: "job",
        entityId: source.id,
        action: "follow_up_created",
        actor,
        summary: `created follow-up job #${created.jobNumber}`,
        tx,
      });

      return created.id;
    });

    revalidatePath(`/jobs/${sourceJobId}`);
    return { success: true, newJobId };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}
