import { randomBytes, createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { passwordResetTokens, users } from "@/db/schema";
import { hashPassword } from "./password";

const RESET_TOKEN_DURATION_MS = 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createPasswordResetToken(
  userId: string,
): Promise<string> {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_DURATION_MS);

  const db = getDb();
  await db.insert(passwordResetTokens).values({
    id: tokenHash,
    userId,
    expiresAt,
  });

  return rawToken;
}

export async function isPasswordResetTokenValid(
  rawToken: string,
): Promise<boolean> {
  const tokenHash = hashToken(rawToken);
  const db = getDb();

  const rows = await db
    .select({ expiresAt: passwordResetTokens.expiresAt })
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.id, tokenHash))
    .limit(1);

  const row = rows[0];
  if (!row) return false;
  return row.expiresAt >= new Date();
}

export async function consumePasswordResetToken(
  rawToken: string,
  newPassword: string,
): Promise<boolean> {
  const tokenHash = hashToken(rawToken);
  const db = getDb();

  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.id, tokenHash))
      .limit(1);

    const tokenRow = rows[0];
    if (!tokenRow) return false;
    if (tokenRow.expiresAt < new Date()) {
      await tx
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.id, tokenHash));
      return false;
    }

    const passwordHash = await hashPassword(newPassword);
    await tx
      .update(users)
      .set({ passwordHash, mustChangePassword: false, updatedAt: new Date() })
      .where(eq(users.id, tokenRow.userId));

    await tx
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.id, tokenHash));

    return true;
  });
}
