import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { sites } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { getResourceAccess } from "@/lib/auth/permissions";
import { getFieldDefinitions } from "@/lib/custom-fields";
import { ForbiddenMessage } from "@/components/shared/forbidden-message";
import { EquipmentForm } from "../equipment-form";

export default async function NewEquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string }>;
}) {
  const viewer = await requireUser();
  const access = await getResourceAccess(viewer, "equipment");
  if (!access.canWrite) {
    return <ForbiddenMessage />;
  }

  const { siteId } = await searchParams;

  const db = getDb();
  const [allSites, definitions] = await Promise.all([
    db.select().from(sites).orderBy(asc(sites.name)),
    getFieldDefinitions("equipment"),
  ]);

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold">New equipment</h1>
      <EquipmentForm
        sites={allSites}
        defaultSiteId={siteId}
        definitions={definitions}
      />
    </div>
  );
}
