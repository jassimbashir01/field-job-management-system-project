import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { customers, sites } from "@/db/schema";
import { requirePermissionOrRedirect } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-catalog";
import { getFieldDefinitions, getFieldValues } from "@/lib/custom-fields";
import { SiteForm } from "../site-form";
import { SiteDeleteSection } from "./delete-section";

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermissionOrRedirect(PERMISSIONS.SITES_MANAGE);
  const { id } = await params;

  const db = getDb();
  const rows = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
  const site = rows[0];
  if (!site) {
    notFound();
  }

  const [allCustomers, definitions, fieldValues] = await Promise.all([
    db.select().from(customers).orderBy(asc(customers.name)),
    getFieldDefinitions("site"),
    getFieldValues(site.id),
  ]);

  return (
    <div className="max-w-lg space-y-10">
      <div>
        <h1 className="text-xl font-semibold">{site.name}</h1>
        <SiteForm
          site={site}
          customers={allCustomers}
          definitions={definitions}
          customFieldValues={fieldValues}
        />
      </div>
      <SiteDeleteSection site={site} />
    </div>
  );
}
