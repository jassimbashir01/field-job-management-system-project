import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  customers,
  jobs,
  paymentOptions,
  quoteLineItems,
  quotes,
  sites,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { getResourceAccess } from "@/lib/auth/permissions";
import { ForbiddenMessage } from "@/components/shared/forbidden-message";
import type { LineItemRow } from "@/components/shared/line-items-input";
import { getFieldDefinitions } from "@/lib/custom-fields";
import { isUuid } from "@/lib/uuid";
import { InvoiceForm, type InvoiceDefaults } from "../invoice-form";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string; quoteId?: string }>;
}) {
  const viewer = await requireUser();
  const access = await getResourceAccess(viewer, "invoices");
  if (!access.canWrite) return <ForbiddenMessage />;

  const { jobId, quoteId } = await searchParams;
  const db = getDb();

  let defaults: InvoiceDefaults | undefined;
  let lineItemRows: LineItemRow[] = [];
  const source: { jobId?: string; quoteId?: string } = {};

  if (jobId && isUuid(jobId)) {
    const jobAccess = await getResourceAccess(viewer, "jobs");
    if (jobAccess.canRead) {
      const [job] = await db
        .select()
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1);
      if (job) {
        source.jobId = job.id;
        defaults = {
          title: job.title,
          customerId: job.customerId,
          siteId: job.siteId,
          oneOffLocation: job.oneOffLocation,
        };
      }
    }
  }

  if (quoteId && isUuid(quoteId)) {
    const quoteAccess = await getResourceAccess(viewer, "quotes");
    if (quoteAccess.canRead) {
      const [quote] = await db
        .select()
        .from(quotes)
        .where(eq(quotes.id, quoteId))
        .limit(1);
      if (quote && quote.status === "accepted") {
        source.quoteId = quote.id;
        defaults = {
          title: quote.title,
          notes: quote.notes,
          customerId: quote.customerId,
          siteId: quote.siteId,
          oneOffLocation: quote.oneOffLocation,
        };
        const items = await db
          .select()
          .from(quoteLineItems)
          .where(eq(quoteLineItems.quoteId, quote.id))
          .orderBy(quoteLineItems.sortOrder);
        lineItemRows = items.map((item) => ({
          key: item.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: (item.unitPriceCents / 100).toFixed(2),
        }));
      }
    }
  }

  const [customerRows, siteRows, definitions, optionRows] = await Promise.all([
    db.select().from(customers),
    db.select().from(sites),
    getFieldDefinitions("invoice"),
    db
      .select()
      .from(paymentOptions)
      .orderBy(paymentOptions.sortOrder, paymentOptions.createdAt),
  ]);

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold">New invoice</h1>
      {source.quoteId && (
        <p className="mt-1 text-sm text-muted-foreground">
          Pre-filled from an accepted quote. Adjust anything before creating.
        </p>
      )}
      {!source.quoteId && source.jobId && (
        <p className="mt-1 text-sm text-muted-foreground">
          Pre-filled from a job. Add the line items before creating.
        </p>
      )}
      <InvoiceForm
        defaults={defaults}
        source={source}
        customers={customerRows}
        sites={siteRows}
        definitions={definitions}
        lineItemRows={lineItemRows}
        paymentOptions={optionRows}
        attachedOptionIds={[]}
      />
    </div>
  );
}
