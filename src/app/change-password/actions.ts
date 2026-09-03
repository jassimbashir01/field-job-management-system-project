"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requireUserOrThrow } from "@/lib/auth/guards";
import { hashPassword } from "@/lib/auth/password";

const schema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export interface ChangePasswordState {
  error: string | null;
}

export async function changePasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const user = await requireUserOrThrow();

  const parsed = schema.safeParse({ password: formData.get("password") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid password" };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const db = getDb();
  await db
    .update(users)
    .set({ passwordHash, mustChangePassword: false, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  redirect(user.role === "team_member" ? "/mobile" : "/dashboard");
}
