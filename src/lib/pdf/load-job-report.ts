import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  activityLogEntries,
  customers,
  equipment,
  jobChecklistItems,
  jobEquipment,
  jobFiles,
  jobs,
  sites,
  users,
} from "@/db/schema";
import { ConflictError } from "@/lib/errors";
import { loadBranding } from "./load-document";
import type { JobReportModel } from "./job-report-pdf";

export interface LoadedJobReport {
  model: JobReportModel;
  fileName: string;
  customerEmail: string | null;
}

export async function loadJobReport(
  jobId: string,
): Promise<LoadedJobReport | null> {
  const db = getDb();
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!job) return null;
  if (job.status !== "completed") {
    throw new ConflictError(
      "A report is only available once the job is completed.",
    );
  }

  const [
    customerRows,
    siteRows,
    technicianRows,
    checklist,
    linkedEquipment,
    files,
    completedRows,
    { branding },
  ] = await Promise.all([
    db
      .select()
      .from(customers)
      .where(eq(customers.id, job.customerId))
      .limit(1),
    job.siteId
      ? db.select().from(sites).where(eq(sites.id, job.siteId)).limit(1)
      : Promise.resolve([]),
    job.assignedToUserId
      ? db
          .select({ displayName: users.displayName })
          .from(users)
          .where(eq(users.id, job.assignedToUserId))
          .limit(1)
      : Promise.resolve([]),
    db
      .select({
        label: jobChecklistItems.label,
        completed: jobChecklistItems.completed,
      })
      .from(jobChecklistItems)
      .where(eq(jobChecklistItems.jobId, jobId))
      .orderBy(asc(jobChecklistItems.sortOrder)),
    db
      .select({ name: equipment.name, notes: jobEquipment.notes })
      .from(jobEquipment)
      .innerJoin(equipment, eq(jobEquipment.equipmentId, equipment.id))
      .where(eq(jobEquipment.jobId, jobId))
      .orderBy(asc(equipment.name)),
    db
      .select({ fileName: jobFiles.fileName, caption: jobFiles.caption })
      .from(jobFiles)
      .where(eq(jobFiles.jobId, jobId))
      .orderBy(asc(jobFiles.createdAt)),
    db
      .select({ createdAt: activityLogEntries.createdAt })
      .from(activityLogEntries)
      .where(
        and(
          eq(activityLogEntries.entityType, "job"),
          eq(activityLogEntries.entityId, jobId),
          eq(activityLogEntries.action, "status_changed"),
          sql`${activityLogEntries.metadata}->>'to' = 'completed'`,
        ),
      )
      .orderBy(desc(activityLogEntries.createdAt))
      .limit(1),
    loadBranding(),
  ]);

  const customer = customerRows[0];
  const completedAt = completedRows[0]?.createdAt;
  const oneOff = job.oneOffLocation?.trim();

  return {
    fileName: `Job-Report-${job.jobNumber}.pdf`,
    customerEmail: customer?.email ?? null,
    model: {
      jobNumber: job.jobNumber,
      title: job.title,
      completedOn: completedAt ? completedAt.toISOString().slice(0, 10) : null,
      customerName: customer?.name ?? "",
      customerCompany: customer?.companyName ?? null,
      locationLine: siteRows[0]?.name ?? (oneOff ? oneOff : null),
      technician: technicianRows[0]?.displayName ?? null,
      scheduledFor:
        [job.scheduledDate, job.scheduledTime].filter(Boolean).join(" ") ||
        null,
      reference: job.reference,
      jobType: job.jobType,
      description: job.description,
      notes: job.notes,
      checklist,
      equipment: linkedEquipment,
      files,
      branding,
    },
  };
}
