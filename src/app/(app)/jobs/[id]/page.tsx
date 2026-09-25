import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { customers, jobChecklistItems, jobs, sites, users } from "@/db/schema";
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
  ]);

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

      <div className="mt-8 border-t pt-6">
        <h2 className="mb-4 text-sm font-semibold">Activity</h2>
        <ActivityTimeline entries={activityLog} />
      </div>

      <JobDeleteSection job={job} canDelete={access.canDelete} />
    </div>
  );
}
