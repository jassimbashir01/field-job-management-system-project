import Link from "next/link";
import { asc, eq, ilike, or } from "drizzle-orm";
import { getDb } from "@/db";
import { customers, sites } from "@/db/schema";
import { requirePermissionOrRedirect } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-catalog";
import { Button } from "@/components/ui/button";
import { SiteSearchInput } from "./search-input";

export default async function SitesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePermissionOrRedirect(PERMISSIONS.SITES_MANAGE);
  const { q } = await searchParams;

  const db = getDb();
  const query = q?.trim();
  const rows = await db
    .select({
      id: sites.id,
      name: sites.name,
      addressLine1: sites.addressLine1,
      city: sites.city,
      customerName: customers.name,
    })
    .from(sites)
    .innerJoin(customers, eq(sites.customerId, customers.id))
    .where(
      query
        ? or(
            ilike(sites.name, `%${query}%`),
            ilike(sites.addressLine1, `%${query}%`),
            ilike(sites.city, `%${query}%`),
            ilike(customers.name, `%${query}%`),
          )
        : undefined,
    )
    .orderBy(asc(sites.name));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Sites</h1>
        <Button
          render={<Link href="/sites/new">New site</Link>}
          nativeButton={false}
        />
      </div>

      <form method="get" className="mt-4">
        <SiteSearchInput defaultQuery={query ?? ""} />
      </form>

      <div className="mt-6 divide-y rounded-md border">
        {rows.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            {query ? "No matches." : "No sites yet."}
          </p>
        )}
        {rows.map((site) => (
          <Link
            key={site.id}
            href={`/sites/${site.id}`}
            className="flex items-center justify-between px-4 py-3 text-sm hover:bg-accent"
          >
            <div>
              <p className="font-medium">{site.name}</p>
              <p className="text-xs text-muted-foreground">
                {site.customerName}
                {site.addressLine1 && ` · ${site.addressLine1}`}
                {site.city && `, ${site.city}`}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
