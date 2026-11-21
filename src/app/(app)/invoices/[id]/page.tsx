import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  companies,
  customers,
  invoiceLineItems,
  invoicePaymentOptions,
  invoices,
  jobs,
  paymentOptions,
  quotes,
  sites,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { getResourceAccess } from "@/lib/auth/permissions";
import { ForbiddenMessage } from "@/components/shared/forbidden-message";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { InvoiceStatusBadge } from "@/components/shared/invoice-status-badge";
import { getActivityLog } from "@/lib/activity-log";
import { getFieldDefinitions, getFieldValues } from "@/lib/custom-fields";
import { isInvoiceOverdue } from "@/lib/invoice-status";
import { computeTotalCents, formatCents } from "@/lib/money";
import { isUuid } from "@/lib/uuid";
import { InvoiceForm } from "../invoice-form";
import { InvoiceStatusActions } from "./invoice-status-actions";
import { InvoiceDeleteSection } from "./delete-section";
import { isEmailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireUser();
  const access = await getResourceAccess(viewer, "invoices");
  if (!access.canRead) return <ForbiddenMessage />;
  if (!isUuid(id)) notFound();

  const db = getDb();
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);
  if (!invoice) notFound();

  const [
    lineItems,
    customerRows,
    siteRows,
    definitions,
    activityLog,
    companyRows,
    optionRows,
    attachedRows,
    jobAccess,
    quoteAccess,
  ] = await Promise.all([
    db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, id))
      .orderBy(invoiceLineItems.sortOrder),
    db.select().from(customers),
    db.select().from(sites),
    getFieldDefinitions("invoice"),
    getActivityLog("invoice", id),
    db.select({ currency: companies.currency }).from(companies).limit(1),
    db
      .select()
      .from(paymentOptions)
      .orderBy(paymentOptions.sortOrder, paymentOptions.createdAt),
    db
      .select({ paymentOptionId: invoicePaymentOptions.paymentOptionId })
      .from(invoicePaymentOptions)
      .where(eq(invoicePaymentOptions.invoiceId, id)),
    getResourceAccess(viewer, "jobs"),
    getResourceAccess(viewer, "quotes"),
    db.select().from(customers).orderBy(asc(customers.name)),
    db.select().from(sites).orderBy(asc(sites.name)),
  ]);
  const customFieldValues = await getFieldValues(id);
  const currency = companyRows[0]?.currency ?? "USD";

  const [fromJob] =
    invoice.jobId && jobAccess.canRead
      ? await db
          .select({ id: jobs.id, jobNumber: jobs.jobNumber })
          .from(jobs)
          .where(eq(jobs.id, invoice.jobId))
          .limit(1)
      : [];
  const [fromQuote] =
    invoice.quoteId && quoteAccess.canRead
      ? await db
          .select({ id: quotes.id, quoteNumber: quotes.quoteNumber })
          .from(quotes)
          .where(eq(quotes.id, invoice.quoteId))
          .limit(1)
      : [];

  const totalCents = computeTotalCents(lineItems);
  const invoiceCustomer = customerRows.find((c) => c.id === invoice.customerId);
  const invoiceSite = invoice.siteId
    ? siteRows.find((s) => s.id === invoice.siteId)
    : undefined;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">
          #{invoice.invoiceNumber} — {invoice.title}
        </h1>
        <InvoiceStatusBadge
          status={invoice.status}
          overdue={isInvoiceOverdue(invoice)}
        />
      </div>

      <p className="text-lg font-medium">
        Total: {formatCents(totalCents, currency)}
        {invoice.dueDate && (
          <span className="text-sm font-normal text-muted-foreground">
            {" "}
            · due {invoice.dueDate}
          </span>
        )}
      </p>
      {invoiceCustomer && (
        <p className="text-sm">
          For{" "}
          <Link href={`/customers/${invoiceCustomer.id}`} className="underline">
            {invoiceCustomer.name}
          </Link>
          {invoiceSite && (
            <>
              {" · "}
              <Link href={`/sites/${invoiceSite.id}`} className="underline">
                {invoiceSite.name}
              </Link>
            </>
          )}
          {!invoiceSite &&
            invoice.oneOffLocation &&
            ` · ${invoice.oneOffLocation}`}
        </p>
      )}
      {invoice.status === "payment_reported" && (
        <p className="rounded-md border border-amber-500/50 p-3 text-sm">
          The customer says they&apos;ve paid. Check your account, then mark the
          invoice as paid — or choose &ldquo;Payment not received&rdquo; if
          nothing has arrived.
        </p>
      )}

      {(fromJob || fromQuote) && (
        <p className="text-sm">
          Created from{" "}
          {fromQuote && (
            <Link href={`/quotes/${fromQuote.id}`} className="underline">
              quote #{fromQuote.quoteNumber}
            </Link>
          )}
          {fromQuote && fromJob && " and "}
          {fromJob && (
            <Link href={`/jobs/${fromJob.id}`} className="underline">
              job #{fromJob.jobNumber}
            </Link>
          )}
        </p>
      )}

      <InvoiceStatusActions
        invoice={invoice}
        canWrite={access.canWrite}
        customerEmail={invoiceCustomer?.email ?? null}
        emailEnabled={isEmailConfigured()}
      />

      <InvoiceForm
        invoice={invoice}
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
        paymentOptions={optionRows}
        attachedOptionIds={attachedRows.map((row) => row.paymentOptionId)}
        canWrite={access.canWrite}
      />

      <ActivityTimeline entries={activityLog} />

      <InvoiceDeleteSection invoice={invoice} canDelete={access.canDelete} />
    </div>
  );
}
