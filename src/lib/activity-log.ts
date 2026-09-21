import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { activityLogEntries } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";

export interface ActivityLogEntry {
  id: string;
  action: string;
  actorDisplayName: string;
  summary: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export async function logActivity({
  entityType,
  entityId,
  action,
  actor,
  summary,
  metadata,
  tx,
}: {
  entityType: string;
  entityId: string;
  action: string;
  actor: SessionUser;
  summary: string;
  metadata?: Record<string, unknown>;
  tx?: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
}): Promise<void> {
  const db = tx ?? getDb();
  await db.insert(activityLogEntries).values({
    entityType,
    entityId,
    action,
    actorUserId: actor.id,
    actorDisplayName: actor.displayName,
    summary,
    metadata: metadata ?? null,
  });
}

export async function getActivityLog(
  entityType: string,
  entityId: string,
): Promise<ActivityLogEntry[]> {
  const db = getDb();
  return db
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
        eq(activityLogEntries.entityType, entityType),
        eq(activityLogEntries.entityId, entityId),
      ),
    )
    .orderBy(desc(activityLogEntries.createdAt));
}
