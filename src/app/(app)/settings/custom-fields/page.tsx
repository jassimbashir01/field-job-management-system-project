import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { customFieldDefinitions } from "@/db/schema";
import { requireRoleOrRedirect } from "@/lib/auth/guards";
import type { EntityType } from "@/lib/custom-fields";
import { CustomFieldsManager } from "./custom-fields-manager";

const TABS: { entityType: EntityType; label: string }[] = [
  { entityType: "customer", label: "Customers" },
  { entityType: "site", label: "Sites" },
];

export default async function CustomFieldsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string }>;
}) {
  await requireRoleOrRedirect("admin");
  const { entity } = await searchParams;
  const activeEntity: EntityType = entity === "site" ? "site" : "customer";

  const db = getDb();
  const definitions = await db
    .select()
    .from(customFieldDefinitions)
    .where(eq(customFieldDefinitions.entityType, activeEntity))
    .orderBy(asc(customFieldDefinitions.sortOrder));

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold">Custom fields</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Extra fields shown on records, without needing a developer to add them.
      </p>

      <div className="mb-6 flex gap-1 border-b">
        {TABS.map((tab) => (
          <Link
            key={tab.entityType}
            href={`/settings/custom-fields?entity=${tab.entityType}`}
            className={
              tab.entityType === activeEntity
                ? "border-b-2 border-primary px-3 py-2 text-sm font-medium"
                : "px-3 py-2 text-sm font-medium text-muted-foreground"
            }
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <CustomFieldsManager
        entityType={activeEntity}
        definitions={definitions}
      />
    </div>
  );
}
