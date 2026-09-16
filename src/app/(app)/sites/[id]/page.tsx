import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { customers, equipment, jobs, sites } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { getResourceAccess } from "@/lib/auth/permissions";
import { getFieldDefinitions, getFieldValues } from "@/lib/custom-fields";
import { Button } from "@/components/ui/button";
import { ForbiddenMessage } from "@/components/shared/forbidden-message";
import { JobStatusBadge } from "@/components/shared/job-status-badge";
import { SiteForm } from "../site-form";
import { SiteDeleteSection } from "./delete-section";

export const dynamic = "force-dynamic";

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireUser();
  const access = await getResourceAccess(viewer, "sites");
  if (!access.canRead) {
    return <ForbiddenMessage />;
  }

  const { id } = await params;

  const db = getDb();
  const rows = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
  const site = rows[0];
  if (!site) {
    notFound();
  }

  const [allCustomers, definitions, fieldValues, siteEquipment, siteJobs] =
    await Promise.all([
      db.select().from(customers).orderBy(asc(customers.name)),
      getFieldDefinitions("site"),
      getFieldValues(site.id),
      db
        .select()
        .from(equipment)
        .where(eq(equipment.siteId, site.id))
        .orderBy(asc(equipment.name)),
      db
        .select()
        .from(jobs)
        .where(eq(jobs.siteId, site.id))
        .orderBy(desc(jobs.createdAt))
        .limit(10),
    ]);

  return (
    <div className="max-w-lg space-y-10">
      <div>
        <h1 className="text-xl font-semibold">{site.name}</h1>
        {!access.canWrite && (
          <p className="mt-1 text-sm text-muted-foreground">
            You have read-only access to Sites.
          </p>
        )}
        <SiteForm
          site={site}
          customers={allCustomers}
          definitions={definitions}
          customFieldValues={fieldValues}
          readOnly={!access.canWrite}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent jobs</h2>
          <Button
            variant="outline"
            size="sm"
            render={
              <Link
                href={`/jobs/new?customerId=${site.customerId}&siteId=${site.id}`}
              >
                New job
              </Link>
            }
            nativeButton={false}
          />
        </div>
        {siteJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No jobs yet.</p>
        ) : (
          <div className="divide-y rounded-md border">
            {siteJobs.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="flex items-center justify-between px-4 py-2 text-sm hover:bg-accent"
              >
                <p className="font-medium">
                  #{job.jobNumber} — {job.title}
                </p>
                <JobStatusBadge status={job.status} />
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Equipment</h2>
          {access.canWrite && (
            <Button
              variant="outline"
              size="sm"
              render={
                <Link href={`/equipment/new?siteId=${site.id}`}>
                  Add equipment
                </Link>
              }
              nativeButton={false}
            />
          )}
        </div>
        {siteEquipment.length === 0 ? (
          <p className="text-sm text-muted-foreground">No equipment yet.</p>
        ) : (
          <div className="divide-y rounded-md border">
            {siteEquipment.map((item) => (
              <Link
                key={item.id}
                href={`/equipment/${item.id}`}
                className="block px-4 py-2 text-sm hover:bg-accent"
              >
                <p className="font-medium">{item.name}</p>
                {(item.manufacturer || item.model) && (
                  <p className="text-xs text-muted-foreground">
                    {item.manufacturer} {item.model}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      <SiteDeleteSection site={site} canDelete={access.canDelete} />
    </div>
  );
}
