import Link from "next/link";
import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { customers, jobs, sites, users } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { getResourceAccess } from "@/lib/auth/permissions";
import {
  addDays,
  getWeekDates,
  todayDateString,
  weekdayLabel,
} from "@/lib/week";
import { Button } from "@/components/ui/button";
import { ForbiddenMessage } from "@/components/shared/forbidden-message";
import { ScheduleJobCard } from "./job-card";

export const dynamic = "force-dynamic";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const viewer = await requireUser();
  const access = await getResourceAccess(viewer, "jobs");
  if (!access.canRead) {
    return <ForbiddenMessage />;
  }

  const { date } = await searchParams;
  const anchor =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayDateString();
  const weekDates = getWeekDates(anchor);
  const firstDay = weekDates[0] ?? anchor;
  const lastDay = weekDates[6] ?? anchor;

  const db = getDb();
  const [technicians, weekJobs] = await Promise.all([
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
        scheduledDate: jobs.scheduledDate,
        scheduledTime: jobs.scheduledTime,
        assignedToUserId: jobs.assignedToUserId,
        customerName: customers.name,
        siteName: sites.name,
        oneOffLocation: jobs.oneOffLocation,
      })
      .from(jobs)
      .innerJoin(customers, eq(jobs.customerId, customers.id))
      .leftJoin(sites, eq(jobs.siteId, sites.id))
      .where(inArray(jobs.scheduledDate, weekDates)),
  ]);

  const unassignedJobs = weekJobs.filter((job) => !job.assignedToUserId);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Schedule</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            render={
              <Link href={`/schedule?date=${addDays(anchor, -7)}`}>
                Previous week
              </Link>
            }
            nativeButton={false}
          />
          <Button
            variant="outline"
            size="sm"
            render={
              <Link href={`/schedule?date=${todayDateString()}`}>Today</Link>
            }
            nativeButton={false}
          />
          <Button
            variant="outline"
            size="sm"
            render={
              <Link href={`/schedule?date=${addDays(anchor, 7)}`}>
                Next week
              </Link>
            }
            nativeButton={false}
          />
        </div>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {firstDay} – {lastDay}
      </p>

      <div className="mt-6 overflow-x-auto rounded-md border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b">
              <th className="w-40 shrink-0 p-2 text-left font-medium">
                Technician
              </th>
              {weekDates.map((weekDate, index) => (
                <th
                  key={weekDate}
                  className="min-w-40 border-l p-2 text-left font-medium"
                >
                  {weekdayLabel(index)}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {weekDate}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {unassignedJobs.length > 0 && (
              <tr className="border-b">
                <td className="p-2 align-top font-medium text-muted-foreground">
                  Unassigned
                </td>
                {weekDates.map((weekDate) => (
                  <td
                    key={weekDate}
                    className="space-y-1 border-l p-2 align-top"
                  >
                    {unassignedJobs
                      .filter((job) => job.scheduledDate === weekDate)
                      .map((job) => (
                        <ScheduleJobCard
                          key={job.id}
                          job={job}
                          technicians={technicians}
                          disabled={!access.canWrite}
                        />
                      ))}
                  </td>
                ))}
              </tr>
            )}
            {technicians.map((technician) => (
              <tr key={technician.id} className="border-b last:border-b-0">
                <td className="p-2 align-top font-medium">
                  {technician.displayName}
                </td>
                {weekDates.map((weekDate) => (
                  <td
                    key={weekDate}
                    className="space-y-1 border-l p-2 align-top"
                  >
                    {weekJobs
                      .filter(
                        (job) =>
                          job.assignedToUserId === technician.id &&
                          job.scheduledDate === weekDate,
                      )
                      .map((job) => (
                        <ScheduleJobCard
                          key={job.id}
                          job={job}
                          technicians={technicians}
                          disabled={!access.canWrite}
                        />
                      ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
