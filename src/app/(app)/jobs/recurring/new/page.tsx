import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { customers, sites, users } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { getResourceAccess } from "@/lib/auth/permissions";
import { ForbiddenMessage } from "@/components/shared/forbidden-message";
import { RecurrenceForm } from "../recurrence-form";

export default async function NewRecurringJobPage() {
  const viewer = await requireUser();
  const access = await getResourceAccess(viewer, "recurring_jobs");
  if (!access.canWrite) {
    return <ForbiddenMessage />;
  }

  const db = getDb();
  const [allCustomers, allSites, technicians] = await Promise.all([
    db.select().from(customers).orderBy(asc(customers.name)),
    db.select().from(sites).orderBy(asc(sites.name)),
    db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(eq(users.role, "team_member"))
      .orderBy(asc(users.displayName)),
  ]);

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold">New recurring job</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Generates a new job automatically, on the schedule below, for as long as
        this series stays active.
      </p>
      <RecurrenceForm
        customers={allCustomers}
        sites={allSites}
        technicians={technicians}
      />
    </div>
  );
}
