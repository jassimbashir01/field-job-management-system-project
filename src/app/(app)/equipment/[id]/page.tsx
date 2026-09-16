import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { equipment, sites } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { getResourceAccess } from "@/lib/auth/permissions";
import { getFieldDefinitions, getFieldValues } from "@/lib/custom-fields";
import { ForbiddenMessage } from "@/components/shared/forbidden-message";
import { EquipmentForm } from "../equipment-form";
import { EquipmentDeleteSection } from "./delete-section";

export const dynamic = "force-dynamic";

export default async function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireUser();
  const access = await getResourceAccess(viewer, "equipment");
  if (!access.canRead) {
    return <ForbiddenMessage />;
  }

  const { id } = await params;

  const db = getDb();
  const rows = await db
    .select()
    .from(equipment)
    .where(eq(equipment.id, id))
    .limit(1);
  const equipmentItem = rows[0];
  if (!equipmentItem) {
    notFound();
  }

  const [allSites, definitions, fieldValues] = await Promise.all([
    db.select().from(sites).orderBy(asc(sites.name)),
    getFieldDefinitions("equipment"),
    getFieldValues(equipmentItem.id),
  ]);

  return (
    <div className="max-w-lg space-y-10">
      <div>
        <h1 className="text-xl font-semibold">{equipmentItem.name}</h1>
        {!access.canWrite && (
          <p className="mt-1 text-sm text-muted-foreground">
            You have read-only access to Equipment.
          </p>
        )}
        <EquipmentForm
          equipment={equipmentItem}
          sites={allSites}
          definitions={definitions}
          customFieldValues={fieldValues}
          readOnly={!access.canWrite}
        />
      </div>
      <EquipmentDeleteSection
        equipment={equipmentItem}
        canDelete={access.canDelete}
      />
    </div>
  );
}
