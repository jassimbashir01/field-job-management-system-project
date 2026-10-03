import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { jobRecurrences, jobs } from "@/db/schema";
import { logActivity } from "@/lib/activity-log";
import { ConflictError } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth/session";

type IntervalUnit = "day" | "week" | "month";
type Recurrence = typeof jobRecurrences.$inferSelect;

function addInterval(
  dateStr: string,
  unit: IntervalUnit,
  count: number,
): string {
  const segments = dateStr.split("-");
  const year = Number(segments[0]);
  const month = Number(segments[1]);
  const day = Number(segments[2]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (unit === "day") {
    date.setUTCDate(date.getUTCDate() + count);
  } else if (unit === "week") {
    date.setUTCDate(date.getUTCDate() + count * 7);
  } else {
    date.setUTCMonth(date.getUTCMonth() + count);
  }
  return date.toISOString().slice(0, 10);
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  while (current && typeof current === "object") {
    if ("code" in current && (current as { code?: string }).code === "23505") {
      return true;
    }
    const cause = (current as { cause?: unknown }).cause;
    if (cause === current) break;
    current = cause;
  }
  return false;
}

async function generateOneOccurrence(
  recurrence: Recurrence,
  occurrenceDate: string,
  actor: SessionUser,
): Promise<void> {
  const db = getDb();
  try {
    await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(jobs)
        .values({
          customerId: recurrence.customerId,
          siteId: recurrence.siteId,
          oneOffLocation: recurrence.siteId ? null : recurrence.oneOffLocation,
          assignedToUserId: recurrence.assignedToUserId,
          title: recurrence.title,
          jobType: recurrence.jobType,
          description: recurrence.description,
          reference: recurrence.reference,
          scheduledDate: occurrenceDate,
          scheduledTime: recurrence.scheduledTime,
          recurrenceId: recurrence.id,
          occurrenceDate,
        })
        .returning();

      if (!created) {
        throw new ConflictError("Insert did not return the generated job row");
      }

      await logActivity({
        entityType: "job",
        entityId: created.id,
        action: "created",
        actor,
        summary: `auto-generated from the recurring schedule "${recurrence.title}"`,
        tx,
      });

      await tx
        .update(jobRecurrences)
        .set({ lastGeneratedDate: occurrenceDate, updatedAt: new Date() })
        .where(eq(jobRecurrences.id, recurrence.id));
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      await db
        .update(jobRecurrences)
        .set({ lastGeneratedDate: occurrenceDate })
        .where(eq(jobRecurrences.id, recurrence.id));
      return;
    }
    throw error;
  }
}

async function generateDueOccurrences(
  recurrence: Recurrence,
  today: string,
  actor: SessionUser,
): Promise<void> {
  let nextDate = recurrence.lastGeneratedDate
    ? addInterval(
        recurrence.lastGeneratedDate,
        recurrence.intervalUnit,
        recurrence.intervalCount,
      )
    : recurrence.startDate;

  while (
    nextDate <= today &&
    (!recurrence.endDate || nextDate <= recurrence.endDate)
  ) {
    await generateOneOccurrence(recurrence, nextDate, actor);
    nextDate = addInterval(
      nextDate,
      recurrence.intervalUnit,
      recurrence.intervalCount,
    );
  }
}

export async function ensureRecurringJobsGenerated(
  actor: SessionUser,
): Promise<void> {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  const activeRecurrences = await db
    .select()
    .from(jobRecurrences)
    .where(eq(jobRecurrences.active, true));

  for (const recurrence of activeRecurrences) {
    await generateDueOccurrences(recurrence, today, actor);
  }
}
