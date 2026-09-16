import Link from "next/link";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { getDb } from "@/db";
import { customers, jobs, sites, users } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { getResourceAccess } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { ForbiddenMessage } from "@/components/shared/forbidden-message";
import { JobSearchInput } from "./search-input";
import { JobStatusQuickSelect } from "./status-quick-select";
import { type JobStatus } from "@/lib/job-status";
import { JobStatusFilter } from "./status-filter";

export const dynamic = "force-dynamic";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const viewer = await requireUser();
  const access = await getResourceAccess(viewer, "jobs");
  if (!access.canRead) {
    return <ForbiddenMessage />;
  }

  const { q, status } = await searchParams;

  const db = getDb();
  const query = q?.trim();
  const numericQuery = query && /^\d+$/.test(query) ? Number(query) : null;

  const rows = await db
    .select({
      id: jobs.id,
      jobNumber: jobs.jobNumber,
      title: jobs.title,
      status: jobs.status,
      scheduledDate: jobs.scheduledDate,
      customerName: customers.name,
      siteName: sites.name,
      technicianName: users.displayName,
      oneOffLocation: jobs.oneOffLocation,
    })
    .from(jobs)
    .innerJoin(customers, eq(jobs.customerId, customers.id))
    .leftJoin(sites, eq(jobs.siteId, sites.id))
    .leftJoin(users, eq(jobs.assignedToUserId, users.id))
    .where(
      and(
        query
          ? or(
              numericQuery !== null
                ? eq(jobs.jobNumber, numericQuery)
                : undefined,
              ilike(customers.name, `%${query}%`),
              ilike(sites.name, `%${query}%`),
              ilike(users.displayName, `%${query}%`),
              ilike(jobs.jobType, `%${query}%`),
              ilike(jobs.reference, `%${query}%`),
            )
          : undefined,
        status ? eq(jobs.status, status as JobStatus) : undefined,
      ),
    )
    .orderBy(desc(jobs.createdAt));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Jobs</h1>
        {access.canWrite && (
          <Button
            render={<Link href="/jobs/new">New job</Link>}
            nativeButton={false}
          />
        )}
      </div>

      <form method="get" className="mt-4 flex gap-2">
        <JobSearchInput defaultQuery={query ?? ""} />
        <JobStatusFilter currentStatus={status ?? ""} />
      </form>

      <div className="mt-6 divide-y rounded-md border">
        {rows.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            {query || status ? "No matches." : "No jobs yet."}
          </p>
        )}
        {rows.map((job) => (
          <div
            key={job.id}
            className="flex items-center justify-between px-4 py-3 text-sm hover:bg-accent"
          >
            <Link href={`/jobs/${job.id}`} className="flex-1">
              <p className="font-medium">
                #{job.jobNumber} — {job.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {job.customerName}
                {(job.siteName ?? job.oneOffLocation) &&
                  ` · ${job.siteName ?? job.oneOffLocation}`}
                {job.technicianName && ` · ${job.technicianName}`}
                {job.scheduledDate && ` · ${job.scheduledDate}`}
              </p>
            </Link>
            <JobStatusQuickSelect
              jobId={job.id}
              status={job.status}
              disabled={!access.canWrite}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
