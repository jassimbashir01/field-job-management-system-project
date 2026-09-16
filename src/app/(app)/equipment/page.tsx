import Link from "next/link";
import { asc, eq, ilike, or } from "drizzle-orm";
import { getDb } from "@/db";
import { equipment, sites } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { getResourceAccess } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { ForbiddenMessage } from "@/components/shared/forbidden-message";
import { EquipmentSearchInput } from "./search-input";

export const dynamic = "force-dynamic";

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const viewer = await requireUser();
  const access = await getResourceAccess(viewer, "equipment");
  if (!access.canRead) {
    return <ForbiddenMessage />;
  }

  const { q } = await searchParams;

  const db = getDb();
  const query = q?.trim();
  const rows = await db
    .select({
      id: equipment.id,
      name: equipment.name,
      manufacturer: equipment.manufacturer,
      model: equipment.model,
      serialNumber: equipment.serialNumber,
      siteName: sites.name,
    })
    .from(equipment)
    .innerJoin(sites, eq(equipment.siteId, sites.id))
    .where(
      query
        ? or(
            ilike(equipment.name, `%${query}%`),
            ilike(equipment.manufacturer, `%${query}%`),
            ilike(equipment.model, `%${query}%`),
            ilike(equipment.serialNumber, `%${query}%`),
            ilike(sites.name, `%${query}%`),
          )
        : undefined,
    )
    .orderBy(asc(equipment.name));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Equipment</h1>
        {access.canWrite && (
          <Button
            render={<Link href="/equipment/new">New equipment</Link>}
            nativeButton={false}
          />
        )}
      </div>

      <form method="get" className="mt-4">
        <EquipmentSearchInput defaultQuery={query ?? ""} />
      </form>

      <div className="mt-6 divide-y rounded-md border">
        {rows.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            {query ? "No matches." : "No equipment yet."}
          </p>
        )}
        {rows.map((item) => (
          <Link
            key={item.id}
            href={`/equipment/${item.id}`}
            className="flex items-center justify-between px-4 py-3 text-sm hover:bg-accent"
          >
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground">
                {item.siteName}
                {item.manufacturer && ` · ${item.manufacturer}`}
                {item.model && ` ${item.model}`}
              </p>
            </div>
            {item.serialNumber && (
              <div className="text-xs text-muted-foreground">
                S/N {item.serialNumber}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
