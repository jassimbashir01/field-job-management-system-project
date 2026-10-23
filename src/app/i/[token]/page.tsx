/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  companies,
  customers,
  invoiceLineItems,
  invoicePaymentOptions,
  invoices,
  paymentOptions,
} from "@/db/schema";
import { isInvoiceOverdue } from "@/lib/invoice-status";
import {
  computeLineTotalCents,
  computeTotalCents,
  formatCents,
} from "@/lib/money";
import { InvoiceResponseActions } from "./invoice-response-actions";

export const dynamic = "force-dynamic";

async function markViewedIfNeeded(
  invoice: typeof invoices.$inferSelect,
): Promise<typeof invoices.$inferSelect> {
  if (invoice.status !== "sent") return invoice;
  const db = getDb();
  const [updated] = await db
    .update(invoices)
    .set({ status: "viewed", viewedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(invoices.id, invoice.id), eq(invoices.status, "sent")))
    .returning();
  return updated ?? invoice;
}

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = getDb();

  const [invoiceRow] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.publicToken, token))
    .limit(1);
  if (!invoiceRow) {
    notFound();
  }

  if (invoiceRow.status === "draft") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">
          This invoice isn&apos;t available yet
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It hasn&apos;t been finalised. Please check back shortly or get in
          touch with the sender.
        </p>
      </div>
    );
  }

  if (invoiceRow.status === "void") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">
          This invoice has been cancelled
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Nothing is owed on it. If you weren&apos;t expecting this, please get
          in touch with the sender.
        </p>
      </div>
    );
  }

  const invoice = await markViewedIfNeeded(invoiceRow);
  const awaitingPayment =
    invoice.status === "sent" || invoice.status === "viewed";

  const [lineItems, customerRows, companyRows, options] = await Promise.all([
    db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, invoice.id))
      .orderBy(invoiceLineItems.sortOrder),
    db
      .select({ name: customers.name })
      .from(customers)
      .where(eq(customers.id, invoice.customerId))
      .limit(1),
    db.select().from(companies).limit(1),
    awaitingPayment
      ? db
          .select({
            id: paymentOptions.id,
            label: paymentOptions.label,
            details: paymentOptions.details,
            url: paymentOptions.url,
          })
          .from(invoicePaymentOptions)
          .innerJoin(
            paymentOptions,
            eq(invoicePaymentOptions.paymentOptionId, paymentOptions.id),
          )
          .where(eq(invoicePaymentOptions.invoiceId, invoice.id))
          .orderBy(asc(paymentOptions.sortOrder), asc(paymentOptions.createdAt))
      : Promise.resolve([]),
  ]);
  const customerName = customerRows[0]?.name ?? "";
  const company = companyRows[0];
  const currency = company?.currency ?? "USD";
  const totalCents = computeTotalCents(lineItems);
  const overdue = isInvoiceOverdue(invoice);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-8 flex items-center gap-3 border-b pb-6">
        {company?.logoUrl && (
          <img
            src={company.logoUrl}
            alt={company.name}
            className="h-10 w-auto"
          />
        )}
        <div>
          <p
            className="font-semibold"
            style={{ color: company?.primaryColor || undefined }}
          >
            {company?.name ?? "Invoice"}
          </p>
          {company?.contactEmail && (
            <p className="text-xs text-muted-foreground">
              {company.contactEmail}
            </p>
          )}
        </div>
      </header>

      <h1 className="text-xl font-semibold">
        Invoice #{invoice.invoiceNumber} — {invoice.title}
      </h1>
      <p className="text-sm text-muted-foreground">
        For {customerName}
        {invoice.dueDate && ` · due ${invoice.dueDate}`}
      </p>

      <div className="mt-6 divide-y rounded-md border">
        {lineItems.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-3 text-sm"
          >
            <div>
              <p>{item.description}</p>
              <p className="text-xs text-muted-foreground">
                {item.quantity} × {formatCents(item.unitPriceCents, currency)}
              </p>
            </div>
            <p className="font-medium">
              {formatCents(computeLineTotalCents(item), currency)}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-right text-lg font-semibold">
        Total: {formatCents(totalCents, currency)}
      </p>

      {invoice.notes && (
        <div className="mt-6 border-t pt-4">
          <h2 className="text-sm font-semibold">Notes</h2>
          <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">
            {invoice.notes}
          </p>
        </div>
      )}

      <div className="mt-8 space-y-6">
        {invoice.status === "paid" && (
          <p className="rounded-md border p-4 text-center text-sm">
            <strong>Paid — thank you.</strong>
            {invoice.paidAt &&
              ` Payment was confirmed on ${invoice.paidAt.toISOString().slice(0, 10)}.`}
          </p>
        )}

        {invoice.status === "payment_reported" && (
          <p className="rounded-md border p-4 text-center text-sm">
            Thank you — we&apos;re confirming your payment. Please check back
            shortly.
          </p>
        )}

        {awaitingPayment && (
          <>
            {overdue && (
              <p className="rounded-md border border-amber-500/50 p-3 text-sm">
                This invoice is past its due date.
              </p>
            )}

            <section>
              <h2 className="text-sm font-semibold">How to pay</h2>
              {options.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Please get in touch with the sender to arrange payment.
                </p>
              ) : (
                <div className="mt-2 space-y-3">
                  {options.map((option) => (
                    <div
                      key={option.id}
                      className="rounded-md border p-3 text-sm"
                    >
                      <p className="font-medium">{option.label}</p>
                      {option.details && (
                        <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                          {option.details}
                        </p>
                      )}
                      {option.url && /^https:\/\//i.test(option.url) && (
                        <a
                          href={option.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-block underline"
                        >
                          Open payment link
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-sm font-semibold">Already paid?</h2>
              <p className="mt-1 mb-2 text-sm text-muted-foreground">
                Pay using one of the options above, then come back and let us
                know. We&apos;ll confirm it on our side.
              </p>
              <InvoiceResponseActions token={token} />
            </section>
          </>
        )}
      </div>

      <footer className="mt-10 border-t pt-4 text-center text-xs text-muted-foreground">
        {company?.contactPhone && <p>{company.contactPhone}</p>}
        {company?.developerCreditText && (
          <p className="mt-2">
            {company.developerCreditUrl ? (
              <a href={company.developerCreditUrl} className="underline">
                {company.developerCreditText}
              </a>
            ) : (
              company.developerCreditText
            )}
          </p>
        )}
      </footer>
    </div>
  );
}
