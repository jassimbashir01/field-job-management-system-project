"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { notificationPreferences, notifications } from "@/db/schema";
import { requireUser, requireUserOrThrow } from "@/lib/auth/guards";
import { getUserAccessLevels } from "@/lib/auth/permissions";
import { toSafeError, type SafeError } from "@/lib/errors";
import { NOTIFICATION_CATEGORIES } from "@/lib/notification-categories";
import type { NotificationSnapshot } from "@/lib/notification-types";
import { getNotificationSnapshot } from "@/lib/notifications";
import { isUuid } from "@/lib/uuid";

export interface PreferencesState {
  success: boolean;
  error: SafeError | null;
}

function safeInternalPath(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/notifications";
}

export async function openNotificationAction(
  formData: FormData,
): Promise<void> {
  const viewer = await requireUser();
  const raw = formData.get("id");
  const id = typeof raw === "string" ? raw : "";

  let target = "/notifications";
  if (isUuid(id)) {
    const db = getDb();
    const [row] = await db
      .select({ href: notifications.href })
      .from(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, viewer.id)))
      .limit(1);
    if (row) {
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.id, id),
            eq(notifications.userId, viewer.id),
            isNull(notifications.readAt),
          ),
        );
      target = safeInternalPath(row.href);
    }
  }
  redirect(target);
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const viewer = await requireUser();
  await getDb()
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(eq(notifications.userId, viewer.id), isNull(notifications.readAt)),
    );
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export async function savePreferencesAction(
  _prev: PreferencesState,
  formData: FormData,
): Promise<PreferencesState> {
  try {
    const viewer = await requireUser();
    const levels = await getUserAccessLevels(viewer);
    const canReceive = (resourceKey: string) =>
      viewer.role === "admin" ||
      levels[resourceKey] === "write" ||
      levels[resourceKey] === "delete";

    const db = getDb();
    for (const category of NOTIFICATION_CATEGORIES) {
      if (!canReceive(category.resourceKey)) continue;
      const inApp = formData.get(`inApp:${category.key}`) === "on";
      const email = formData.get(`email:${category.key}`) === "on";
      await db
        .insert(notificationPreferences)
        .values({ userId: viewer.id, category: category.key, inApp, email })
        .onConflictDoUpdate({
          target: [
            notificationPreferences.userId,
            notificationPreferences.category,
          ],
          set: { inApp, email, updatedAt: new Date() },
        });
    }
    revalidatePath("/notifications/preferences");
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}

export interface SnapshotResult {
  success: boolean;
  error: SafeError | null;
  snapshot: NotificationSnapshot | null;
}

async function snapshotFor(userId: string): Promise<SnapshotResult> {
  return {
    success: true,
    error: null,
    snapshot: await getNotificationSnapshot(userId),
  };
}

function snapshotFailure(error: unknown): SnapshotResult {
  return { success: false, error: toSafeError(error), snapshot: null };
}

export async function getNotificationSnapshotAction(): Promise<SnapshotResult> {
  try {
    const viewer = await requireUserOrThrow();
    return await snapshotFor(viewer.id);
  } catch (error) {
    return snapshotFailure(error);
  }
}

export async function markNotificationReadAction(
  id: string,
): Promise<SnapshotResult> {
  try {
    const viewer = await requireUserOrThrow();
    if (isUuid(id)) {
      await getDb()
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.id, id),
            eq(notifications.userId, viewer.id),
            isNull(notifications.readAt),
          ),
        );
    }
    return await snapshotFor(viewer.id);
  } catch (error) {
    return snapshotFailure(error);
  }
}

export async function markAllReadFromMenuAction(): Promise<SnapshotResult> {
  try {
    const viewer = await requireUserOrThrow();
    await getDb()
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(eq(notifications.userId, viewer.id), isNull(notifications.readAt)),
      );
    return await snapshotFor(viewer.id);
  } catch (error) {
    return snapshotFailure(error);
  }
}
