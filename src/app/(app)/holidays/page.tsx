import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { activityLogEntries, holidayRequests, users } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { getResourceAccess } from "@/lib/auth/permissions";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { ForbiddenMessage } from "@/components/shared/forbidden-message";
import { HolidayStatusBadge } from "@/components/shared/holiday-status-badge";
import { Button } from "@/components/ui/button";
import { daysInclusive, formatDateRange } from "@/lib/holidays";

export const dynamic = "force-dynamic";

const REVIEW_FILTER = {
  key: "review",
  label: "Needs review",
  statuses: ["sent", "viewed"] as const,
};
const FILTERS = [
  REVIEW_FILTER,
  { key: "accepted", label: "Accepted", statuses: ["accepted"] as const },
  { key: "rejected", label: "Rejected", statuses: ["rejected"] as const },
  {
    key: "all",
    label: "All",
    statuses: ["sent", "viewed", "accepted", "rejected"] as const,
  },
];

export default async function HolidaysPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const viewer = await requireUser();
  const access = await getResourceAccess(viewer, "holidays");
  if (!access.canRead) return <ForbiddenMessage />;

  const { status } = await searchParams;
  const filter = FILTERS.find((f) => f.key === status) ?? REVIEW_FILTER;

  const rows = await getDb()
    .select({
      id: holidayRequests.id,
      startDate: holidayRequests.startDate,
      endDate: holidayRequests.endDate,
      status: holidayRequests.status,
      createdAt: holidayRequests.createdAt,
      personName: users.displayName,
    })
    .from(holidayRequests)
    .innerJoin(users, eq(holidayRequests.userId, users.id))
    .where(inArray(holidayRequests.status, [...filter.statuses]))
    .orderBy(desc(holidayRequests.startDate));

  const recent = await getDb()
    .select({
      id: activityLogEntries.id,
      action: activityLogEntries.action,
      actorDisplayName: activityLogEntries.actorDisplayName,
      summary: activityLogEntries.summary,
      metadata: activityLogEntries.metadata,
      createdAt: activityLogEntries.createdAt,
    })
    .from(activityLogEntries)
    .where(eq(activityLogEntries.entityType, "holiday_request"))
    .orderBy(desc(activityLogEntries.createdAt))
    .limit(25);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Holiday requests</h1>
        {access.canWrite && (
          <Button
            render={<Link href="/holidays/new">Record a request</Link>}
            nativeButton={false}
          />
        )}
      </div>

      <nav className="mt-4 flex flex-wrap gap-2" aria-label="Filter requests">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={f.key === filter.key ? "default" : "outline"}
            render={<Link href={`/holidays?status=${f.key}`}>{f.label}</Link>}
            nativeButton={false}
          />
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-md border p-8 text-center">
          <p className="font-medium">
            {filter.key === "review"
              ? "Nothing waiting for review"
              : "No requests here"}
          </p>
          {access.canWrite && (
            <p className="mt-1 text-sm text-muted-foreground">
              Use “Record a request” when a team member asks for time off.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-md border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-2 font-medium">Team member</th>
                <th className="p-2 font-medium">Dates</th>
                <th className="p-2 font-medium">Days</th>
                <th className="p-2 font-medium">Status</th>
                <th className="p-2 font-medium">Recorded</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-b-0">
                  <td className="p-2">
                    <Link
                      href={`/holidays/${row.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {row.personName}
                    </Link>
                  </td>
                  <td className="p-2">
                    {formatDateRange(row.startDate, row.endDate)}
                  </td>
                  <td className="p-2">
                    {daysInclusive(row.startDate, row.endDate)}
                  </td>
                  <td className="p-2">
                    <HolidayStatusBadge status={row.status} />
                  </td>
                  <td className="p-2 text-muted-foreground">
                    {row.createdAt.toISOString().slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-10 max-w-xl">
        <h2 className="mb-3 text-sm font-semibold">Recent activity</h2>
        <ActivityTimeline entries={recent} />
      </div>
    </div>
  );
}
