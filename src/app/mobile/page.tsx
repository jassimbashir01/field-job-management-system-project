import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDuration, isStale } from "@/lib/punch";
import {
  getOpenPunch,
  getPunchSettings,
  listCompletedJobs,
  listPunches,
} from "@/lib/punch-data";
import { localDateOf } from "@/lib/punch-time";
import { dayLabelOf } from "@/lib/rota";
import { addDays, getWeekDates } from "@/lib/week";
import { PunchCard } from "./punch-card";

export const dynamic = "force-dynamic";

export default async function MobilePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const user = await requireUser();
  if (user.mustChangePassword) redirect("/change-password");
  if (user.role !== "team_member") redirect("/dashboard");

  const settings = await getPunchSettings();
  const now = new Date();
  const today = localDateOf(now, settings.timeZone);
  const currentWeekStart = getWeekDates(today)[0] ?? today;

  const { week } = await searchParams;
  const requested = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : today;
  // Never past the current week.
  const anchor = requested > today ? today : requested;
  const weekDates = getWeekDates(anchor);
  const first = weekDates[0] ?? anchor;
  const last = weekDates[6] ?? anchor;
  const isCurrentWeek = first === currentWeekStart;

  const [rows, completed, openRow] = await Promise.all([
    listPunches(user.id, first, last, settings.timeZone, now),
    listCompletedJobs(user.id, first, last, settings.timeZone),
    getOpenPunch(user.id, settings.timeZone),
  ]);
  const open = openRow;
  const totalMinutes = rows.reduce((sum, p) => sum + p.minutes, 0);

  return (
    <main className="mx-auto max-w-md space-y-6 p-4 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">
          Hi {user.displayName.split(" ")[0]}
        </h1>
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-md border border-input px-3 py-1.5 text-sm"
          >
            Sign out
          </button>
        </form>
      </div>

      <PunchCard
        openSince={open ? open.inTime : null}
        openStale={open ? isStale(open.punchedInAt, now) : false}
        locationEnabled={settings.locationEnabled}
      />

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            {isCurrentWeek ? "This week" : `Week of ${first}`}
          </h2>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              render={
                <Link href={`/mobile?week=${addDays(first, -7)}`}>
                  Previous
                </Link>
              }
              nativeButton={false}
            />
            {isCurrentWeek ? (
              <Button size="sm" variant="outline" disabled>
                This week
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                render={<Link href="/mobile">This week</Link>}
                nativeButton={false}
              />
            )}
            {isCurrentWeek ? (
              <Button size="sm" variant="outline" disabled>
                Next
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                render={
                  <Link href={`/mobile?week=${addDays(first, 7)}`}>Next</Link>
                }
                nativeButton={false}
              />
            )}
          </div>
        </div>
        <ul className="mt-3 divide-y rounded-md border text-sm">
          {weekDates.map((day) => {
            const dayPunches = rows.filter((p) => p.date === day);
            return (
              <li key={day} className="flex justify-between gap-3 p-2">
                <span className={day === today ? "font-medium" : ""}>
                  {dayLabelOf(day)}
                </span>
                <span className="text-right">
                  {dayPunches.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    dayPunches.map((p) => (
                      <span key={p.id} className="block">
                        {p.inTime} –{" "}
                        {p.open
                          ? "now"
                          : `${p.outTime}${p.outDate ? " (next day)" : ""}`}{" "}
                        · {formatDuration(p.minutes)}
                        {p.edited && (
                          <span className="text-muted-foreground">
                            {" "}
                            · edited by a manager
                          </span>
                        )}
                      </span>
                    ))
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Time at work this week:{" "}
          <strong>{formatDuration(totalMinutes)}</strong>. This is a record of
          when you worked, not a pay calculation.
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Jobs you completed this week</h2>
        {completed.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">None.</p>
        ) : (
          <ul className="mt-2 divide-y rounded-md border text-sm">
            {completed.map((job) => (
              <li key={job.id} className="flex justify-between gap-3 p-2">
                <span>
                  Job {job.jobNumber} · {job.title}
                </span>
                <span className="text-muted-foreground">
                  {dayLabelOf(job.completedOn)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold">Download a PDF</h2>
        <form action="/api/punch/pdf" method="get" className="mt-2 space-y-2">
          <input type="hidden" name="userId" value={user.id} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="from" className="text-xs text-muted-foreground">
                From
              </label>
              <Input
                id="from"
                type="date"
                name="from"
                defaultValue={first}
                key={`f-${first}`}
              />
            </div>
            <div>
              <label htmlFor="to" className="text-xs text-muted-foreground">
                To
              </label>
              <Input
                id="to"
                type="date"
                name="to"
                defaultValue={last}
                key={`t-${last}`}
              />
            </div>
          </div>
          <Button type="submit" variant="outline" className="w-full">
            Download PDF
          </Button>
        </form>
      </section>
    </main>
  );
}
