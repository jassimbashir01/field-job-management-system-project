import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { customers, sites } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { getResourceAccess } from "@/lib/auth/permissions";
import { ForbiddenMessage } from "@/components/shared/forbidden-message";
import { getFieldDefinitions } from "@/lib/custom-fields";
import { QuoteForm, type QuoteDefaults } from "../quote-form";

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; siteId?: string }>;
}) {
  const viewer = await requireUser();
  const access = await getResourceAccess(viewer, "quotes");
  if (!access.canWrite) return <ForbiddenMessage />;

  const { customerId, siteId } = await searchParams;

  const db = getDb();
  const [customerRows, siteRows, definitions] = await Promise.all([
    db.select().from(customers).orderBy(asc(customers.name)),
    db.select().from(sites).orderBy(asc(sites.name)),
    getFieldDefinitions("quote"),
  ]);

  const customer = customerId
    ? customerRows.find((c) => c.id === customerId)
    : undefined;
  const site =
    customer && siteId
      ? siteRows.find((s) => s.id === siteId && s.customerId === customer.id)
      : undefined;
  const defaults: QuoteDefaults | undefined = customer
    ? { customerId: customer.id, siteId: site?.id ?? null }
    : undefined;

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold">New quote</h1>
      <QuoteForm
        defaults={defaults}
        customers={customerRows}
        sites={siteRows}
        definitions={definitions}
        lineItemRows={[]}
      />
    </div>
  );
}
