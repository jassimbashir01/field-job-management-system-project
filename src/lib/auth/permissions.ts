import { and, eq } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "@/db";
import { userPermissions } from "@/db/schema";
import type { SessionUser } from "./session";

export const PERMISSIONS = {
  JOBS_CREATE: "jobs:create",
  JOBS_EDIT: "jobs:edit",
  JOBS_SCHEDULE: "jobs:schedule",
  JOBS_ASSIGN: "jobs:assign",
  CUSTOMERS_MANAGE: "customers:manage",
  SITES_MANAGE: "sites:manage",
  TEMPLATES_MANAGE: "templates:manage",
  REPORTS_VIEW: "reports:view",
  TEAM_RESET_PASSWORD: "team:reset_password",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

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
