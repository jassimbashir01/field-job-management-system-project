import "server-only";
import { redirect } from "next/navigation";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { getSessionUser, type SessionUser } from "./session";

export type Role = SessionUser["role"];

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireUserOrThrow(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new UnauthenticatedError();
  }
  return user;
}

export async function requireRole(...allowed: Role[]): Promise<SessionUser> {
  const user = await requireUserOrThrow();
  if (user.role === "admin") return user;
  if (!allowed.includes(user.role)) {
    throw new ForbiddenError();
  }
  return user;
}
