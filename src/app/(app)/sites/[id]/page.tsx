import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  customers,
  equipment,
  invoices,
  jobs,
  quotes,
  sites,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { getResourceAccess } from "@/lib/auth/permissions";
import { getFieldDefinitions, getFieldValues } from "@/lib/custom-fields";
import { getSiteDependents } from "@/lib/dependents";
import {
  getCompanyCurrency,
  getInvoiceTotals,
  getQuoteTotals,
} from "@/lib/document-totals";
import { isInvoiceOverdue } from "@/lib/invoice-status";
import { formatCents } from "@/lib/money";
import { isQuoteExpired } from "@/lib/quote-status";
import { isUuid } from "@/lib/uuid";
import { Button } from "@/components/ui/button";
import { ForbiddenMessage } from "@/components/shared/forbidden-message";
import { InvoiceStatusBadge } from "@/components/shared/invoice-status-badge";
import { JobStatusBadge } from "@/components/shared/job-status-badge";
import { QuoteStatusBadge } from "@/components/shared/quote-status-badge";
import {
  RelatedDocuments,
  type RelatedItem,
} from "@/components/shared/related-documents";
import { SiteForm } from "../site-form";
import { SiteDeleteSection } from "./delete-section";

export const dynamic = "force-dynamic";

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireUser();
  const access = await getResourceAccess(viewer, "sites");
  if (!access.canRead) {
    return <ForbiddenMessage />;
  }

  const { id } = await params;
  if (!isUuid(id)) notFound();

  const db = getDb();
  const rows = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
  const site = rows[0];
  if (!site) {
    notFound();
  }

  const [quoteAccess, invoiceAccess] = await Promise.all([
    getResourceAccess(viewer, "quotes"),
    getResourceAccess(viewer, "invoices"),
  ]);

  const [
    allCustomers,
    definitions,
    fieldValues,
    siteEquipment,
    siteJobs,
    siteQuotes,
    siteInvoices,
    dependents,
    currency,
  ] = await Promise.all([
    db.select().from(customers).orderBy(asc(customers.name)),
    getFieldDefinitions("site"),
    getFieldValues(site.id),
    db
      .select()
      .from(equipment)
      .where(eq(equipment.siteId, site.id))
      .orderBy(asc(equipment.name)),
    db
      .select({
        id: jobs.id,
        jobNumber: jobs.jobNumber,
        title: jobs.title,
        status: jobs.status,
      })
      .from(jobs)
      .where(eq(jobs.siteId, site.id))
      .orderBy(desc(jobs.createdAt))
      .limit(10),
    quoteAccess.canRead
      ? db
          .select({
            id: quotes.id,
            quoteNumber: quotes.quoteNumber,
            title: quotes.title,
            status: quotes.status,
            expiresAt: quotes.expiresAt,
          })
          .from(quotes)
          .where(eq(quotes.siteId, site.id))
          .orderBy(desc(quotes.createdAt))
          .limit(10)
      : Promise.resolve([]),
    invoiceAccess.canRead
      ? db
          .select({
            id: invoices.id,
            invoiceNumber: invoices.invoiceNumber,
            title: invoices.title,
            status: invoices.status,
            dueDate: invoices.dueDate,
          })
          .from(invoices)
          .where(eq(invoices.siteId, site.id))
          .orderBy(desc(invoices.createdAt))
          .limit(10)
      : Promise.resolve([]),
    getSiteDependents(site.id),
    getCompanyCurrency(),
  ]);

  const [quoteTotals, invoiceTotals] = await Promise.all([
    getQuoteTotals(siteQuotes.map((q) => q.id)),
    getInvoiceTotals(siteInvoices.map((i) => i.id)),
  ]);

  const quoteItems: RelatedItem[] = siteQuotes.map((q) => ({
    id: q.id,
    href: `/quotes/${q.id}`,
    label: `#${q.quoteNumber} — ${q.title}`,
    badge: <QuoteStatusBadge status={q.status} expired={isQuoteExpired(q)} />,
    amount: formatCents(quoteTotals.get(q.id) ?? 0, currency),
  }));
  const invoiceItems: RelatedItem[] = siteInvoices.map((i) => ({
    id: i.id,
    href: `/invoices/${i.id}`,
    label: `#${i.invoiceNumber} — ${i.title}`,
    sublabel: i.dueDate ? `Due ${i.dueDate}` : undefined,
    badge: (
      <InvoiceStatusBadge status={i.status} overdue={isInvoiceOverdue(i)} />
    ),
    amount: formatCents(invoiceTotals.get(i.id) ?? 0, currency),
  }));

  const blockers = [
    ...siteJobs.map((j) => ({
      href: `/jobs/${j.id}`,
      label: `Job #${j.jobNumber} — ${j.title}`,
    })),
    ...siteQuotes.map((q) => ({
      href: `/quotes/${q.id}`,
      label: `Quote #${q.quoteNumber} — ${q.title}`,
    })),
    ...siteInvoices.map((i) => ({
      href: `/invoices/${i.id}`,
      label: `Invoice #${i.invoiceNumber} — ${i.title}`,
    })),
  ];

  return (
    <div className="max-w-lg space-y-10">
      <div>
        <h1 className="text-xl font-semibold">{site.name}</h1>
        {!access.canWrite && (
          <p className="mt-1 text-sm text-muted-foreground">
            You have read-only access to Sites.
          </p>
        )}
        <SiteForm
          site={site}
          customers={allCustomers}
          definitions={definitions}
          customFieldValues={fieldValues}
          readOnly={!access.canWrite}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent jobs</h2>
          <Button
            variant="outline"
            size="sm"
            render={
              <Link
                href={`/jobs/new?customerId=${site.customerId}&siteId=${site.id}`}
              >
                New job
              </Link>
            }
            nativeButton={false}
          />
        </div>
        {siteJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No jobs yet.</p>
        ) : (
          <div className="divide-y rounded-md border">
            {siteJobs.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="flex items-center justify-between px-4 py-2 text-sm hover:bg-accent"
              >
                <p className="font-medium">
                  #{job.jobNumber} — {job.title}
                </p>
                <JobStatusBadge status={job.status} />
              </Link>
            ))}
          </div>
        )}
      </div>

      {quoteAccess.canRead && (
        <RelatedDocuments
          title="Quotes"
          items={quoteItems}
          emptyText="No quotes yet."
          newHref={
            quoteAccess.canWrite
              ? `/quotes/new?customerId=${site.customerId}&siteId=${site.id}`
              : undefined
          }
          newLabel="New quote"
        />
      )}

      {invoiceAccess.canRead && (
        <RelatedDocuments
          title="Invoices"
          items={invoiceItems}
          emptyText="No invoices yet."
          newHref={
            invoiceAccess.canWrite
              ? `/invoices/new?customerId=${site.customerId}&siteId=${site.id}`
              : undefined
          }
          newLabel="New invoice"
        />
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Equipment</h2>
          {access.canWrite && (
            <Button
              variant="outline"
              size="sm"
              render={
                <Link href={`/equipment/new?siteId=${site.id}`}>
                  Add equipment
                </Link>
              }
              nativeButton={false}
            />
          )}
        </div>
        {siteEquipment.length === 0 ? (
          <p className="text-sm text-muted-foreground">No equipment yet.</p>
        ) : (
          <div className="divide-y rounded-md border">
            {siteEquipment.map((item) => (
              <Link
                key={item.id}
                href={`/equipment/${item.id}`}
                className="block px-4 py-2 text-sm hover:bg-accent"
              >
                <p className="font-medium">{item.name}</p>
                {(item.manufacturer || item.model) && (
                  <p className="text-xs text-muted-foreground">
                    {item.manufacturer} {item.model}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      <SiteDeleteSection
        site={site}
        canDelete={access.canDelete}
        blockers={blockers}
        blockersTotal={dependents.total}
        blockersSummary={dependents.summary}
      />
    </div>
  );
}
