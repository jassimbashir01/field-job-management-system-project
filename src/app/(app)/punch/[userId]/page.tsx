import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { ForbiddenMessage } from "@/components/shared/forbidden-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireUser } from "@/lib/auth/guards";
import { getResourceAccess } from "@/lib/auth/permissions";
import { formatDuration, isStale, mapLink } from "@/lib/punch";
import {
  getPunchSettings,
  getTeamMemberName,
  listCompletedJobs,
  listPunchHistory,
  listPunches,
  type PunchView,
} from "@/lib/punch-data";
import { localDateOf } from "@/lib/punch-time";
import { dayLabelOf } from "@/lib/rota";
import { addDays, getWeekDates } from "@/lib/week";
import { AddPunch, PunchActions } from "./punch-editor";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function LocationNote({
  label,
  loc,
}: {
  label: string;
  loc: PunchView["inLocation"];
}) {
  if (loc.status === "captured" && loc.lat !== null && loc.lng !== null) {
    return (
      <a
        href={mapLink(loc.lat, loc.lng)}
        target="_blank"
        rel="noreferrer"
        className="underline"
      >
        {label} location
      </a>
    );
  }
  if (loc.status === "unavailable")
    return <span>{label}: location unavailable</span>;
  return null;
}

export default async function PersonAttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const viewer = await requireUser();
  const access = await getResourceAccess(viewer, "punch");
  if (!access.canRead) return <ForbiddenMessage />;

  const { userId } = await params;
  if (!UUID.test(userId)) notFound();
  const personName = await getTeamMemberName(userId);
  if (!personName) notFound();

  const settings = await getPunchSettings();
  const now = new Date();
  const today = localDateOf(now, settings.timeZone);
  const { date } = await searchParams;
  const anchor = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;
  const weekDates = getWeekDates(anchor);
  const first = weekDates[0] ?? anchor;
  const last = weekDates[6] ?? anchor;

  const [rows, completed, history] = await Promise.all([
    listPunches(userId, first, last, settings.timeZone, now),
    listCompletedJobs(userId, first, last, settings.timeZone),
    listPunchHistory(userId),
  ]);
  const totalMinutes = rows.reduce((sum, p) => sum + p.minutes, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/punch" className="text-sm text-muted-foreground underline">
          ← Attendance
        </Link>
        <h1 className="mt-2 text-xl font-semibold">{personName}</h1>
        <p className="text-sm text-muted-foreground">
          {first} – {last} · times in {settings.timeZone}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          render={
            <Link href={`/punch/${userId}?date=${addDays(first, -7)}`}>
              Previous week
            </Link>
          }
          nativeButton={false}
        />
        <Button
          size="sm"
          variant="outline"
          render={<Link href={`/punch/${userId}`}>This week</Link>}
          nativeButton={false}
        />
        <Button
          size="sm"
          variant="outline"
          render={
            <Link href={`/punch/${userId}?date=${addDays(first, 7)}`}>
              Next week
            </Link>
          }
          nativeButton={false}
        />
        <form
          action={`/punch/${userId}`}
          method="get"
          className="flex items-center gap-1"
        >
          <Input
            key={first}
            type="date"
            name="date"
            defaultValue={first}
            aria-label="Go to the week containing"
            className="h-8 w-40"
          />
          <Button type="submit" size="sm" variant="outline">
            Go
          </Button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {weekDates.map((day) => {
              const dayPunches = rows.filter((p) => p.date === day);
              return (
                <tr key={day} className="border-b align-top last:border-b-0">
                  <th
                    className={`w-32 p-3 text-left font-medium ${day === today ? "bg-muted" : ""}`}
                  >
                    {dayLabelOf(day)}
                  </th>
                  <td className="space-y-3 p-3">
                    {dayPunches.length === 0 && (
                      <span className="text-muted-foreground">No punches</span>
                    )}
                    {dayPunches.map((p) => (
                      <div key={p.id}>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span className="font-medium">
                            {p.inTime} –{" "}
                            {p.open
                              ? "still in"
                              : `${p.outTime}${p.outDate ? ` (${p.outDate})` : ""}`}
                          </span>
                          <span>{formatDuration(p.minutes)}</span>
                          {p.open && isStale(p.punchedInAt, now) && (
                            <strong>Still punched in — check this</strong>
                          )}
                          {access.canWrite && (
                            <PunchActions
                              id={p.id}
                              inInput={p.inInput}
                              outInput={p.outInput}
                            />
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                          {p.source === "manager" && (
                            <span>Added by a manager</span>
                          )}
                          {p.edited && p.source !== "manager" && (
                            <span>Edited by a manager</span>
                          )}
                          {p.editReason && <span>Reason: {p.editReason}</span>}
                          <LocationNote label="In" loc={p.inLocation} />
                          {!p.open && (
                            <LocationNote label="Out" loc={p.outLocation} />
                          )}
                        </div>
                      </div>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted-foreground">
        Time at work this week: <strong>{formatDuration(totalMinutes)}</strong>.
        This is a record of when people worked, not a pay calculation.
      </p>

      {access.canWrite && <AddPunch userId={userId} defaultDay={today} />}

      <section>
        <h2 className="text-sm font-semibold">Jobs completed this week</h2>
        {completed.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">None.</p>
        ) : (
          <ul className="mt-2 max-w-xl divide-y rounded-md border text-sm">
            {completed.map((job) => (
              <li key={job.id} className="flex justify-between gap-3 p-2">
                <Link
                  href={`/jobs/${job.id}`}
                  className="underline-offset-4 hover:underline"
                >
                  Job {job.jobNumber} · {job.title}
                </Link>
                <span className="text-muted-foreground">
                  {dayLabelOf(job.completedOn)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold">PDF</h2>
        <form
          action="/api/punch/pdf"
          method="get"
          className="mt-2 flex flex-wrap items-end gap-2"
        >
          <input type="hidden" name="userId" value={userId} />
          <label className="space-y-1">
            <span className="block text-xs text-muted-foreground">From</span>
            <Input
              key={`f-${first}`}
              type="date"
              name="from"
              defaultValue={first}
              className="h-8 w-40"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-muted-foreground">To</span>
            <Input
              key={`t-${last}`}
              type="date"
              name="to"
              defaultValue={last}
              className="h-8 w-40"
            />
          </label>
          <Button type="submit" size="sm" variant="outline">
            Download PDF
          </Button>
        </form>
      </section>

      <section className="max-w-xl">
        <h2 className="mb-3 text-sm font-semibold">History</h2>
        <ActivityTimeline entries={history} />
      </section>
    </div>
  );
}
