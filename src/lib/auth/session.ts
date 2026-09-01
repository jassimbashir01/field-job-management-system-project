import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "@/db";
import { sessions, users, type userRoleEnum } from "@/db/schema";

const SESSION_COOKIE_NAME = "session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface SessionUser {
  id: string;
  email: string;
  role: (typeof userRoleEnum.enumValues)[number];
  displayName: string;
  jobTitle: string | null;
  mustChangePassword: boolean;
}

export async function createSession(
  userId: string,
  metadata: { ipAddress?: string; userAgent?: string } = {},
): Promise<void> {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  const db = getDb();
  await db.insert(sessions).values({
    id: tokenHash,
    userId,
    expiresAt,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) return null;

  const tokenHash = hashToken(rawToken);
  const db = getDb();

  const rows = await db
    .select({
      sessionExpiresAt: sessions.expiresAt,
      userId: users.id,
      email: users.email,
      role: users.role,
      displayName: users.displayName,
      jobTitle: users.jobTitle,
      isActive: users.isActive,
      mustChangePassword: users.mustChangePassword,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, tokenHash))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.sessionExpiresAt < new Date()) return null;
  if (!row.isActive) return null;

  return {
    id: row.userId,
    email: row.email,
    role: row.role,
    displayName: row.displayName,
    jobTitle: row.jobTitle,
    mustChangePassword: row.mustChangePassword,
  };
});

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (rawToken) {
    const tokenHash = hashToken(rawToken);
    const db = getDb();
    await db.delete(sessions).where(eq(sessions.id, tokenHash));
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}
