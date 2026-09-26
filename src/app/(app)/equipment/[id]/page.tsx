import { notFound } from "next/navigation";
import { desc, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { equipment, sites, jobEquipment, jobs } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { getResourceAccess } from "@/lib/auth/permissions";
import { getFieldDefinitions, getFieldValues } from "@/lib/custom-fields";
import { ForbiddenMessage } from "@/components/shared/forbidden-message";
import { EquipmentForm } from "../equipment-form";
import { EquipmentDeleteSection } from "./delete-section";
import { JobStatusBadge } from "@/components/shared/job-status-badge";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireUser();
  const access = await getResourceAccess(viewer, "equipment");
  if (!access.canRead) {
    return <ForbiddenMessage />;
  }

  const { id } = await params;

  const db = getDb();
  const rows = await db
    .select()
    .from(equipment)
    .where(eq(equipment.id, id))
    .limit(1);
  const equipmentItem = rows[0];
  if (!equipmentItem) {
    notFound();
  }

  const [allSites, definitions, fieldValues, jobHistory] = await Promise.all([
    db.select().from(sites).orderBy(asc(sites.name)),
    getFieldDefinitions("equipment"),
    getFieldValues(equipmentItem.id),
    db
      .select({
        jobId: jobs.id,
        jobNumber: jobs.jobNumber,
        title: jobs.title,
        status: jobs.status,
        notes: jobEquipment.notes,
      })
      .from(jobEquipment)
      .innerJoin(jobs, eq(jobEquipment.jobId, jobs.id))
      .where(eq(jobEquipment.equipmentId, equipmentItem.id))
      .orderBy(desc(jobs.createdAt))
      .limit(10),
  ]);

  return (
    <div className="max-w-lg space-y-10">
      <div>
        <h1 className="text-xl font-semibold">{equipmentItem.name}</h1>
        {!access.canWrite && (
          <p className="mt-1 text-sm text-muted-foreground">
            You have read-only access to Equipment.
          </p>
        )}
        <EquipmentForm
          equipment={equipmentItem}
          sites={allSites}
          definitions={definitions}
          customFieldValues={fieldValues}
          readOnly={!access.canWrite}
        />
      </div>
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Job history</h2>
        {jobHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No jobs recorded for this equipment yet.
          </p>
        ) : (
          <div className="divide-y rounded-md border">
            {jobHistory.map((entry) => (
              <Link
                key={entry.jobId}
                href={`/jobs/${entry.jobId}`}
                className="flex items-center justify-between px-4 py-2 text-sm hover:bg-accent"
              >
                <div>
                  <p className="font-medium">
                    #{entry.jobNumber} — {entry.title}
                  </p>
                  {entry.notes && (
                    <p className="text-xs text-muted-foreground">
                      {entry.notes}
                    </p>
                  )}
                </div>
                <JobStatusBadge status={entry.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
      <EquipmentDeleteSection
        equipment={equipmentItem}
        canDelete={access.canDelete}
      />
    </div>
  );
}
