import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  customers,
  jobChecklistItems,
  jobRecurrences,
  jobs,
  sites,
  users,
  equipment,
  jobEquipment,
  jobFiles,
} from "@/db/schema";
import { JobEquipmentSection } from "./job-equipment-section";
import { requireUser } from "@/lib/auth/guards";
import { getResourceAccess } from "@/lib/auth/permissions";
import { getFieldDefinitions, getFieldValues } from "@/lib/custom-fields";
import { getActivityLog } from "@/lib/activity-log";
import { ForbiddenMessage } from "@/components/shared/forbidden-message";
import { JobStatusBadge } from "@/components/shared/job-status-badge";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { JobChecklist } from "@/components/shared/job-checklist";
import { JobForm } from "../job-form";
import { JobDeleteSection } from "./delete-section";
import { StatusTransitions } from "./status-transitions";
import { JobFilesSection } from "./job-files-section";
import { CreateFollowUpButton } from "./create-follow-up-button";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireUser();
  const access = await getResourceAccess(viewer, "jobs");
  if (!access.canRead) {
    return <ForbiddenMessage />;
  }

  const { id } = await params;

  const db = getDb();
  const rows = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  const job = rows[0];
  if (!job) {
    notFound();
  }

  const [
    allCustomers,
    allSites,
    technicians,
    definitions,
    fieldValues,
    activityLog,
    checklistItems,
    linkedEquipment,
    availableEquipment,
    followUpSource,
    followUps,
    recurrence,
  ] = await Promise.all([
    db.select().from(customers).orderBy(asc(customers.name)),
    db.select().from(sites).orderBy(asc(sites.name)),
    db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(eq(users.role, "team_member"))
      .orderBy(asc(users.displayName)),
    getFieldDefinitions("job"),
    getFieldValues(job.id),
    getActivityLog("job", job.id),
    db
      .select({
        id: jobChecklistItems.id,
        label: jobChecklistItems.label,
        completed: jobChecklistItems.completed,
      })
      .from(jobChecklistItems)
      .where(eq(jobChecklistItems.jobId, job.id))
      .orderBy(asc(jobChecklistItems.sortOrder)),
    db
      .select({
        linkId: jobEquipment.id,
        equipmentId: jobEquipment.equipmentId,
        name: equipment.name,
        notes: jobEquipment.notes,
      })
      .from(jobEquipment)
      .innerJoin(equipment, eq(jobEquipment.equipmentId, equipment.id))
      .where(eq(jobEquipment.jobId, job.id)),
    job.siteId
      ? db
          .select({ id: equipment.id, name: equipment.name })
          .from(equipment)
          .where(eq(equipment.siteId, job.siteId))
          .orderBy(asc(equipment.name))
      : Promise.resolve([]),
    job.followUpFromJobId
      ? db
          .select({ id: jobs.id, jobNumber: jobs.jobNumber, title: jobs.title })
          .from(jobs)
          .where(eq(jobs.id, job.followUpFromJobId))
          .limit(1)
      : Promise.resolve([]),
    db
      .select({
        id: jobs.id,
        jobNumber: jobs.jobNumber,
        title: jobs.title,
        status: jobs.status,
      })
      .from(jobs)
      .where(eq(jobs.followUpFromJobId, job.id))
      .orderBy(desc(jobs.createdAt)),
    job.recurrenceId
      ? db
          .select({ id: jobRecurrences.id, title: jobRecurrences.title })
          .from(jobRecurrences)
          .where(eq(jobRecurrences.id, job.recurrenceId))
          .limit(1)
      : Promise.resolve([]),
  ]);

  const files = await db
    .select({
      id: jobFiles.id,
      fileName: jobFiles.fileName,
      contentType: jobFiles.contentType,
      sizeBytes: jobFiles.sizeBytes,
      caption: jobFiles.caption,
      uploadedByDisplayName: jobFiles.uploadedByDisplayName,
      createdAt: jobFiles.createdAt,
    })
    .from(jobFiles)
    .where(eq(jobFiles.jobId, job.id))
    .orderBy(desc(jobFiles.createdAt));

  return (
    <div className="max-w-lg space-y-10">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">
            #{job.jobNumber} — {job.title}
          </h1>
          <JobStatusBadge status={job.status} />
        </div>
        {!access.canWrite && (
          <p className="mt-1 text-sm text-muted-foreground">
            You have read-only access to Jobs.
          </p>
        )}
      </div>

      {(followUpSource[0] || recurrence[0] || followUps.length > 0) && (
        <div className="space-y-1 text-sm text-muted-foreground">
          {followUpSource[0] && (
            <p>
              Follow-up of{" "}
              <Link
                href={`/jobs/${followUpSource[0].id}`}
                className="underline"
              >
                #{followUpSource[0].jobNumber} — {followUpSource[0].title}
              </Link>
            </p>
          )}
          {recurrence[0] && (
            <p>
              Part of the recurring series{" "}
              <Link
                href={`/jobs/recurring/${recurrence[0].id}`}
                className="underline"
              >
                {recurrence[0].title}
              </Link>
            </p>
          )}
          {followUps.length > 0 && (
            <div>
              <p>Follow-up jobs:</p>
              <ul className="list-inside list-disc">
                {followUps.map((f) => (
                  <li key={f.id}>
                    <Link href={`/jobs/${f.id}`} className="underline">
                      #{f.jobNumber} — {f.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {access.canWrite && (
        <StatusTransitions jobId={job.id} status={job.status} />
      )}

      <JobForm
        job={job}
        customers={allCustomers}
        sites={allSites}
        technicians={technicians}
        definitions={definitions}
        customFieldValues={fieldValues}
        readOnly={!access.canWrite}
      />

      <JobChecklist
        jobId={job.id}
        items={checklistItems}
        disabled={!access.canWrite}
      />

      {job.siteId && (
        <JobEquipmentSection
          jobId={job.id}
          linked={linkedEquipment}
          available={availableEquipment}
          disabled={!access.canWrite}
        />
      )}

      <JobFilesSection
        jobId={job.id}
        files={files}
        disabled={!access.canWrite}
      />

      {access.canWrite && <CreateFollowUpButton jobId={job.id} />}

      <div className="mt-8 border-t pt-6">
        <h2 className="mb-4 text-sm font-semibold">Activity</h2>
        <ActivityTimeline entries={activityLog} />
      </div>

      <JobDeleteSection job={job} canDelete={access.canDelete} />
    </div>
  );
}
