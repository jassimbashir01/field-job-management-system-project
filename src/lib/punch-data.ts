import { and, asc, desc, eq, gte, isNull, lte, max, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  activityLogEntries,
  companies,
  jobs,
  punches,
  users,
} from "@/db/schema";
import type { ActivityLogEntry } from "@/lib/activity-log";
import { localDateOf, localTimeOf, toLocalInput } from "@/lib/punch-time";
import { durationMinutes } from "@/lib/punch";
import { addDays } from "@/lib/week";

export interface PunchSettings {
  companyId: string | null;
  timeZone: string;
  locationEnabled: boolean;
}

export async function getPunchSettings(): Promise<PunchSettings> {
  const [company] = await getDb()
    .select({
      id: companies.id,
      timezone: companies.timezone,
      punchLocationEnabled: companies.punchLocationEnabled,
    })
    .from(companies)
    .limit(1);
  return {
    companyId: company?.id ?? null,
    timeZone: company?.timezone ?? "UTC",
    locationEnabled: company?.punchLocationEnabled ?? false,
  };
}

export interface PunchView {
  id: string;
  date: string;
  inTime: string;
  outTime: string | null;
  outDate: string | null;
  inInput: string;
  outInput: string | null;
  minutes: number;
  open: boolean;
  source: "self" | "manager";
  edited: boolean;
  editReason: string | null;
  inLocation: {
    status: "not_requested" | "captured" | "unavailable";
    lat: number | null;
    lng: number | null;
  };
  outLocation: {
    status: "not_requested" | "captured" | "unavailable";
    lat: number | null;
    lng: number | null;
  };
  punchedInAt: Date;
}

export async function listPunches(
  userId: string,
  fromDate: string,
  toDate: string,
  timeZone: string,
  now: Date,
): Promise<PunchView[]> {
  const windowStart = new Date(`${addDays(fromDate, -1)}T00:00:00Z`);
  const windowEnd = new Date(`${addDays(toDate, 2)}T00:00:00Z`);
  const rows = await getDb()
    .select()
    .from(punches)
    .where(
      and(
        eq(punches.userId, userId),
        gte(punches.punchedInAt, windowStart),
        lte(punches.punchedInAt, windowEnd),
      ),
    )
    .orderBy(asc(punches.punchedInAt));

  return rows
    .map((row): PunchView => {
      const date = localDateOf(row.punchedInAt, timeZone);
      const outDate = row.punchedOutAt
        ? localDateOf(row.punchedOutAt, timeZone)
        : null;
      return {
        id: row.id,
        date,
        inTime: localTimeOf(row.punchedInAt, timeZone),
        outTime: row.punchedOutAt
          ? localTimeOf(row.punchedOutAt, timeZone)
          : null,
        outDate: outDate && outDate !== date ? outDate : null,
        inInput: toLocalInput(row.punchedInAt, timeZone),
        outInput: row.punchedOutAt
          ? toLocalInput(row.punchedOutAt, timeZone)
          : null,
        minutes: durationMinutes(row.punchedInAt, row.punchedOutAt, now),
        open: row.punchedOutAt === null,
        source: row.source,
        edited: row.editedAt !== null,
        editReason: row.editReason,
        inLocation: {
          status: row.inLocationStatus,
          lat: row.inLatitude,
          lng: row.inLongitude,
        },
        outLocation: {
          status: row.outLocationStatus,
          lat: row.outLatitude,
          lng: row.outLongitude,
        },
        punchedInAt: row.punchedInAt,
      };
    })
    .filter((view) => view.date >= fromDate && view.date <= toDate);
}

export async function getOpenPunch(
  userId: string,
  timeZone: string,
): Promise<{
  id: string;
  punchedInAt: Date;
  inTime: string;
  date: string;
} | null> {
  const [row] = await getDb()
    .select({ id: punches.id, punchedInAt: punches.punchedInAt })
    .from(punches)
    .where(and(eq(punches.userId, userId), isNull(punches.punchedOutAt)))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    punchedInAt: row.punchedInAt,
    inTime: localTimeOf(row.punchedInAt, timeZone),
    date: localDateOf(row.punchedInAt, timeZone),
  };
}

export interface CompletedJob {
  id: string;
  jobNumber: number;
  title: string;
  completedOn: string;
}

export async function listCompletedJobs(
  userId: string,
  fromDate: string,
  toDate: string,
  timeZone: string,
): Promise<CompletedJob[]> {
  const windowStart = new Date(`${addDays(fromDate, -1)}T00:00:00Z`);
  const windowEnd = new Date(`${addDays(toDate, 2)}T00:00:00Z`);
  const completedAt = max(activityLogEntries.createdAt);
  const rows = await getDb()
    .select({
      id: jobs.id,
      jobNumber: jobs.jobNumber,
      title: jobs.title,
      completedAt,
    })
    .from(jobs)
    .innerJoin(
      activityLogEntries,
      and(
        eq(activityLogEntries.entityType, "job"),
        eq(activityLogEntries.entityId, jobs.id),
        eq(activityLogEntries.action, "status_changed"),
        sql`${activityLogEntries.metadata}->>'to' = 'completed'`,
      ),
    )
    .where(and(eq(jobs.assignedToUserId, userId), eq(jobs.status, "completed")))
    .groupBy(jobs.id, jobs.jobNumber, jobs.title)
    .having(
      and(
        sql`${completedAt} >= ${windowStart.toISOString()}::timestamptz`,
        sql`${completedAt} <= ${windowEnd.toISOString()}::timestamptz`,
      ),
    );

  return rows
    .flatMap((row) =>
      row.completedAt
        ? [
            {
              id: row.id,
              jobNumber: row.jobNumber,
              title: row.title,
              completedOn: localDateOf(row.completedAt, timeZone),
            },
          ]
        : [],
    )
    .filter((job) => job.completedOn >= fromDate && job.completedOn <= toDate)
    .sort(
      (a, b) =>
        a.completedOn.localeCompare(b.completedOn) || a.jobNumber - b.jobNumber,
    );
}

export async function listPunchHistory(
  userId: string,
  limit = 40,
): Promise<ActivityLogEntry[]> {
  return getDb()
    .select({
      id: activityLogEntries.id,
      action: activityLogEntries.action,
      actorDisplayName: activityLogEntries.actorDisplayName,
      summary: activityLogEntries.summary,
      metadata: activityLogEntries.metadata,
      createdAt: activityLogEntries.createdAt,
    })
    .from(activityLogEntries)
    .where(
      and(
        eq(activityLogEntries.entityType, "punch"),
        sql`${activityLogEntries.metadata}->>'userId' = ${userId}`,
      ),
    )
    .orderBy(desc(activityLogEntries.createdAt))
    .limit(limit);
}

export async function getTeamMemberName(
  userId: string,
): Promise<string | null> {
  const [row] = await getDb()
    .select({ displayName: users.displayName, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row && row.role === "team_member" ? row.displayName : null;
}
