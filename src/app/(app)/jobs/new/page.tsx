import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { customers, sites, users } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { getResourceAccess } from "@/lib/auth/permissions";
import { getFieldDefinitions } from "@/lib/custom-fields";
import { ForbiddenMessage } from "@/components/shared/forbidden-message";
import { JobForm } from "../job-form";

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; siteId?: string }>;
}) {
  const viewer = await requireUser();
  const access = await getResourceAccess(viewer, "jobs");
  if (!access.canWrite) {
    return <ForbiddenMessage />;
  }

  const { customerId, siteId } = await searchParams;

  const db = getDb();
  const [allCustomers, allSites, technicians, definitions] = await Promise.all([
    db.select().from(customers).orderBy(asc(customers.name)),
    db.select().from(sites).orderBy(asc(sites.name)),
    db
      .select()
      .from(users)
      .where(eq(users.role, "team_member"))
      .orderBy(asc(users.displayName)),
    getFieldDefinitions("job"),
  ]);

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold">New job</h1>
      <JobForm
        customers={allCustomers}
        sites={allSites}
        technicians={technicians}
        defaultCustomerId={customerId}
        defaultSiteId={siteId}
        definitions={definitions}
      />
    </div>
  );
}
