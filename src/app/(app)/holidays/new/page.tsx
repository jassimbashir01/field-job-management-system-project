import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { getResourceAccess } from "@/lib/auth/permissions";
import { ForbiddenMessage } from "@/components/shared/forbidden-message";
import { NewHolidayForm } from "./new-holiday-form";

export default async function NewHolidayPage() {
  const viewer = await requireUser();
  const access = await getResourceAccess(viewer, "holidays");
  if (!access.canWrite) return <ForbiddenMessage />;

  const people = await getDb()
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(and(eq(users.role, "team_member"), eq(users.isActive, true)))
    .orderBy(asc(users.displayName));

  return (
    <div>
      <Link
        href="/holidays"
        className="text-sm text-muted-foreground underline"
      >
        ← Holiday requests
      </Link>
      <h1 className="mt-2 text-xl font-semibold">Record a holiday request</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        For a request a team member made by phone, text or in person. Team
        members will submit their own from the staff app later.
      </p>
      {people.length === 0 ? (
        <p className="text-sm">
          There are no active team members yet. Add some under{" "}
          <Link href="/team" className="underline">
            Team
          </Link>
          .
        </p>
      ) : (
        <NewHolidayForm people={people} />
      )}
    </div>
  );
}
