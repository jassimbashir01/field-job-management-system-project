import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { holidayRequests, users } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { getResourceAccess } from "@/lib/auth/permissions";
import { ForbiddenMessage } from "@/components/shared/forbidden-message";
import { HolidayStatusBadge } from "@/components/shared/holiday-status-badge";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { getActivityLog, logActivity } from "@/lib/activity-log";
import { daysInclusive, formatDateRange } from "@/lib/holidays";
import { DecisionForm } from "./decision-form";

export const dynamic = "force-dynamic";

const stamp = (date: Date | null) =>
  date ? date.toISOString().slice(0, 16).replace("T", " ") : null;

export default async function HolidayDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireUser();
  const access = await getResourceAccess(viewer, "holidays");
  if (!access.canRead) return <ForbiddenMessage />;

  const { id } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    notFound();

  const db = getDb();
  const [found] = await db
    .select()
    .from(holidayRequests)
    .where(eq(holidayRequests.id, id))
    .limit(1);
  if (!found) notFound();
  let request = found;

  if (access.canWrite && request.status === "sent") {
    const now = new Date();
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(holidayRequests)
        .set({
          status: "viewed",
          viewedAt: now,
          viewedByUserId: viewer.id,
          updatedAt: now,
        })
        .where(
          and(eq(holidayRequests.id, id), eq(holidayRequests.status, "sent")),
        )
        .returning();
      if (row) {
        const [owner] = await tx
          .select({ displayName: users.displayName })
          .from(users)
          .where(eq(users.id, row.userId))
          .limit(1);
        await logActivity({
          tx,
          entityType: "holiday_request",
          entityId: id,
          action: "viewed",
          actor: viewer,
          summary: `opened ${owner?.displayName ?? "a team member"}'s request for the first time (marked Viewed)`,
        });
      }
      return row;
    });
    if (updated) request = updated;
  }

  const history = await getActivityLog("holiday_request", id);

  const ids = [
    request.userId,
    request.viewedByUserId,
    request.decidedByUserId,
    request.createdByUserId,
  ].filter((value): value is string => Boolean(value));
  const people = await db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(inArray(users.id, ids));
  const nameOf = (userId: string | null) =>
    people.find((p) => p.id === userId)?.displayName ??
    "someone who has since been removed";

  const days = daysInclusive(request.startDate, request.endDate);

  return (
    <div>
      <Link
        href="/holidays"
        className="text-sm text-muted-foreground underline"
      >
        ← Holiday requests
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{nameOf(request.userId)}</h1>
        <HolidayStatusBadge status={request.status} />
      </div>
      <p className="mt-1 text-lg">
        {formatDateRange(request.startDate, request.endDate)}{" "}
        <span className="text-sm text-muted-foreground">
          ({days} day{days === 1 ? "" : "s"})
        </span>
      </p>

      {request.note && (
        <div className="mt-4 max-w-md">
          <p className="text-sm font-medium">Their note</p>
          <p className="mt-1 text-sm whitespace-pre-wrap">{request.note}</p>
        </div>
      )}

      <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
        <li>
          Recorded {stamp(request.createdAt)} by{" "}
          {nameOf(request.createdByUserId)}
        </li>
        {request.viewedAt && (
          <li>
            Viewed {stamp(request.viewedAt)} by {nameOf(request.viewedByUserId)}
          </li>
        )}
        {request.decidedAt && (
          <li>
            {request.status === "accepted" ? "Accepted" : "Rejected"}{" "}
            {stamp(request.decidedAt)} by {nameOf(request.decidedByUserId)}
          </li>
        )}
      </ul>

      {request.status === "accepted" && (
        <p className="mt-4 text-sm">
          These days are blocked on the{" "}
          <Link href={`/rota?date=${request.startDate}`} className="underline">
            rota
          </Link>
          .
        </p>
      )}
      {request.managerNote && !access.canWrite && (
        <div className="mt-4 max-w-md">
          <p className="text-sm font-medium">Manager&apos;s note</p>
          <p className="mt-1 text-sm whitespace-pre-wrap">
            {request.managerNote}
          </p>
        </div>
      )}

      {access.canWrite && (
        <div className="mt-6">
          <DecisionForm
            id={request.id}
            status={request.status}
            initialNote={request.managerNote}
          />
        </div>
      )}

      <div className="mt-8 max-w-xl">
        <h2 className="mb-3 text-sm font-semibold">History</h2>
        <ActivityTimeline entries={history} />
      </div>
    </div>
  );
}
