import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import {
  getUserPermissions,
  hasPermission,
  PERMISSIONS,
} from "@/lib/auth/permissions";
import { EditUserForm } from "./edit-user-form";
import { PasswordResetSection } from "./password-reset-section";

export default async function EditTeamMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireUser();
  const { id } = await params;

  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const targetUser = rows[0];
  if (!targetUser) {
    notFound();
  }

  const isAdmin = viewer.role === "admin";
  const isManagerResettingTeamMember =
    viewer.role === "manager" &&
    targetUser.role === "team_member" &&
    (await hasPermission(viewer, PERMISSIONS.TEAM_RESET_PASSWORD));

  if (!isAdmin && !isManagerResettingTeamMember) {
    redirect("/forbidden");
  }

  if (!isAdmin) {
    // Manager path — password reset only, nothing else on this page.
    return (
      <div className="max-w-lg">
        <h1 className="text-xl font-semibold">{targetUser.displayName}</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">
          {targetUser.email}
        </p>
        <PasswordResetSection userId={targetUser.id} />
      </div>
    );
  }

  const currentPermissions =
    targetUser.role === "manager"
      ? Array.from(await getUserPermissions(targetUser.id))
      : [];

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold">{targetUser.displayName}</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        {targetUser.email}
      </p>
      <EditUserForm
        key={targetUser.updatedAt.toISOString()}
        user={targetUser}
        currentPermissions={currentPermissions}
      />
    </div>
  );
}
