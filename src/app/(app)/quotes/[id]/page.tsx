import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  companies,
  customers,
  quoteLineItems,
  quotes,
  sites,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { getResourceAccess } from "@/lib/auth/permissions";
import { ForbiddenMessage } from "@/components/shared/forbidden-message";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { getActivityLog } from "@/lib/activity-log";
import { getFieldDefinitions, getFieldValues } from "@/lib/custom-fields";
import { computeTotalCents, formatCents } from "@/lib/money";
import { isQuoteExpired } from "@/lib/quote-status";
import { QuoteForm } from "../quote-form";
import { QuoteStatusActions } from "./quote-status-actions";
import { QuoteDeleteSection } from "./delete-section";
import { QuoteStatusBadge } from "@/components/shared/quote-status-badge";
import { isUuid } from "@/lib/uuid";

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
  ] = await Promise.all([
    db
      .select()
      .from(quoteLineItems)
      .where(eq(quoteLineItems.quoteId, id))
      .orderBy(quoteLineItems.sortOrder),
    db.select().from(customers),
    db.select().from(sites),
    getFieldDefinitions("quote"),
    getActivityLog("quote", id),
    db.select({ currency: companies.currency }).from(companies).limit(1),
  ]);
  const customFieldValues = await getFieldValues(id);
  const company = companyRows[0];

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
        Total: {formatCents(totalCents, company?.currency ?? "USD")}
      </p>

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

      <ActivityTimeline entries={activityLog} />

      <QuoteDeleteSection quote={quote} canDelete={access.canDelete} />
    </div>
  );
}
