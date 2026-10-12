import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { companies, customers, quoteLineItems, quotes } from "@/db/schema";
import {
  computeLineTotalCents,
  computeTotalCents,
  formatCents,
} from "@/lib/money";
import { isQuoteExpired } from "@/lib/quote-status";
import { QuoteResponseActions } from "./quote-response-actions";

export const dynamic = "force-dynamic";

async function markViewedIfNeeded(
  quote: typeof quotes.$inferSelect,
): Promise<typeof quotes.$inferSelect> {
  if (quote.status !== "sent") return quote;
  const db = getDb();
  const [updated] = await db
    .update(quotes)
    .set({ status: "viewed", viewedAt: new Date(), updatedAt: new Date() })
    .where(eq(quotes.id, quote.id))
    .returning();
  return updated ?? quote;
}

export default async function PublicQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = getDb();

  const [quoteRow] = await db
    .select()
    .from(quotes)
    .where(eq(quotes.publicToken, token))
    .limit(1);
  if (!quoteRow) {
    notFound();
  }

  if (quoteRow.status === "draft") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">
          This quote isn&apos;t available yet
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It hasn&apos;t been finalised. Please check back shortly or get in
          touch with the sender.
        </p>
      </div>
    );
  }

  const quote = await markViewedIfNeeded(quoteRow);

  const [lineItems, customerRows, companyRows] = await Promise.all([
    db
      .select()
      .from(quoteLineItems)
      .where(eq(quoteLineItems.quoteId, quote.id))
      .orderBy(quoteLineItems.sortOrder),
    db
      .select({ name: customers.name })
      .from(customers)
      .where(eq(customers.id, quote.customerId))
      .limit(1),
    db.select().from(companies).limit(1),
  ]);
  const customerName = customerRows[0]?.name ?? "";
  const company = companyRows[0];
  const totalCents = computeTotalCents(lineItems);
  const expired = isQuoteExpired(quote);
  const alreadyResponded =
    quote.status === "accepted" || quote.status === "declined";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-8 flex items-center gap-3 border-b pb-6">
        {company?.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
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
            {company?.name ?? "Quote"}
          </p>
          {company?.contactEmail && (
            <p className="text-xs text-muted-foreground">
              {company.contactEmail}
            </p>
          )}
        </div>
      </header>

      <h1 className="text-xl font-semibold">
        #{quote.quoteNumber} — {quote.title}
      </h1>
      <p className="text-sm text-muted-foreground">For {customerName}</p>

      <div className="mt-6 divide-y rounded-md border">
        {lineItems.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-3 text-sm"
          >
            <div>
              <p>{item.description}</p>
              <p className="text-xs text-muted-foreground">
                {item.quantity} ×{" "}
                {formatCents(item.unitPriceCents, company?.currency ?? "USD")}
              </p>
            </div>
            <p className="font-medium">
              {formatCents(
                computeLineTotalCents(item),
                company?.currency ?? "USD",
              )}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-right text-lg font-semibold">
        Total: {formatCents(totalCents, company?.currency ?? "USD")}
      </p>

      {quote.notes && (
        <div className="mt-6 border-t pt-4">
          <h2 className="text-sm font-semibold">Notes</h2>
          <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">
            {quote.notes}
          </p>
        </div>
      )}

      <div className="mt-8">
        {alreadyResponded && (
          <p className="rounded-md border p-4 text-center text-sm">
            {quote.status === "accepted"
              ? "Thank you — this quote has been accepted. We'll be in touch to schedule the work."
              : "This quote has been declined. Thank you for considering us."}
          </p>
        )}
        {!alreadyResponded && expired && (
          <p className="rounded-md border p-4 text-center text-sm">
            This quote expired on {quote.expiresAt}. Please get in touch for an
            updated quote.
          </p>
        )}
        {!alreadyResponded && !expired && (
          <QuoteResponseActions token={token} />
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
