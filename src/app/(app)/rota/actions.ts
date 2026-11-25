"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, gte, inArray, lte, ne } from "drizzle-orm";
import * as z from "zod";
import { getDb } from "@/db";
import { shifts, users } from "@/db/schema";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-catalog";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  toSafeError,
  type SafeError,
} from "@/lib/errors";
import { logger } from "@/lib/logger";
import { loadBranding } from "@/lib/pdf/load-document";
import {
  dayLabelOf,
  formatTimeRange,
  minutesOf,
  needsAnnouncing,
  normalizeTime,
  shortDateOf,
  timesOverlap,
} from "@/lib/rota";
import { renderRotaEmail, type RotaEmailShift } from "@/lib/rota-email";
import { addDays, getWeekDates } from "@/lib/week";

export interface RotaResult {
  success: boolean;
  error: SafeError | null;
  message: string | null;
}

const ok = (message: string | null = null): RotaResult => ({
  success: true,
  error: null,
  message,
});
const fail = (error: unknown): RotaResult => ({
  success: false,
  error: toSafeError(error),
  message: null,
});

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date.");

const saveSchema = z.object({
  id: z.uuid().optional(),
  userId: z.uuid(),
  date: dateString,
  startTime: z.string(),
  endTime: z.string(),
  note: z.string().max(200, "Keep the note under 200 characters.").optional(),
  repeatWeeks: z.number().int().min(1).max(12).default(1),
});

export interface SaveShiftInput {
  id?: string;
  userId: string;
  date: string;
  startTime: string;
  endTime: string;
  note?: string;
  repeatWeeks?: number;
}

async function findOverlap(
  userId: string,
  shiftDate: string,
  start: string,
  end: string,
  excludeId?: string,
): Promise<boolean> {
  const rows = await getDb()
    .select({
      id: shifts.id,
      startTime: shifts.startTime,
      endTime: shifts.endTime,
    })
    .from(shifts)
    .where(
      and(
        eq(shifts.userId, userId),
        eq(shifts.shiftDate, shiftDate),
        ne(shifts.status, "cancelled"),
        ...(excludeId ? [ne(shifts.id, excludeId)] : []),
      ),
    );
  return rows.some((row) =>
    timesOverlap(start, end, row.startTime, row.endTime),
  );
}

export async function saveShiftAction(
  input: SaveShiftInput,
): Promise<RotaResult> {
  try {
    const viewer = await requirePermission(PERMISSIONS.ROTA_WRITE);

    const parsed = saveSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues[0]?.message ?? "Check the shift details.",
      );
    }
    const data = parsed.data;

    const start = normalizeTime(data.startTime);
    const end = normalizeTime(data.endTime);
    if (!start || !end)
      throw new ValidationError("Enter a start and end time.");
    if (minutesOf(end) <= minutesOf(start)) {
      throw new ValidationError(
        "A shift must end after it starts (overnight shifts aren't supported yet).",
      );
    }

    const db = getDb();
    const [person] = await db
      .select({ id: users.id, role: users.role, isActive: users.isActive })
      .from(users)
      .where(eq(users.id, data.userId))
      .limit(1);
    if (!person || person.role !== "team_member" || !person.isActive) {
      throw new ValidationError(
        "Shifts can only be set for active team members.",
      );
    }

    const note = data.note?.trim() ? data.note.trim() : null;

    if (data.id) {
      const [existing] = await db
        .select()
        .from(shifts)
        .where(eq(shifts.id, data.id))
        .limit(1);
      if (!existing) throw new NotFoundError("That shift no longer exists.");
      if (existing.status === "cancelled") {
        throw new ConflictError("That shift has been cancelled.");
      }
      if (
        await findOverlap(existing.userId, data.date, start, end, existing.id)
      ) {
        throw new ConflictError(
          "That overlaps another shift for the same person.",
        );
      }
      await db
        .update(shifts)
        .set({
          shiftDate: data.date,
          startTime: start,
          endTime: end,
          note,
          updatedAt: new Date(),
        })
        .where(eq(shifts.id, existing.id));
      revalidatePath("/rota");
      return ok(
        existing.status === "published"
          ? "Saved. This shift is already published — use Publish week to tell the person about the change."
          : "Saved.",
      );
    }

    const created: string[] = [];
    const skipped: string[] = [];
    for (let i = 0; i < data.repeatWeeks; i++) {
      const shiftDate = addDays(data.date, 7 * i);
      if (await findOverlap(data.userId, shiftDate, start, end)) {
        skipped.push(shortDateOf(shiftDate));
        continue;
      }
      await db.insert(shifts).values({
        userId: data.userId,
        shiftDate,
        startTime: start,
        endTime: end,
        note,
        status: "draft",
        createdByUserId: viewer.id,
      });
      created.push(shiftDate);
    }

    if (created.length === 0) {
      throw new ConflictError(
        "That overlaps another shift for the same person.",
      );
    }
    revalidatePath("/rota");
    return ok(
      skipped.length > 0
        ? `Added ${created.length} shift${created.length === 1 ? "" : "s"} as drafts. Skipped ${skipped.join(", ")} because of an overlap.`
        : created.length > 1
          ? `Added ${created.length} weekly shifts as drafts.`
          : "Added as a draft.",
    );
  } catch (error) {
    return fail(error);
  }
}

export async function deleteShiftAction(id: string): Promise<RotaResult> {
  try {
    await requirePermission(PERMISSIONS.ROTA_WRITE);
    const parsed = z.uuid().safeParse(id);
    if (!parsed.success) throw new ValidationError("That shift isn't valid.");

    const db = getDb();
    const [existing] = await db
      .select()
      .from(shifts)
      .where(eq(shifts.id, parsed.data))
      .limit(1);
    if (!existing) throw new NotFoundError("That shift no longer exists.");

    if (existing.status === "published") {
      await db
        .update(shifts)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(shifts.id, existing.id));
      revalidatePath("/rota");
      return ok("Cancelled. Use Publish week to tell the person.");
    }
    await db.delete(shifts).where(eq(shifts.id, existing.id));
    revalidatePath("/rota");
    return ok("Removed.");
  } catch (error) {
    return fail(error);
  }
}

export async function copyPreviousWeekAction(
  weekStart: string,
): Promise<RotaResult> {
  try {
    await requirePermission(PERMISSIONS.ROTA_WRITE);
    const parsed = dateString.safeParse(weekStart);
    if (!parsed.success) throw new ValidationError("Choose a valid week.");

    const week = getWeekDates(parsed.data);
    const first = week[0];
    const last = week[6];
    if (!first || !last) throw new ValidationError("Choose a valid week.");
    const prevFirst = addDays(first, -7);
    const prevLast = addDays(last, -7);

    const db = getDb();
    const source = await db
      .select({
        userId: shifts.userId,
        shiftDate: shifts.shiftDate,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        note: shifts.note,
      })
      .from(shifts)
      .innerJoin(users, eq(shifts.userId, users.id))
      .where(
        and(
          gte(shifts.shiftDate, prevFirst),
          lte(shifts.shiftDate, prevLast),
          ne(shifts.status, "cancelled"),
          eq(users.isActive, true),
          eq(users.role, "team_member"),
        ),
      )
      .orderBy(asc(shifts.shiftDate), asc(shifts.startTime));

    if (source.length === 0)
      throw new ConflictError(
        "There are no shifts in the previous week to copy.",
      );

    let copied = 0;
    let skipped = 0;
    for (const row of source) {
      const shiftDate = addDays(row.shiftDate, 7);
      if (
        await findOverlap(row.userId, shiftDate, row.startTime, row.endTime)
      ) {
        skipped++;
        continue;
      }
      await db.insert(shifts).values({
        userId: row.userId,
        shiftDate,
        startTime: row.startTime,
        endTime: row.endTime,
        note: row.note,
        status: "draft",
      });
      copied++;
    }

    revalidatePath("/rota");
    if (copied === 0) {
      return ok(
        "Nothing copied: every shift from last week already exists this week.",
      );
    }
    return ok(
      `Copied ${copied} shift${copied === 1 ? "" : "s"} as drafts${skipped > 0 ? `; ${skipped} skipped (already there or overlapping)` : ""}.`,
    );
  } catch (error) {
    return fail(error);
  }
}

export async function publishWeekAction(
  weekStart: string,
): Promise<RotaResult> {
  try {
    await requirePermission(PERMISSIONS.ROTA_WRITE);
    const parsed = dateString.safeParse(weekStart);
    if (!parsed.success) throw new ValidationError("Choose a valid week.");

    const week = getWeekDates(parsed.data);
    const first = week[0];
    const last = week[6];
    if (!first || !last) throw new ValidationError("Choose a valid week.");

    const db = getDb();
    const rows = await db
      .select({
        id: shifts.id,
        userId: shifts.userId,
        shiftDate: shifts.shiftDate,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        note: shifts.note,
        status: shifts.status,
        notifiedAt: shifts.notifiedAt,
        updatedAt: shifts.updatedAt,
      })
      .from(shifts)
      .where(and(gte(shifts.shiftDate, first), lte(shifts.shiftDate, last)))
      .orderBy(asc(shifts.shiftDate), asc(shifts.startTime));

    const pending = rows.filter(needsAnnouncing);
    if (pending.length === 0)
      throw new ConflictError("There's nothing new to publish for this week.");
    const affectedUserIds = [...new Set(pending.map((row) => row.userId))];

    const now = new Date();
    await db.transaction(async (tx) => {
      const draftIds = rows
        .filter((r) => r.status === "draft")
        .map((r) => r.id);
      if (draftIds.length > 0) {
        await tx
          .update(shifts)
          .set({ status: "published" })
          .where(inArray(shifts.id, draftIds));
      }
      const liveIds = rows
        .filter((r) => r.status !== "cancelled")
        .map((r) => r.id);
      if (liveIds.length > 0) {
        await tx
          .update(shifts)
          .set({ notifiedAt: now })
          .where(inArray(shifts.id, liveIds));
      }
      const cancelledIds = rows
        .filter((r) => r.status === "cancelled")
        .map((r) => r.id);
      if (cancelledIds.length > 0) {
        await tx.delete(shifts).where(inArray(shifts.id, cancelledIds));
      }
    });

    const people = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        email: users.email,
      })
      .from(users)
      .where(inArray(users.id, affectedUserIds));

    let emailed = 0;
    let notEmailed = 0;
    if (!isEmailConfigured()) {
      notEmailed = people.length;
    } else {
      const { branding } = await loadBranding();
      const weekLabel = `${shortDateOf(first)} – ${shortDateOf(last)}`;
      const toLine = (r: (typeof rows)[number]): RotaEmailShift => ({
        dayLabel: dayLabelOf(r.shiftDate),
        timeRange: formatTimeRange(r.startTime, r.endTime),
        note: r.note,
      });
      const results = await Promise.allSettled(
        people.map(async (person) => {
          const mine = rows.filter((r) => r.userId === person.id);
          const message = renderRotaEmail({
            displayName: person.displayName,
            weekLabel,
            shifts: mine.filter((r) => r.status !== "cancelled").map(toLine),
            cancelled: mine.filter((r) => r.status === "cancelled").map(toLine),
            branding,
          });
          await sendEmail({ to: person.email, ...message });
        }),
      );
      for (const result of results) {
        if (result.status === "fulfilled") emailed++;
        else {
          notEmailed++;
          logger.error("Rota email failed", {
            error:
              result.reason instanceof Error
                ? { name: result.reason.name, message: result.reason.message }
                : result.reason,
          });
        }
      }
    }

    revalidatePath("/rota");
    const published = `Published. ${affectedUserIds.length} ${affectedUserIds.length === 1 ? "person" : "people"} affected`;
    if (notEmailed === 0) return ok(`${published}; all emailed.`);
    if (emailed === 0 && !isEmailConfigured()) {
      return ok(
        `${published}. Email isn't set up on this server, so nobody was emailed.`,
      );
    }
    return ok(
      `${published}; ${emailed} emailed, ${notEmailed} could not be emailed.`,
    );
  } catch (error) {
    return fail(error);
  }
}
