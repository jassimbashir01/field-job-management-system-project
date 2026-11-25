"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import * as z from "zod";
import { getDb } from "@/db";
import { punches } from "@/db/schema";
import { logActivity } from "@/lib/activity-log";
import { requireUserOrThrow } from "@/lib/auth/guards";
import {
  ConflictError,
  ForbiddenError,
  toSafeError,
  type SafeError,
} from "@/lib/errors";
import { MAX_PUNCH_HOURS, exceedsMaxLength } from "@/lib/punch";
import { getPunchSettings } from "@/lib/punch-data";
import { localTimeOf } from "@/lib/punch-time";

export interface PunchResult {
  success: boolean;
  error: SafeError | null;
  message: string | null;
}

const ok = (message: string): PunchResult => ({
  success: true,
  error: null,
  message,
});
const fail = (error: unknown): PunchResult => ({
  success: false,
  error: toSafeError(error),
  message: null,
});

const locationSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracyMeters: z.number().min(0).max(1_000_000).optional(),
  })
  .nullable()
  .optional();

export interface PunchInput {
  location?: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
  } | null;
}

function resolveLocation(enabled: boolean, input: PunchInput) {
  if (!enabled) {
    return {
      status: "not_requested" as const,
      latitude: null,
      longitude: null,
      accuracy: null,
    };
  }
  const parsed = locationSchema.safeParse(input.location);
  const loc = parsed.success ? parsed.data : null;
  if (!loc) {
    return {
      status: "unavailable" as const,
      latitude: null,
      longitude: null,
      accuracy: null,
    };
  }
  return {
    status: "captured" as const,
    latitude: loc.latitude,
    longitude: loc.longitude,
    accuracy: loc.accuracyMeters ?? null,
  };
}

async function requireStaff() {
  const viewer = await requireUserOrThrow();
  if (viewer.role !== "team_member") {
    throw new ForbiddenError("Only team members punch in and out.");
  }
  return viewer;
}

export async function punchInAction(input: PunchInput): Promise<PunchResult> {
  try {
    const viewer = await requireStaff();
    const settings = await getPunchSettings();
    const location = resolveLocation(settings.locationEnabled, input);
    const now = new Date();

    const db = getDb();
    try {
      await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(punches)
          .values({
            userId: viewer.id,
            punchedInAt: now,
            inLocationStatus: location.status,
            inLatitude: location.latitude,
            inLongitude: location.longitude,
            inAccuracyMeters: location.accuracy,
            source: "self",
          })
          .returning({ id: punches.id });
        if (created) {
          await logActivity({
            tx,
            entityType: "punch",
            entityId: created.id,
            action: "punched_in",
            actor: viewer,
            summary: `punched in at ${localTimeOf(now, settings.timeZone)}${location.status === "unavailable" ? " (location unavailable)" : ""}`,
            metadata: { userId: viewer.id, locationStatus: location.status },
          });
        }
      });
    } catch (error) {
      const code =
        (error as { code?: string; cause?: { code?: string } })?.code ??
        (error as { cause?: { code?: string } })?.cause?.code;
      if (code === "23505")
        throw new ConflictError("You're already punched in.");
      throw error;
    }

    revalidatePath("/mobile");
    revalidatePath("/punch");
    return ok(`Punched in at ${localTimeOf(now, settings.timeZone)}.`);
  } catch (error) {
    return fail(error);
  }
}

export async function punchOutAction(input: PunchInput): Promise<PunchResult> {
  try {
    const viewer = await requireStaff();
    const settings = await getPunchSettings();
    const location = resolveLocation(settings.locationEnabled, input);
    const now = new Date();

    const db = getDb();
    const [open] = await db
      .select()
      .from(punches)
      .where(and(eq(punches.userId, viewer.id), isNull(punches.punchedOutAt)))
      .limit(1);
    if (!open) throw new ConflictError("You're not punched in.");

    if (exceedsMaxLength(open.punchedInAt, now)) {
      throw new ConflictError(
        `This punch has been open for more than ${MAX_PUNCH_HOURS} hours. Ask your manager to correct it.`,
      );
    }

    const closed = await db.transaction(async (tx) => {
      const rows = await tx
        .update(punches)
        .set({
          punchedOutAt: now,
          outLocationStatus: location.status,
          outLatitude: location.latitude,
          outLongitude: location.longitude,
          outAccuracyMeters: location.accuracy,
          updatedAt: now,
        })
        // Guard against a double tap closing it twice.
        .where(and(eq(punches.id, open.id), isNull(punches.punchedOutAt)))
        .returning({ id: punches.id });
      if (rows.length === 0) return false;
      await logActivity({
        tx,
        entityType: "punch",
        entityId: open.id,
        action: "punched_out",
        actor: viewer,
        summary: `punched out at ${localTimeOf(now, settings.timeZone)}${location.status === "unavailable" ? " (location unavailable)" : ""}`,
        metadata: { userId: viewer.id, locationStatus: location.status },
      });
      return true;
    });
    if (!closed) throw new ConflictError("You're not punched in.");

    revalidatePath("/mobile");
    revalidatePath("/punch");
    return ok(`Punched out at ${localTimeOf(now, settings.timeZone)}.`);
  } catch (error) {
    return fail(error);
  }
}
