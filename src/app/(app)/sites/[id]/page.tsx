import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { customers, sites } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { getResourceAccess } from "@/lib/auth/permissions";
import { getFieldDefinitions, getFieldValues } from "@/lib/custom-fields";
import { SiteForm } from "../site-form";
import { SiteDeleteSection } from "./delete-section";

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireUser();
  const access = await getResourceAccess(viewer, "sites");
  if (!access.canRead) {
    const { redirect } = await import("next/navigation");
    redirect("/forbidden");
  }

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
        {!access.canWrite && (
          <p className="mt-1 text-sm text-muted-foreground">
            You have read-only access to Sites.
          </p>
        )}
        <SiteForm
          site={site}
          customers={allCustomers}
          definitions={definitions}
          customFieldValues={fieldValues}
          readOnly={!access.canWrite}
        />
      </div>
      <SiteDeleteSection site={site} canDelete={access.canDelete} />
    </div>
  );
}
