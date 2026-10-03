import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { customers, jobRecurrences, jobs, sites, users } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { getResourceAccess } from "@/lib/auth/permissions";
import { ForbiddenMessage } from "@/components/shared/forbidden-message";
import { JobStatusBadge } from "@/components/shared/job-status-badge";
import { RecurrenceForm } from "../recurrence-form";
import { DeleteRecurrenceButton } from "../delete-button";

export const dynamic = "force-dynamic";

export default async function RecurringJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireUser();
  const access = await getResourceAccess(viewer, "recurring_jobs");
  if (!access.canRead) {
    return <ForbiddenMessage />;
  }

  const { id } = await params;

  const db = getDb();
  const rows = await db
    .select()
    .from(jobRecurrences)
    .where(eq(jobRecurrences.id, id))
    .limit(1);
  const recurrence = rows[0];
  if (!recurrence) {
    notFound();
  }

  const [allCustomers, allSites, technicians, generatedJobs] =
    await Promise.all([
      db.select().from(customers).orderBy(asc(customers.name)),
      db.select().from(sites).orderBy(asc(sites.name)),
      db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(eq(users.role, "team_member"))
        .orderBy(asc(users.displayName)),
      db
        .select({
          id: jobs.id,
          jobNumber: jobs.jobNumber,
          title: jobs.title,
          status: jobs.status,
          occurrenceDate: jobs.occurrenceDate,
        })
        .from(jobs)
        .where(eq(jobs.recurrenceId, recurrence.id))
        .orderBy(desc(jobs.occurrenceDate))
        .limit(20),
    ]);

  return (
    <div className="max-w-lg space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{recurrence.title}</h1>
        {access.canDelete && (
          <DeleteRecurrenceButton
            recurrenceId={recurrence.id}
            redirectTo="/jobs/recurring"
          />
        )}
      </div>
      {!access.canWrite && (
        <p className="text-sm text-muted-foreground">
          You have read-only access to Recurring Jobs.
        </p>
      )}

      <RecurrenceForm
        customers={allCustomers}
        sites={allSites}
        technicians={technicians}
        recurrence={recurrence}
        readOnly={!access.canWrite}
      />

      <div className="border-t pt-6">
        <h2 className="mb-3 text-sm font-semibold">
          Jobs generated from this series
        </h2>
        {generatedJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            None yet - the next due occurrence is created the next time anyone
            opens the Jobs list on or after its date.
          </p>
        ) : (
          <div className="divide-y rounded-md border">
            {generatedJobs.map((j) => (
              <Link
                key={j.id}
                href={`/jobs/${j.id}`}
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-accent"
              >
                <span>
                  #{j.jobNumber} — {j.title}
                  {j.occurrenceDate && (
                    <span className="text-muted-foreground">
                      {" "}
                      · {j.occurrenceDate}
                    </span>
                  )}
                </span>
                <JobStatusBadge status={j.status} />
              </Link>
            ))}
          </div>
        )}
      </div>

      <p className="text-sm">
        <Link href="/jobs/recurring" className="underline">
          ← Back to Recurring jobs
        </Link>
      </p>
    </div>
  );
}
