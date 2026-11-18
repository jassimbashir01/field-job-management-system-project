import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  companies,
  customers,
  invoices,
  jobs,
  quoteLineItems,
  quotes,
  sites,
} from "@/db/schema";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guards";
import { getResourceAccess } from "@/lib/auth/permissions";
import { ForbiddenMessage } from "@/components/shared/forbidden-message";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { InvoiceStatusBadge } from "@/components/shared/invoice-status-badge";
import { QuoteStatusBadge } from "@/components/shared/quote-status-badge";
import {
  RelatedDocuments,
  type RelatedItem,
} from "@/components/shared/related-documents";
import { getActivityLog } from "@/lib/activity-log";
import { getFieldDefinitions, getFieldValues } from "@/lib/custom-fields";
import { getInvoiceTotals } from "@/lib/document-totals";
import { isInvoiceOverdue } from "@/lib/invoice-status";
import { computeTotalCents, formatCents } from "@/lib/money";
import { isQuoteExpired } from "@/lib/quote-status";
import { isUuid } from "@/lib/uuid";
import { QuoteForm } from "../quote-form";
import { QuoteStatusActions } from "./quote-status-actions";
import { QuoteDeleteSection } from "./delete-section";

export const dynamic = "force-dynamic";

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireUser();
  const access = await getResourceAccess(viewer, "quotes");
  if (!access.canRead) return <ForbiddenMessage />;
  if (!isUuid(id)) notFound();

  const invoiceAccess = await getResourceAccess(viewer, "invoices");

  const db = getDb();
  const [quote] = await db
    .select()
    .from(quotes)
    .where(eq(quotes.id, id))
    .limit(1);
  if (!quote) notFound();

  const [
    lineItems,
    customerRows,
    siteRows,
    definitions,
    activityLog,
    companyRows,
    createdJobRows,
  ] = await Promise.all([
    db
      .select()
      .from(quoteLineItems)
      .where(eq(quoteLineItems.quoteId, id))
      .orderBy(quoteLineItems.sortOrder),
    db.select().from(customers).orderBy(asc(customers.name)),
    db.select().from(sites).orderBy(asc(sites.name)),
    getFieldDefinitions("quote"),
    getActivityLog("quote", id),
    db.select({ currency: companies.currency }).from(companies).limit(1),
    db
      .select({ id: jobs.id, jobNumber: jobs.jobNumber })
      .from(jobs)
      .where(eq(jobs.createdFromQuoteId, id))
      .limit(1),
  ]);
  const customFieldValues = await getFieldValues(id);
  const company = companyRows[0];
  const createdJob = createdJobRows[0];
  const currency = company?.currency ?? "USD";

  const quoteInvoices = invoiceAccess.canRead
    ? await db
        .select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          title: invoices.title,
          status: invoices.status,
          dueDate: invoices.dueDate,
        })
        .from(invoices)
        .where(eq(invoices.quoteId, id))
        .orderBy(desc(invoices.createdAt))
    : [];
  const invoiceTotals = await getInvoiceTotals(quoteInvoices.map((i) => i.id));
  const invoiceItems: RelatedItem[] = quoteInvoices.map((i) => ({
    id: i.id,
    href: `/invoices/${i.id}`,
    label: `#${i.invoiceNumber} — ${i.title}`,
    sublabel: i.dueDate ? `Due ${i.dueDate}` : undefined,
    badge: (
      <InvoiceStatusBadge status={i.status} overdue={isInvoiceOverdue(i)} />
    ),
    amount: formatCents(invoiceTotals.get(i.id) ?? 0, currency),
  }));

  const quoteCustomer = customerRows.find((c) => c.id === quote.customerId);
  const quoteSite = quote.siteId
    ? siteRows.find((s) => s.id === quote.siteId)
    : undefined;

  const totalCents = computeTotalCents(lineItems);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          #{quote.quoteNumber} — {quote.title}
        </h1>
        <QuoteStatusBadge
          status={quote.status}
          expired={isQuoteExpired(quote)}
        />
      </div>

      <p className="text-lg font-medium">
        Total: {formatCents(totalCents, currency)}
      </p>

      {quoteCustomer && (
        <p className="text-sm">
          For{" "}
          <Link href={`/customers/${quoteCustomer.id}`} className="underline">
            {quoteCustomer.name}
          </Link>
          {quoteSite && (
            <>
              {" · "}
              <Link href={`/sites/${quoteSite.id}`} className="underline">
                {quoteSite.name}
              </Link>
            </>
          )}
          {!quoteSite && quote.oneOffLocation && ` · ${quote.oneOffLocation}`}
        </p>
      )}

      {createdJob && (
        <p className="text-sm">
          <Link href={`/jobs/${createdJob.id}`} className="underline">
            View job #{createdJob.jobNumber}
          </Link>{" "}
          (created when this quote was accepted)
        </p>
      )}

      {quote.status === "accepted" && invoiceAccess.canWrite && (
        <div>
          <Button
            variant="outline"
            render={
              <Link href={`/invoices/new?quoteId=${quote.id}`}>
                Create invoice from this quote
              </Link>
            }
            nativeButton={false}
          />
        </div>
      )}

      <QuoteStatusActions quote={quote} canWrite={access.canWrite} />

      <QuoteForm
        quote={quote}
        customers={customerRows}
        sites={siteRows}
        definitions={definitions}
        customFieldValues={customFieldValues}
        lineItemRows={lineItems.map((item) => ({
          key: item.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: (item.unitPriceCents / 100).toFixed(2),
        }))}
      />

      {invoiceAccess.canRead && (
        <RelatedDocuments
          title="Invoices from this quote"
          items={invoiceItems}
          emptyText="No invoices from this quote yet."
        />
      )}

      <ActivityTimeline entries={activityLog} />

      <QuoteDeleteSection quote={quote} canDelete={access.canDelete} />
    </div>
  );
}
