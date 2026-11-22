import "server-only";
import { and, count, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { getDb } from "@/db";
import {
  notificationPreferences,
  notifications,
  userPermissions,
  users,
} from "@/db/schema";
import { env } from "@/lib/env";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import {
  DEFAULT_EMAIL,
  DEFAULT_IN_APP,
  getCategory,
  type NotificationCategory,
} from "@/lib/notification-categories";
import { renderNotificationEmail } from "@/lib/notification-email";
import type { NotificationSnapshot } from "@/lib/notification-types";
import { loadBranding } from "@/lib/pdf/load-document";

export interface NewNotification {
  category: NotificationCategory;
  title: string;
  body?: string | null;
  /** An in-app path like "/invoices/<uuid>". */
  href?: string | null;
}

async function getRecipients(resourceKey: string) {
  const db = getDb();
  return db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(
      and(
        eq(users.isActive, true),
        or(
          eq(users.role, "admin"),
          and(
            eq(users.role, "manager"),
            inArray(
              users.id,
              db
                .select({ id: userPermissions.userId })
                .from(userPermissions)
                .where(
                  eq(userPermissions.permissionKey, `${resourceKey}:write`),
                ),
            ),
          ),
        ),
      ),
    );
}

export async function notifyCategory(input: NewNotification): Promise<void> {
  try {
    const category = getCategory(input.category);
    if (!category) return;

    const recipients = await getRecipients(category.resourceKey);
    if (recipients.length === 0) return;

    const db = getDb();
    const prefs = await db
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.category, input.category),
          inArray(
            notificationPreferences.userId,
            recipients.map((r) => r.id),
          ),
        ),
      );
    const prefByUser = new Map(prefs.map((p) => [p.userId, p]));

    const inAppIds = recipients
      .filter((r) => (prefByUser.get(r.id)?.inApp ?? DEFAULT_IN_APP) === true)
      .map((r) => r.id);
    if (inAppIds.length > 0) {
      await db.insert(notifications).values(
        inAppIds.map((userId) => ({
          userId,
          category: input.category,
          title: input.title,
          body: input.body ?? null,
          href: input.href ?? null,
        })),
      );
    }

    const emailTo = recipients.filter(
      (r) => (prefByUser.get(r.id)?.email ?? DEFAULT_EMAIL) === true,
    );
    if (emailTo.length > 0 && isEmailConfigured()) {
      const { branding } = await loadBranding();
      const base = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
      const content = renderNotificationEmail({
        title: input.title,
        body: input.body ?? null,
        link: input.href ? `${base}${input.href}` : null,
        branding,
      });
      for (const person of emailTo) {
        try {
          await sendEmail({
            to: person.email,
            subject: content.subject,
            html: content.html,
            text: content.text,
          });
        } catch (error) {
          logger.error("Notification email failed", { error });
        }
      }
    }
  } catch (error) {
    logger.error("Couldn't create notification", {
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : error,
    });
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  const [row] = await getDb()
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.value ?? 0;
}

export async function listNotifications(userId: string, limit = 50) {
  return getDb()
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function getPreferenceMap(userId: string) {
  const rows = await getDb()
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId));
  return new Map(rows.map((r) => [r.category, r]));
}

export async function getNotificationSnapshot(
  userId: string,
  limit = 8,
): Promise<NotificationSnapshot> {
  const [unreadCount, rows] = await Promise.all([
    getUnreadCount(userId),
    listNotifications(userId, limit),
  ]);
  return {
    unreadCount,
    items: rows.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      href: n.href,
      read: n.readAt !== null,
      createdAt: n.createdAt.toISOString(),
    })),
  };
}
