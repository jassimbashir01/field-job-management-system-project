"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, gte, lte, ne } from "drizzle-orm";
import * as z from "zod";
import { getDb } from "@/db";
import { holidayRequests, shifts, users } from "@/db/schema";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-catalog";
import { logActivity } from "@/lib/activity-log";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  toSafeError,
  type SafeError,
} from "@/lib/errors";
import { logger } from "@/lib/logger";
import { renderHolidayDecisionEmail } from "@/lib/holiday-email";
import {
  MAX_HOLIDAY_DAYS,
  daysInclusive,
  formatDateRange,
} from "@/lib/holidays";
import { loadBranding } from "@/lib/pdf/load-document";

export interface HolidayResult {
  success: boolean;
  error: SafeError | null;
  message: string | null;
  id: string | null;
}

const ENTITY = "holiday_request";

const clip = (text: string, max = 120) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

const ok = (
  message: string | null = null,
  id: string | null = null,
): HolidayResult => ({
  success: true,
  error: null,
  message,
  id,
});
const fail = (error: unknown): HolidayResult => ({
  success: false,
  error: toSafeError(error),
  message: null,
  id: null,
});

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date.");

const createSchema = z.object({
  userId: z.uuid("Choose a team member."),
  startDate: dateString,
  endDate: z.union([dateString, z.literal("")]).optional(),
  note: z.string().max(500, "Keep the note under 500 characters.").optional(),
});

export interface CreateHolidayInput {
  userId: string;
  startDate: string;
  endDate?: string;
  note?: string;
}

async function hasOverlappingRequest(
  userId: string,
  start: string,
  end: string,
  statuses: Array<"sent" | "viewed" | "accepted">,
  excludeId?: string,
): Promise<boolean> {
  const rows = await getDb()
    .select({ id: holidayRequests.id, status: holidayRequests.status })
    .from(holidayRequests)
    .where(
      and(
        eq(holidayRequests.userId, userId),
        lte(holidayRequests.startDate, end),
        gte(holidayRequests.endDate, start),
        ne(holidayRequests.status, "rejected"),
        ...(excludeId ? [ne(holidayRequests.id, excludeId)] : []),
      ),
    );
  return rows.some((row) => (statuses as string[]).includes(row.status));
}

export async function createHolidayAction(
  input: CreateHolidayInput,
): Promise<HolidayResult> {
  try {
    const viewer = await requirePermission(PERMISSIONS.HOLIDAYS_WRITE);

    const parsed = createSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues[0]?.message ?? "Check the request details.",
      );
    }
    const data = parsed.data;
    const endDate = data.endDate ? data.endDate : data.startDate;

    const length = daysInclusive(data.startDate, endDate);
    if (length < 1)
      throw new ValidationError("The last day can't be before the first day.");
    if (length > MAX_HOLIDAY_DAYS) {
      throw new ValidationError(
        `A single request can cover at most ${MAX_HOLIDAY_DAYS} days.`,
      );
    }

    const db = getDb();
    const [person] = await db
      .select({
        id: users.id,
        role: users.role,
        isActive: users.isActive,
        displayName: users.displayName,
      })
      .from(users)
      .where(eq(users.id, data.userId))
      .limit(1);
    if (!person || person.role !== "team_member" || !person.isActive) {
      throw new ValidationError(
        "Holiday requests can only be recorded for active team members.",
      );
    }

    if (
      await hasOverlappingRequest(data.userId, data.startDate, endDate, [
        "sent",
        "viewed",
      ])
    ) {
      throw new ConflictError(
        "This person already has a request waiting for a decision that covers some of those days.",
      );
    }

    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(holidayRequests)
        .values({
          userId: data.userId,
          startDate: data.startDate,
          endDate,
          note: data.note?.trim() ? data.note.trim() : null,
          status: "sent",
          createdByUserId: viewer.id,
        })
        .returning({ id: holidayRequests.id });
      if (row) {
        await logActivity({
          tx,
          entityType: ENTITY,
          entityId: row.id,
          action: "created",
          actor: viewer,
          summary: `recorded a holiday request for ${person.displayName}: ${formatDateRange(data.startDate, endDate)} (${length} day${length === 1 ? "" : "s"})`,
          metadata: { userId: data.userId, startDate: data.startDate, endDate },
        });
      }
      return row;
    });

    revalidatePath("/holidays");
    return ok("Request recorded.", created?.id ?? null);
  } catch (error) {
    return fail(error);
  }
}

const decideSchema = z.object({
  id: z.uuid(),
  decision: z.enum(["accepted", "rejected"]),
  managerNote: z
    .string()
    .max(500, "Keep the note under 500 characters.")
    .optional(),
});

export interface DecideHolidayInput {
  id: string;
  decision: "accepted" | "rejected";
  managerNote?: string;
}

export async function decideHolidayAction(
  input: DecideHolidayInput,
): Promise<HolidayResult> {
  try {
    const viewer = await requirePermission(PERMISSIONS.HOLIDAYS_WRITE);

    const parsed = decideSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues[0]?.message ?? "Check the decision.",
      );
    }
    const data = parsed.data;
    const managerNote = data.managerNote?.trim()
      ? data.managerNote.trim()
      : null;

    const db = getDb();
    const [request] = await db
      .select()
      .from(holidayRequests)
      .where(eq(holidayRequests.id, data.id))
      .limit(1);
    if (!request) throw new NotFoundError("That request no longer exists.");

    if (
      request.status === data.decision &&
      (request.managerNote ?? null) === managerNote
    ) {
      throw new ConflictError(
        `This request is already ${data.decision}. Change the note, or choose the other decision.`,
      );
    }

    if (
      data.decision === "accepted" &&
      (await hasOverlappingRequest(
        request.userId,
        request.startDate,
        request.endDate,
        ["accepted"],
        request.id,
      ))
    ) {
      throw new ConflictError(
        "Another accepted holiday already covers some of these days.",
      );
    }

    const [person] = await db
      .select({ displayName: users.displayName, email: users.email })
      .from(users)
      .where(eq(users.id, request.userId))
      .limit(1);
    const name = person?.displayName ?? "a team member";
    const range = formatDateRange(request.startDate, request.endDate);

    const previous = request.status;
    const wasDecided = previous === "accepted" || previous === "rejected";
    const noteText = managerNote ? ` with the note “${clip(managerNote)}”` : "";
    let action: string;
    let summary: string;
    if (!wasDecided) {
      action = data.decision;
      summary = `${data.decision} ${name}'s request (${range})${noteText}`;
    } else if (previous === data.decision) {
      action = "note_updated";
      summary = `updated the note on ${name}'s ${data.decision} request (${range})${noteText}`;
    } else {
      action = data.decision;
      summary = `changed ${name}'s request (${range}) from ${previous} to ${data.decision}${noteText}`;
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(holidayRequests)
        .set({
          status: data.decision,
          managerNote,
          decidedAt: now,
          decidedByUserId: viewer.id,
          viewedAt: request.viewedAt ?? now,
          viewedByUserId: request.viewedByUserId ?? viewer.id,
          updatedAt: now,
        })
        .where(eq(holidayRequests.id, request.id));
      await logActivity({
        tx,
        entityType: ENTITY,
        entityId: request.id,
        action,
        actor: viewer,
        summary,
        metadata: {
          from: previous,
          to: data.decision,
          managerNote,
          previousNote: request.managerNote,
        },
      });
    });

    let shiftWarning = "";
    if (data.decision === "accepted") {
      const [row] = await db
        .select({ n: count() })
        .from(shifts)
        .where(
          and(
            eq(shifts.userId, request.userId),
            gte(shifts.shiftDate, request.startDate),
            lte(shifts.shiftDate, request.endDate),
            ne(shifts.status, "cancelled"),
          ),
        );
      const n = row?.n ?? 0;
      if (n > 0) {
        shiftWarning = ` ${n} existing shift${n === 1 ? "" : "s"} fall${n === 1 ? "s" : ""} in these dates — review ${n === 1 ? "it" : "them"} on the Rota.`;
      }
    }

    let emailNote: string;
    let emailAction: string | null = null;
    let emailSummary = "";
    if (!person) {
      emailNote = "";
    } else if (!isEmailConfigured()) {
      emailNote =
        " Email isn't set up on this server, so they weren't emailed.";
      emailAction = "email_not_sent";
      emailSummary = `did not email ${name}: email isn't set up on this server`;
    } else {
      try {
        const { branding } = await loadBranding();
        const message = renderHolidayDecisionEmail({
          displayName: person.displayName,
          dateRange: range,
          decision: data.decision,
          managerNote,
          branding,
        });
        await sendEmail({ to: person.email, ...message });
        emailNote = " They've been emailed.";
        emailAction = "emailed";
        emailSummary = `emailed ${name} the ${data.decision} decision`;
      } catch (error) {
        logger.error("Holiday decision email failed", {
          error:
            error instanceof Error
              ? { name: error.name, message: error.message }
              : error,
        });
        emailNote = " The decision is saved but the email couldn't be sent.";
        emailAction = "email_failed";
        emailSummary = `could not email ${name} the ${data.decision} decision`;
      }
    }
    if (emailAction) {
      await logActivity({
        entityType: ENTITY,
        entityId: request.id,
        action: emailAction,
        actor: viewer,
        summary: emailSummary,
      });
    }

    revalidatePath("/holidays");
    revalidatePath(`/holidays/${request.id}`);
    revalidatePath("/rota");
    return ok(
      `${data.decision === "accepted" ? "Accepted." : "Rejected."}${emailNote}${shiftWarning}`,
    );
  } catch (error) {
    return fail(error);
  }
}

export async function deleteHolidayAction(id: string): Promise<HolidayResult> {
  try {
    const viewer = await requirePermission(PERMISSIONS.HOLIDAYS_WRITE);
    const parsed = z.uuid().safeParse(id);
    if (!parsed.success) throw new ValidationError("That request isn't valid.");

    const db = getDb();
    const [request] = await db
      .select({
        userId: holidayRequests.userId,
        startDate: holidayRequests.startDate,
        endDate: holidayRequests.endDate,
        status: holidayRequests.status,
      })
      .from(holidayRequests)
      .where(eq(holidayRequests.id, parsed.data))
      .limit(1);
    if (!request) throw new NotFoundError("That request no longer exists.");
    const [person] = await db
      .select({ displayName: users.displayName })
      .from(users)
      .where(eq(users.id, request.userId))
      .limit(1);

    await db.transaction(async (tx) => {
      await tx
        .delete(holidayRequests)
        .where(eq(holidayRequests.id, parsed.data));
      await logActivity({
        tx,
        entityType: ENTITY,
        entityId: parsed.data,
        action: "deleted",
        actor: viewer,
        summary: `deleted ${person?.displayName ?? "a team member"}'s request (${formatDateRange(request.startDate, request.endDate)}, was ${request.status})`,
        metadata: {
          status: request.status,
          startDate: request.startDate,
          endDate: request.endDate,
        },
      });
    });
    revalidatePath("/holidays");
    revalidatePath("/rota");
    return ok("Deleted.");
  } catch (error) {
    return fail(error);
  }
}
