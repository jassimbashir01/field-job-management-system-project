import { and, eq } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "@/db";
import { userPermissions } from "@/db/schema";
import type { SessionUser } from "./session";
import { PERMISSIONS, type PermissionKey } from "./permission-catalog";

export { PERMISSIONS, type PermissionKey };

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
