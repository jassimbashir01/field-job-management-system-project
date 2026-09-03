import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { customFieldDefinitions } from "@/db/schema";
import { requireRoleOrRedirect } from "@/lib/auth/guards";
import { CustomFieldsManager } from "./custom-fields-manager";

export default async function CustomFieldsSettingsPage() {
  await requireRoleOrRedirect("admin");

  const db = getDb();
  const definitions = await db
    .select()
    .from(customFieldDefinitions)
    .where(eq(customFieldDefinitions.entityType, "customer"))
    .orderBy(asc(customFieldDefinitions.sortOrder));

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold">Customer custom fields</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Extra fields shown on every customer record, without needing a developer
        to add them.
      </p>
      <CustomFieldsManager definitions={definitions} />
    </div>
  );
}
