import { and, eq } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "@/db";
import { userPermissions } from "@/db/schema";
import type { SessionUser } from "./session";
import {
  PERMISSIONS,
  RESOURCES,
  getCurrentLevel,
  levelsUpTo,
  permissionKey,
  type AccessLevel,
  type PermissionKey,
} from "./permission-catalog";

export { PERMISSIONS, type PermissionKey, AccessLevel };

export interface ResourceAccess {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
}

export const getUserPermissions = cache(
  async (userId: string): Promise<Set<PermissionKey>> => {
    const db = getDb();
    const rows = await db
      .select({ permissionKey: userPermissions.permissionKey })
      .from(userPermissions)
      .where(eq(userPermissions.userId, userId));
    return new Set(rows.map((row) => row.permissionKey as PermissionKey));
  },
);

export async function hasPermission(
  user: SessionUser,
  permission: PermissionKey,
): Promise<boolean> {
  if (user.role === "admin") return true;
  if (user.role !== "manager") return false;
  const permissions = await getUserPermissions(user.id);
  return permissions.has(permission);
}

export async function grantPermission(
  userId: string,
  permission: PermissionKey,
  grantedByUserId: string,
): Promise<void> {
  const db = getDb();
  await db
    .insert(userPermissions)
    .values({ userId, permissionKey: permission, grantedByUserId })
    .onConflictDoNothing();
}

export async function revokePermission(
  userId: string,
  permission: PermissionKey,
): Promise<void> {
  const db = getDb();
  await db
    .delete(userPermissions)
    .where(
      and(
        eq(userPermissions.userId, userId),
        eq(userPermissions.permissionKey, permission),
      ),
    );
}

export async function setResourceAccess(
  userId: string,
  resourceKey: string,
  level: AccessLevel | "none",
  grantedByUserId: string,
): Promise<void> {
  const resource = RESOURCES.find((r) => r.key === resourceKey);
  if (!resource) {
    throw new Error(`Unknown resource: ${resourceKey}`);
  }

  const levelsToGrant = level === "none" ? [] : levelsUpTo(level);
  const keysToGrant = new Set(
    levelsToGrant.map((l) => permissionKey(resourceKey, l)),
  );

  const allPossibleLevels: AccessLevel[] = ["read", "write", "delete"];
  for (const l of allPossibleLevels) {
    const key = permissionKey(resourceKey, l) as PermissionKey;
    if (keysToGrant.has(key)) {
      await grantPermission(userId, key, grantedByUserId);
    } else {
      await revokePermission(userId, key);
    }
  }
}

export async function getResourceAccess(
  user: SessionUser,
  resourceKey: string,
): Promise<ResourceAccess> {
  if (user.role === "admin") {
    return { canRead: true, canWrite: true, canDelete: true };
  }
  if (user.role !== "manager") {
    return { canRead: false, canWrite: false, canDelete: false };
  }

  const granted = await getUserPermissions(user.id);
  const level = getCurrentLevel(resourceKey, granted);

  return {
    canRead: level !== "none",
    canWrite: level === "write" || level === "delete",
    canDelete: level === "delete",
  };
}

export async function getUserAccessLevels(
  user: SessionUser,
): Promise<Record<string, AccessLevel | "none">> {
  if (user.role === "admin") {
    return Object.fromEntries(RESOURCES.map((r) => [r.key, "delete" as const]));
  }
  if (user.role !== "manager") {
    return Object.fromEntries(RESOURCES.map((r) => [r.key, "none" as const]));
  }

  const granted = await getUserPermissions(user.id);
  return Object.fromEntries(
    RESOURCES.map((r) => [r.key, getCurrentLevel(r.key, granted)]),
  );
}
