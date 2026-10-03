import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { customers, jobRecurrences, sites } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { getResourceAccess } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { ForbiddenMessage } from "@/components/shared/forbidden-message";
import { DeleteRecurrenceButton } from "./delete-button";

export const dynamic = "force-dynamic";

const INTERVAL_LABELS: Record<string, string> = {
  day: "day",
  week: "week",
  month: "month",
};

export default async function RecurringJobsPage() {
  const viewer = await requireUser();
  const access = await getResourceAccess(viewer, "recurring_jobs");
  if (!access.canRead) {
    return <ForbiddenMessage />;
  }

  const db = getDb();
  const rows = await db
    .select({
      id: jobRecurrences.id,
      title: jobRecurrences.title,
      customerName: customers.name,
      siteName: sites.name,
      oneOffLocation: jobRecurrences.oneOffLocation,
      intervalUnit: jobRecurrences.intervalUnit,
      intervalCount: jobRecurrences.intervalCount,
      active: jobRecurrences.active,
    })
    .from(jobRecurrences)
    .innerJoin(customers, eq(jobRecurrences.customerId, customers.id))
    .leftJoin(sites, eq(jobRecurrences.siteId, sites.id))
    .orderBy(desc(jobRecurrences.createdAt));

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Recurring jobs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Series that generate a new job automatically on a schedule — a
            maintenance contract that visits every month, say.
          </p>
        </div>
        {access.canWrite && (
          <Button
            render={<Link href="/jobs/recurring/new">New series</Link>}
            nativeButton={false}
          />
        )}
      </div>

      <div className="mt-6 divide-y rounded-md border">
        {rows.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            No recurring jobs set up yet.
          </p>
        )}
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between px-4 py-3 text-sm"
          >
            <Link
              href={`/jobs/recurring/${r.id}`}
              className="flex-1 hover:underline"
            >
              <p className="font-medium">
                {r.title}
                {!r.active && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    (inactive)
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {r.customerName}
                {r.siteName
                  ? ` · ${r.siteName}`
                  : r.oneOffLocation
                    ? ` · ${r.oneOffLocation}`
                    : ""}
                {" · every "}
                {r.intervalCount > 1
                  ? `${r.intervalCount} ${INTERVAL_LABELS[r.intervalUnit]}s`
                  : INTERVAL_LABELS[r.intervalUnit]}
              </p>
            </Link>
            {access.canDelete && <DeleteRecurrenceButton recurrenceId={r.id} />}
          </div>
        ))}
      </div>

      <p className="mt-4 text-sm">
        <Link href="/jobs" className="underline">
          ← Back to Jobs
        </Link>
      </p>
    </div>
  );
}
