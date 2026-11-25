import Link from "next/link";
import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { punches, users } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { getResourceAccess } from "@/lib/auth/permissions";
import { ForbiddenMessage } from "@/components/shared/forbidden-message";
import { formatDuration, durationMinutes, isStale } from "@/lib/punch";
import { getPunchSettings } from "@/lib/punch-data";
import { localDateOf, localTimeOf } from "@/lib/punch-time";
import { LocationSetting } from "./location-setting";

export const dynamic = "force-dynamic";

export default async function PunchPage() {
  const viewer = await requireUser();
  const access = await getResourceAccess(viewer, "punch");
  if (!access.canRead) return <ForbiddenMessage />;

  const settings = await getPunchSettings();
  const now = new Date();
  const today = localDateOf(now, settings.timeZone);
  const db = getDb();

  const [team, openRows] = await Promise.all([
    db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(and(eq(users.role, "team_member"), eq(users.isActive, true)))
      .orderBy(asc(users.displayName)),
    db
      .select({
        id: punches.id,
        userId: punches.userId,
        punchedInAt: punches.punchedInAt,
        displayName: users.displayName,
      })
      .from(punches)
      .innerJoin(users, eq(punches.userId, users.id))
      .where(isNull(punches.punchedOutAt))
      .orderBy(asc(punches.punchedInAt)),
  ]);
  const openByUser = new Set(openRows.map((row) => row.userId));

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Attendance</h1>

      <section>
        <h2 className="text-sm font-semibold">Punched in now</h2>
        {openRows.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Nobody is punched in.
          </p>
        ) : (
          <ul className="mt-2 divide-y rounded-md border text-sm">
            {openRows.map((row) => {
              const stale = isStale(row.punchedInAt, now);
              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3"
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: "var(--status-completed)" }}
                    />
                    <Link
                      href={`/punch/${row.userId}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {row.displayName}
                    </Link>
                    <span className="text-muted-foreground">
                      since {localTimeOf(row.punchedInAt, settings.timeZone)} (
                      {formatDuration(
                        durationMinutes(row.punchedInAt, null, now),
                      )}
                      )
                    </span>
                    {stale && <strong>· Still punched in — check this</strong>}
                  </span>
                  <Link
                    href={`/rota?date=${today}`}
                    className="text-sm underline"
                  >
                    Today&apos;s rota
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold">Team members</h2>
        {team.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No active team members yet. Add some under{" "}
            <Link href="/team" className="underline">
              Team
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-2 divide-y rounded-md border text-sm">
            {team.map((person) => (
              <li
                key={person.id}
                className="flex items-center justify-between gap-2 p-3"
              >
                <Link
                  href={`/punch/${person.id}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {person.displayName}
                </Link>
                <span className="text-muted-foreground">
                  {openByUser.has(person.id) ? "Punched in" : "Not punched in"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {viewer.role === "admin" && (
        <LocationSetting enabled={settings.locationEnabled} />
      )}
    </div>
  );
}
