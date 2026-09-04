import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { customers } from "@/db/schema";
import { requirePermissionOrRedirect } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-catalog";
import { getFieldDefinitions } from "@/lib/custom-fields";
import { SiteForm } from "../site-form";

export default async function NewSitePage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  await requirePermissionOrRedirect(PERMISSIONS.SITES_MANAGE);
  const { customerId } = await searchParams;

  const db = getDb();
  const [allCustomers, definitions] = await Promise.all([
    db.select().from(customers).orderBy(asc(customers.name)),
    getFieldDefinitions("site"),
  ]);

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold">New site</h1>
      <SiteForm
        customers={allCustomers}
        defaultCustomerId={customerId}
        definitions={definitions}
      />
    </div>
  );
}
