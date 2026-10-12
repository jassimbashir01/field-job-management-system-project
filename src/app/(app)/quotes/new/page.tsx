import { getDb } from "@/db";
import { customers, sites } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { getResourceAccess } from "@/lib/auth/permissions";
import { ForbiddenMessage } from "@/components/shared/forbidden-message";
import { getFieldDefinitions } from "@/lib/custom-fields";
import { QuoteForm } from "../quote-form";

export default async function NewQuotePage() {
  const viewer = await requireUser();
  const access = await getResourceAccess(viewer, "quotes");
  if (!access.canWrite) return <ForbiddenMessage />;

  const db = getDb();
  const [customerRows, siteRows, definitions] = await Promise.all([
    db.select().from(customers),
    db.select().from(sites),
    getFieldDefinitions("quote"),
  ]);

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold">New quote</h1>
      <QuoteForm
        customers={customerRows}
        sites={siteRows}
        definitions={definitions}
        lineItemRows={[]}
      />
    </div>
  );
}
