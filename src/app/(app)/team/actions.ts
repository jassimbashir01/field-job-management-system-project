"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, count, eq, ne } from "drizzle-orm";
import * as z from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requireRole, requireUserOrThrow } from "@/lib/auth/guards";
import {
  grantPermission,
  revokePermission,
  PERMISSIONS,
  type PermissionKey,
} from "@/lib/auth/permissions";
import { hashPassword } from "@/lib/auth/password";
import { createPasswordResetToken } from "@/lib/auth/password-reset";
import { ConflictError, toSafeError, type SafeError } from "@/lib/errors";

const createUserSchema = z.object({
  email: z.email(),
  displayName: z.string().min(1),
  jobTitle: z.string().optional(),
  role: z.enum(["manager", "team_member"]),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export interface FormState {
  success: boolean;
  error: SafeError | null;
}

export async function createUserAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await requireRole("admin");

    const parsed = createUserSchema.safeParse(
      Object.fromEntries(formData.entries()),
    );
    if (!parsed.success) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Invalid input",
        },
      };
    }

    const db = getDb();
    const passwordHash = await hashPassword(parsed.data.password);

    await db.insert(users).values({
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
      displayName: parsed.data.displayName,
      jobTitle: parsed.data.jobTitle || null,
      mustChangePassword: true,
    });

    revalidatePath("/team");
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }

  redirect("/team");
}

const updateUserSchema = z.object({
  displayName: z.string().min(1),
  jobTitle: z.string().optional(),
  role: z.enum(["admin", "manager", "team_member"]),
  isActive: z.enum(["on"]).optional(), // checkbox: present when checked, absent when not
});

async function assertNotLastAdmin(targetUserId: string) {
  const db = getDb();
  const countRows = await db
    .select({ value: count() })
    .from(users)
    .where(and(eq(users.role, "admin"), ne(users.id, targetUserId)));

  const countRow = countRows[0];
  if (!countRow) {
    throw new ConflictError("Could not verify the remaining Admin count.");
  }

  const adminCount = Number(countRow.value);

  if (adminCount === 0) {
    const [target] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);
    if (target?.role === "admin") {
      throw new ConflictError(
        "Can't do that — this is the last remaining Admin account.",
      );
    }
  }
}

export async function updateUserAction(
  userId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await requireRole("admin");

    const parsed = updateUserSchema.safeParse(
      Object.fromEntries(formData.entries()),
    );
    if (!parsed.success) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Invalid input",
        },
      };
    }

    await assertNotLastAdmin(userId);

    const db = getDb();
    await db
      .update(users)
      .set({
        displayName: parsed.data.displayName,
        jobTitle: parsed.data.jobTitle || null,
        role: parsed.data.role,
        isActive: parsed.data.isActive === "on",
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    revalidatePath(`/team/${userId}`);
    revalidatePath("/team");
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}

export async function updatePermissionsAction(
  userId: string,
  formData: FormData,
): Promise<void> {
  await requireRole("admin");

  const selected = new Set(formData.getAll("permissions") as PermissionKey[]);
  const current = await import("@/lib/auth/permissions").then((m) =>
    m.getUserPermissions(userId),
  );
  const admin = await requireRole("admin");

  for (const permission of Object.values(PERMISSIONS)) {
    const shouldHave = selected.has(permission);
    const currentlyHas = current.has(permission);
    if (shouldHave && !currentlyHas) {
      await grantPermission(userId, permission, admin.id);
    } else if (!shouldHave && currentlyHas) {
      await revokePermission(userId, permission);
    }
  }

  revalidatePath(`/team/${userId}`);
}

async function requireCanManagePasswordFor(targetUserId: string) {
  const actor = await requireUserOrThrow();
  if (actor.role === "admin") return actor;

  if (actor.role === "manager") {
    const { hasPermission } = await import("@/lib/auth/permissions");
    const allowed = await hasPermission(actor, PERMISSIONS.TEAM_RESET_PASSWORD);
    if (allowed) {
      const db = getDb();
      const rows = await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, targetUserId))
        .limit(1);
      if (rows[0]?.role === "team_member") {
        return actor;
      }
    }
  }

  const { ForbiddenError } = await import("@/lib/errors");
  throw new ForbiddenError();
}

const tempPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function setTemporaryPasswordAction(
  userId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await requireCanManagePasswordFor(userId);

    const parsed = tempPasswordSchema.safeParse(
      Object.fromEntries(formData.entries()),
    );
    if (!parsed.success) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Invalid input",
        },
      };
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const db = getDb();
    await db
      .update(users)
      .set({ passwordHash, mustChangePassword: true, updatedAt: new Date() })
      .where(eq(users.id, userId));

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}

export interface ResetLinkState {
  success: boolean;
  link: string | null;
  error: SafeError | null;
}

export async function generateResetLinkAction(
  userId: string,
): Promise<ResetLinkState> {
  try {
    await requireCanManagePasswordFor(userId);
    const rawToken = await createPasswordResetToken(userId);
    const { env } = await import("@/lib/env");
    const link = `${env.NEXT_PUBLIC_APP_URL}/reset-password/${rawToken}`;
    return { success: true, link, error: null };
  } catch (error) {
    return { success: false, link: null, error: toSafeError(error) };
  }
}

export async function deleteUserAction(userId: string): Promise<FormState> {
  try {
    const admin = await requireRole("admin");
    if (admin.id === userId) {
      throw new ConflictError(
        "You can't delete your own account while signed in as it.",
      );
    }
    await assertNotLastAdmin(userId);

    const db = getDb();
    await db.delete(users).where(eq(users.id, userId));

    revalidatePath("/team");
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }

  redirect("/team");
}
