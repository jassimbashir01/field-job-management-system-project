import Link from "next/link";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { shifts, users } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { getResourceAccess } from "@/lib/auth/permissions";
import { ForbiddenMessage } from "@/components/shared/forbidden-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { needsAnnouncing, normalizeTime, shiftState } from "@/lib/rota";
import {
  addDays,
  getWeekDates,
  todayDateString,
  weekdayLabel,
} from "@/lib/week";
import { RotaCell, type CellShift } from "./rota-cell";
import { RotaToolbar } from "./rota-toolbar";

export const dynamic = "force-dynamic";

export default async function RotaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const viewer = await requireUser();
  const access = await getResourceAccess(viewer, "rota");
  if (!access.canRead) return <ForbiddenMessage />;

  const { date } = await searchParams;
  const anchor =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayDateString();
  const weekDates = getWeekDates(anchor);
  const firstDay = weekDates[0] ?? anchor;
  const lastDay = weekDates[6] ?? anchor;
  const today = todayDateString();

  const db = getDb();
  const [people, weekShifts] = await Promise.all([
    db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(and(eq(users.role, "team_member"), eq(users.isActive, true)))
      .orderBy(asc(users.displayName)),
    db
      .select()
      .from(shifts)
      .where(
        and(gte(shifts.shiftDate, firstDay), lte(shifts.shiftDate, lastDay)),
      )
      .orderBy(asc(shifts.startTime)),
  ]);

  const personIds = new Set(people.map((p) => p.id));
  const visible = weekShifts.filter((s) => personIds.has(s.userId));
  const pending = visible.filter(needsAnnouncing);
  const peopleToTell = new Set(pending.map((s) => s.userId)).size;

  const cellShifts = (userId: string, shiftDate: string): CellShift[] =>
    visible
      .filter((s) => s.userId === userId && s.shiftDate === shiftDate)
      .map((s) => ({
        id: s.id,
        startTime: normalizeTime(s.startTime) ?? s.startTime,
        endTime: normalizeTime(s.endTime) ?? s.endTime,
        note: s.note,
        state: shiftState(s),
      }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Rota</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            render={
              <Link href={`/rota?date=${addDays(firstDay, -7)}`}>
                Previous week
              </Link>
            }
            nativeButton={false}
          />
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/rota?date=${today}`}>This week</Link>}
            nativeButton={false}
          />
          <Button
            variant="outline"
            size="sm"
            render={
              <Link href={`/rota?date=${addDays(firstDay, 7)}`}>Next week</Link>
            }
            nativeButton={false}
          />
          <form action="/rota" method="get" className="flex items-center gap-1">
            <Input
              key={firstDay}
              type="date"
              name="date"
              defaultValue={firstDay}
              aria-label="Go to the week containing"
              className="h-8 w-40"
            />
            <Button type="submit" variant="outline" size="sm">
              Go
            </Button>
          </form>
        </div>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {firstDay} – {lastDay}
      </p>

      <RotaToolbar
        weekStart={firstDay}
        pendingCount={pending.length}
        peopleToTell={peopleToTell}
        canWrite={access.canWrite}
      />

      {people.length === 0 ? (
        <div className="mt-6 rounded-md border p-8 text-center">
          <p className="font-medium">No team members to roster yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The rota lists active team members. Add some under{" "}
            <Link href="/team" className="underline">
              Team
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto rounded-md border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b">
                  <th className="w-40 p-2 text-left font-medium">
                    Team member
                  </th>
                  {weekDates.map((weekDate, index) => (
                    <th
                      key={weekDate}
                      className={`min-w-40 border-l p-2 text-left font-medium ${weekDate === today ? "bg-muted" : ""}`}
                    >
                      {weekdayLabel(index)}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {weekDate}
                        {weekDate === today ? " · Today" : ""}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {people.map((person) => (
                  <tr key={person.id} className="border-b last:border-b-0">
                    <td className="p-2 align-top font-medium">
                      {person.displayName}
                    </td>
                    {weekDates.map((weekDate) => (
                      <td
                        key={weekDate}
                        className={`border-l p-2 align-top ${weekDate === today ? "bg-muted/40" : ""}`}
                      >
                        <RotaCell
                          userId={person.id}
                          personName={person.displayName}
                          date={weekDate}
                          shifts={cellShifts(person.id, weekDate)}
                          canWrite={access.canWrite}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {visible.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              No shifts this week yet.
              {access.canWrite &&
                " Use “+ Add” in any cell, or “Copy previous week” to start from last week."}
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            <strong>Draft</strong> (dashed): staff haven&apos;t been told.{" "}
            <strong>Changed</strong>: edited since they were told.{" "}
            <strong>Cancelled</strong>: removed, not yet announced. Staff are
            emailed when you publish the week.
          </p>
        </>
      )}
    </div>
  );
}
