import Link from "next/link";
import { desc, eq, ilike, inArray, or } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { companies, customers, invoiceLineItems, invoices } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { getResourceAccess } from "@/lib/auth/permissions";
import { ForbiddenMessage } from "@/components/shared/forbidden-message";
import { InvoiceStatusBadge } from "@/components/shared/invoice-status-badge";
import { isInvoiceOverdue } from "@/lib/invoice-status";
import { computeTotalCents, formatCents } from "@/lib/money";
import { InvoiceSearchInput } from "./search-input";

export const dynamic = "force-dynamic";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const viewer = await requireUser();
  const access = await getResourceAccess(viewer, "invoices");
  if (!access.canRead) return <ForbiddenMessage />;

  const { q } = await searchParams;
  const db = getDb();

  const rows = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      title: invoices.title,
      status: invoices.status,
      dueDate: invoices.dueDate,
      customerName: customers.name,
    })
    .from(invoices)
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .where(
      q
        ? or(ilike(invoices.title, `%${q}%`), ilike(customers.name, `%${q}%`))
        : undefined,
    )
    .orderBy(desc(invoices.createdAt));

  const [lineRows, companyRows] = await Promise.all([
    rows.length > 0
      ? db
          .select()
          .from(invoiceLineItems)
          .where(
            inArray(
              invoiceLineItems.invoiceId,
              rows.map((row) => row.id),
            ),
          )
      : Promise.resolve([]),
    db.select({ currency: companies.currency }).from(companies).limit(1),
  ]);
  const currency = companyRows[0]?.currency ?? "USD";

  const linesByInvoice = new Map<string, typeof lineRows>();
  for (const line of lineRows) {
    const list = linesByInvoice.get(line.invoiceId) ?? [];
    list.push(line);
    linesByInvoice.set(line.invoiceId, list);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Invoices</h1>
        {access.canWrite && (
          <Button
            render={<Link href="/invoices/new">New invoice</Link>}
            nativeButton={false}
          />
        )}
      </div>

      <form method="get" className="mt-4">
        <InvoiceSearchInput defaultQuery={q ?? ""} />
      </form>

      <div className="mt-4 divide-y rounded-md border">
        {rows.map((row) => (
          <Link
            key={row.id}
            href={`/invoices/${row.id}`}
            className="flex items-center justify-between gap-3 p-3 hover:bg-muted/50"
          >
            <div>
              <p className="font-medium">
                #{row.invoiceNumber} — {row.title}
              </p>
              <p className="text-sm text-muted-foreground">
                {row.customerName}
                {row.dueDate && ` · due ${row.dueDate}`}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <InvoiceStatusBadge
                status={row.status}
                overdue={isInvoiceOverdue(row)}
              />
              <span className="text-sm">
                {formatCents(
                  computeTotalCents(linesByInvoice.get(row.id) ?? []),
                  currency,
                )}
              </span>
            </div>
          </Link>
        ))}
        {rows.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No invoices yet.
          </p>
        )}
      </div>
    </div>
  );
}
