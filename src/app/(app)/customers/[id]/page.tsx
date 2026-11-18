import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  customerContacts,
  customers,
  invoices,
  jobs,
  quotes,
  sites,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { getResourceAccess } from "@/lib/auth/permissions";
import { getFieldDefinitions, getFieldValues } from "@/lib/custom-fields";
import { getCustomerDependents } from "@/lib/dependents";
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
import { CustomerForm } from "../customer-form";
import { ContactsSection, CustomerDeleteSection } from "./contacts-and-delete";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireUser();
  const access = await getResourceAccess(viewer, "customers");
  if (!access.canRead) {
    return <ForbiddenMessage />;
  }

  const { id } = await params;
  if (!isUuid(id)) notFound();

  const db = getDb();
  const rows = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);
  const customer = rows[0];
  if (!customer) {
    notFound();
  }

  const [quoteAccess, invoiceAccess] = await Promise.all([
    getResourceAccess(viewer, "quotes"),
    getResourceAccess(viewer, "invoices"),
  ]);

  const [
    definitions,
    fieldValues,
    contacts,
    customerSites,
    customerJobs,
    customerQuotes,
    customerInvoices,
    dependents,
    currency,
  ] = await Promise.all([
    getFieldDefinitions("customer"),
    getFieldValues(customer.id),
    db
      .select()
      .from(customerContacts)
      .where(eq(customerContacts.customerId, customer.id))
      .orderBy(asc(customerContacts.name)),
    db
      .select()
      .from(sites)
      .where(eq(sites.customerId, customer.id))
      .orderBy(asc(sites.name)),
    db
      .select({
        id: jobs.id,
        jobNumber: jobs.jobNumber,
        title: jobs.title,
        status: jobs.status,
      })
      .from(jobs)
      .where(eq(jobs.customerId, customer.id))
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
          .where(eq(quotes.customerId, customer.id))
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
          .where(eq(invoices.customerId, customer.id))
          .orderBy(desc(invoices.createdAt))
          .limit(10)
      : Promise.resolve([]),
    getCustomerDependents(customer.id),
    getCompanyCurrency(),
  ]);

  const [quoteTotals, invoiceTotals] = await Promise.all([
    getQuoteTotals(customerQuotes.map((q) => q.id)),
    getInvoiceTotals(customerInvoices.map((i) => i.id)),
  ]);

  const quoteItems: RelatedItem[] = customerQuotes.map((q) => ({
    id: q.id,
    href: `/quotes/${q.id}`,
    label: `#${q.quoteNumber} — ${q.title}`,
    badge: <QuoteStatusBadge status={q.status} expired={isQuoteExpired(q)} />,
    amount: formatCents(quoteTotals.get(q.id) ?? 0, currency),
  }));
  const invoiceItems: RelatedItem[] = customerInvoices.map((i) => ({
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
    ...customerJobs.map((j) => ({
      href: `/jobs/${j.id}`,
      label: `Job #${j.jobNumber} — ${j.title}`,
    })),
    ...customerQuotes.map((q) => ({
      href: `/quotes/${q.id}`,
      label: `Quote #${q.quoteNumber} — ${q.title}`,
    })),
    ...customerInvoices.map((i) => ({
      href: `/invoices/${i.id}`,
      label: `Invoice #${i.invoiceNumber} — ${i.title}`,
    })),
  ];

  return (
    <div className="max-w-lg space-y-10">
      <div>
        <h1 className="text-xl font-semibold">{customer.name}</h1>
        {!access.canWrite && (
          <p className="mt-1 text-sm text-muted-foreground">
            You have read-only access to Customers.
          </p>
        )}
        <CustomerForm
          customer={customer}
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
              <Link href={`/jobs/new?customerId=${customer.id}`}>New job</Link>
            }
            nativeButton={false}
          />
        </div>
        {customerJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No jobs yet.</p>
        ) : (
          <div className="divide-y rounded-md border">
            {customerJobs.map((job) => (
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
              ? `/quotes/new?customerId=${customer.id}`
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
              ? `/invoices/new?customerId=${customer.id}`
              : undefined
          }
          newLabel="New invoice"
        />
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Sites</h2>
          {access.canWrite && (
            <Button
              variant="outline"
              size="sm"
              render={
                <Link href={`/sites/new?customerId=${customer.id}`}>
                  Add site
                </Link>
              }
              nativeButton={false}
            />
          )}
        </div>
        {customerSites.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sites yet.</p>
        ) : (
          <div className="divide-y rounded-md border">
            {customerSites.map((site) => (
              <Link
                key={site.id}
                href={`/sites/${site.id}`}
                className="block px-4 py-2 text-sm hover:bg-accent"
              >
                <p className="font-medium">{site.name}</p>
                {site.addressLine1 && (
                  <p className="text-xs text-muted-foreground">
                    {site.addressLine1}
                    {site.city && `, ${site.city}`}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      <ContactsSection
        customerId={customer.id}
        contacts={contacts}
        canWrite={access.canWrite}
      />
      <CustomerDeleteSection
        customer={customer}
        canDelete={access.canDelete}
        blockers={blockers}
        blockersTotal={dependents.total}
        blockersSummary={dependents.summary}
      />
    </div>
  );
}
