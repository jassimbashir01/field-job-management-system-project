"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import * as z from "zod";
import { getDb } from "@/db";
import { companies, punches, users } from "@/db/schema";
import { logActivity } from "@/lib/activity-log";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-catalog";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  toSafeError,
  type SafeError,
} from "@/lib/errors";
import {
  MAX_PUNCH_HOURS,
  durationMinutes,
  exceedsMaxLength,
  formatDuration,
  punchesOverlap,
} from "@/lib/punch";
import { getPunchSettings } from "@/lib/punch-data";
import { fromLocalInput, localDateOf, localTimeOf } from "@/lib/punch-time";

export interface PunchAdminResult {
  success: boolean;
  error: SafeError | null;
  message: string | null;
}

const ok = (message: string | null = null): PunchAdminResult => ({
  success: true,
  error: null,
  message,
});
const fail = (error: unknown): PunchAdminResult => ({
  success: false,
  error: toSafeError(error),
  message: null,
});

const reasonSchema = z
  .string()
  .trim()
  .min(3, "Say why you're changing this (at least a few words).")
  .max(300, "Keep the reason under 300 characters.");

const localInput = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Enter a valid date and time.");

const addSchema = z.object({
  userId: z.uuid(),
  punchedIn: localInput,
  punchedOut: localInput,
  reason: reasonSchema,
});

const editSchema = z.object({
  id: z.uuid(),
  punchedIn: localInput,
  punchedOut: z.union([localInput, z.literal("")]),
  reason: reasonSchema,
});

const deleteSchema = z.object({ id: z.uuid(), reason: reasonSchema });

function stamp(instant: Date, timeZone: string): string {
  return `${localDateOf(instant, timeZone)} ${localTimeOf(instant, timeZone)}`;
}

async function assertNoOverlap(
  userId: string,
  punchedIn: Date,
  punchedOut: Date | null,
  excludeId?: string,
): Promise<void> {
  const others = await getDb()
    .select({
      id: punches.id,
      inAt: punches.punchedInAt,
      outAt: punches.punchedOutAt,
    })
    .from(punches)
    .where(
      and(
        eq(punches.userId, userId),
        ...(excludeId ? [ne(punches.id, excludeId)] : []),
      ),
    );
  if (
    others.some((o) => punchesOverlap(punchedIn, punchedOut, o.inAt, o.outAt))
  ) {
    throw new ConflictError("That overlaps another punch for the same person.");
  }
}

export async function addPunchAction(input: {
  userId: string;
  punchedIn: string;
  punchedOut: string;
  reason: string;
}): Promise<PunchAdminResult> {
  try {
    const viewer = await requirePermission(PERMISSIONS.PUNCH_WRITE);
    const parsed = addSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues[0]?.message ?? "Check the punch details.",
      );
    }
    const data = parsed.data;
    const settings = await getPunchSettings();

    const inAt = fromLocalInput(data.punchedIn, settings.timeZone);
    const outAt = fromLocalInput(data.punchedOut, settings.timeZone);
    if (!inAt || !outAt)
      throw new ValidationError("Enter a valid date and time.");
    if (outAt <= inAt)
      throw new ValidationError("Punch-out must be after punch-in.");
    if (exceedsMaxLength(inAt, outAt)) {
      throw new ValidationError(
        `A single punch can't be longer than ${MAX_PUNCH_HOURS} hours.`,
      );
    }
    if (outAt > new Date())
      throw new ValidationError("Punch-out can't be in the future.");

    const db = getDb();
    const [person] = await db
      .select({ displayName: users.displayName, role: users.role })
      .from(users)
      .where(eq(users.id, data.userId))
      .limit(1);
    if (!person || person.role !== "team_member") {
      throw new ValidationError("Punches can only be added for team members.");
    }
    await assertNoOverlap(data.userId, inAt, outAt);

    await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(punches)
        .values({
          userId: data.userId,
          punchedInAt: inAt,
          punchedOutAt: outAt,
          source: "manager",
          editedAt: new Date(),
          editedByUserId: viewer.id,
          editReason: data.reason,
        })
        .returning({ id: punches.id });
      if (created) {
        await logActivity({
          tx,
          entityType: "punch",
          entityId: created.id,
          action: "added_by_manager",
          actor: viewer,
          summary: `added a punch for ${person.displayName}: ${stamp(inAt, settings.timeZone)} to ${stamp(outAt, settings.timeZone)} (${formatDuration(durationMinutes(inAt, outAt, outAt))}). Reason: ${data.reason}`,
          metadata: {
            userId: data.userId,
            punchedIn: inAt.toISOString(),
            punchedOut: outAt.toISOString(),
            reason: data.reason,
          },
        });
      }
    });

    revalidatePath("/punch");
    revalidatePath(`/punch/${data.userId}`);
    return ok("Punch added.");
  } catch (error) {
    return fail(error);
  }
}

export async function editPunchAction(input: {
  id: string;
  punchedIn: string;
  punchedOut: string;
  reason: string;
}): Promise<PunchAdminResult> {
  try {
    const viewer = await requirePermission(PERMISSIONS.PUNCH_WRITE);
    const parsed = editSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues[0]?.message ?? "Check the punch details.",
      );
    }
    const data = parsed.data;
    const settings = await getPunchSettings();

    const inAt = fromLocalInput(data.punchedIn, settings.timeZone);
    const outAt = data.punchedOut
      ? fromLocalInput(data.punchedOut, settings.timeZone)
      : null;
    if (!inAt || (data.punchedOut && !outAt))
      throw new ValidationError("Enter a valid date and time.");
    if (outAt) {
      if (outAt <= inAt)
        throw new ValidationError("Punch-out must be after punch-in.");
      if (exceedsMaxLength(inAt, outAt)) {
        throw new ValidationError(
          `A single punch can't be longer than ${MAX_PUNCH_HOURS} hours.`,
        );
      }
      if (outAt > new Date())
        throw new ValidationError("Punch-out can't be in the future.");
    } else if (inAt > new Date()) {
      throw new ValidationError("Punch-in can't be in the future.");
    }

    const db = getDb();
    const [existing] = await db
      .select()
      .from(punches)
      .where(eq(punches.id, data.id))
      .limit(1);
    if (!existing) throw new NotFoundError("That punch no longer exists.");
    await assertNoOverlap(existing.userId, inAt, outAt, existing.id);

    const [person] = await db
      .select({ displayName: users.displayName })
      .from(users)
      .where(eq(users.id, existing.userId))
      .limit(1);

    const unchanged =
      existing.punchedInAt.getTime() === inAt.getTime() &&
      (existing.punchedOutAt?.getTime() ?? null) === (outAt?.getTime() ?? null);
    if (unchanged)
      throw new ConflictError("Nothing changed: the times are the same.");

    const now = new Date();
    const before = `${stamp(existing.punchedInAt, settings.timeZone)} to ${existing.punchedOutAt ? stamp(existing.punchedOutAt, settings.timeZone) : "still in"}`;
    const after = `${stamp(inAt, settings.timeZone)} to ${outAt ? stamp(outAt, settings.timeZone) : "still in"}`;

    await db.transaction(async (tx) => {
      await tx
        .update(punches)
        .set({
          punchedInAt: inAt,
          punchedOutAt: outAt,
          editedAt: now,
          editedByUserId: viewer.id,
          editReason: data.reason,
          updatedAt: now,
        })
        .where(eq(punches.id, existing.id));
      await logActivity({
        tx,
        entityType: "punch",
        entityId: existing.id,
        action: "edited",
        actor: viewer,
        summary: `changed ${person?.displayName ?? "a team member"}'s punch from ${before} to ${after}. Reason: ${data.reason}`,
        metadata: {
          userId: existing.userId,
          before: {
            punchedIn: existing.punchedInAt.toISOString(),
            punchedOut: existing.punchedOutAt?.toISOString() ?? null,
          },
          after: {
            punchedIn: inAt.toISOString(),
            punchedOut: outAt?.toISOString() ?? null,
          },
          reason: data.reason,
        },
      });
    });

    revalidatePath("/punch");
    revalidatePath(`/punch/${existing.userId}`);
    return ok("Punch updated.");
  } catch (error) {
    return fail(error);
  }
}

export async function deletePunchAction(input: {
  id: string;
  reason: string;
}): Promise<PunchAdminResult> {
  try {
    const viewer = await requirePermission(PERMISSIONS.PUNCH_WRITE);
    const parsed = deleteSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues[0]?.message ?? "Say why you're deleting this.",
      );
    }
    const data = parsed.data;
    const settings = await getPunchSettings();

    const db = getDb();
    const [existing] = await db
      .select()
      .from(punches)
      .where(eq(punches.id, data.id))
      .limit(1);
    if (!existing) throw new NotFoundError("That punch no longer exists.");
    const [person] = await db
      .select({ displayName: users.displayName })
      .from(users)
      .where(eq(users.id, existing.userId))
      .limit(1);

    await db.transaction(async (tx) => {
      await tx.delete(punches).where(eq(punches.id, existing.id));
      await logActivity({
        tx,
        entityType: "punch",
        entityId: existing.id,
        action: "deleted",
        actor: viewer,
        summary: `deleted ${person?.displayName ?? "a team member"}'s punch (${stamp(existing.punchedInAt, settings.timeZone)} to ${existing.punchedOutAt ? stamp(existing.punchedOutAt, settings.timeZone) : "still in"}). Reason: ${data.reason}`,
        metadata: {
          userId: existing.userId,
          punchedIn: existing.punchedInAt.toISOString(),
          punchedOut: existing.punchedOutAt?.toISOString() ?? null,
          reason: data.reason,
        },
      });
    });

    revalidatePath("/punch");
    revalidatePath(`/punch/${existing.userId}`);
    return ok("Punch deleted.");
  } catch (error) {
    return fail(error);
  }
}

export async function setPunchLocationAction(
  enabled: boolean,
): Promise<PunchAdminResult> {
  try {
    const viewer = await requirePermission(PERMISSIONS.PUNCH_WRITE);
    if (viewer.role !== "admin")
      throw new ForbiddenError("Only an administrator can change this.");
    if (typeof enabled !== "boolean")
      throw new ValidationError("Choose on or off.");

    const settings = await getPunchSettings();
    if (!settings.companyId)
      throw new NotFoundError("Company settings weren't found.");
    if (settings.locationEnabled === enabled) return ok("No change.");

    await getDb().transaction(async (tx) => {
      await tx
        .update(companies)
        .set({ punchLocationEnabled: enabled, updatedAt: new Date() })
        .where(eq(companies.id, settings.companyId as string));
      await logActivity({
        tx,
        entityType: "company",
        entityId: settings.companyId as string,
        action: "punch_location_changed",
        actor: viewer,
        summary: `${enabled ? "turned on" : "turned off"} location capture for punches`,
      });
    });

    revalidatePath("/punch");
    revalidatePath("/mobile");
    return ok(enabled ? "Location capture is on." : "Location capture is off.");
  } catch (error) {
    return fail(error);
  }
}
