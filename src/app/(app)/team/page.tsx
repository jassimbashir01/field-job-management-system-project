import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  team_member: "Team Member",
};

export default async function TeamPage() {
  const viewer = await requireUser();
  const isAdmin = viewer.role === "admin";
  const isManagerResettingTeamMember =
    viewer.role === "manager" &&
    (await hasPermission(viewer, PERMISSIONS.TEAM_RESET_PASSWORD));

  if (!isAdmin && !isManagerResettingTeamMember) {
    const { redirect } = await import("next/navigation");
    redirect("/forbidden");
  }

  const db = getDb();
  const allUsers = await db
    .select()
    .from(users)
    .where(isAdmin ? undefined : eq(users.role, "team_member"))
    .orderBy(asc(users.displayName));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Team</h1>
        {isAdmin && (
          <Button
            render={<Link href="/team/new">Add team member</Link>}
            nativeButton={false}
          />
        )}
      </div>

      <div className="mt-6 divide-y rounded-md border">
        {allUsers.map((user) => (
          <Link
            key={user.id}
            href={`/team/${user.id}`}
            className="flex items-center justify-between px-4 py-3 text-sm hover:bg-accent"
          >
            <div>
              <p className="font-medium">{user.displayName}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <div className="flex items-center gap-3">
              {!user.isActive && (
                <span className="text-xs text-status-cancelled">Inactive</span>
              )}
              <span className="text-xs text-muted-foreground">
                {user.jobTitle ?? ROLE_LABELS[user.role] ?? user.role}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
