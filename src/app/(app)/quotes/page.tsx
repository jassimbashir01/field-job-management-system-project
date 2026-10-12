import Link from "next/link";
import { desc, eq, ilike, or } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { customers, quotes } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { getResourceAccess } from "@/lib/auth/permissions";
import { ForbiddenMessage } from "@/components/shared/forbidden-message";
import { QuoteStatusBadge } from "@/components/shared/quote-status-badge";
import { isQuoteExpired } from "@/lib/quote-status";
import { QuoteSearchInput } from "./search-input";

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const viewer = await requireUser();
  const access = await getResourceAccess(viewer, "quotes");
  if (!access.canRead) return <ForbiddenMessage />;

  const { q } = await searchParams;
  const db = getDb();

  const rows = await db
    .select({
      id: quotes.id,
      quoteNumber: quotes.quoteNumber,
      title: quotes.title,
      status: quotes.status,
      customerName: customers.name,
      expiresAt: quotes.expiresAt,
    })
    .from(quotes)
    .innerJoin(customers, eq(quotes.customerId, customers.id))
    .where(
      q
        ? or(ilike(quotes.title, `%${q}%`), ilike(customers.name, `%${q}%`))
        : undefined,
    )
    .orderBy(desc(quotes.createdAt));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Quotes</h1>
        {access.canWrite && (
          <Button
            render={<Link href="/quotes/new">New quote</Link>}
            nativeButton={false}
          />
        )}
      </div>

      <form method="get" className="mt-4">
        <QuoteSearchInput defaultQuery={q ?? ""} />
      </form>

      <div className="mt-4 divide-y rounded-md border">
        {rows.map((row) => (
          <Link
            key={row.id}
            href={`/quotes/${row.id}`}
            className="flex items-center justify-between p-3 hover:bg-muted/50"
          >
            <div>
              <p className="font-medium">
                #{row.quoteNumber} — {row.title}
              </p>
              <p className="text-sm text-muted-foreground">
                {row.customerName}
              </p>
            </div>
            <QuoteStatusBadge
              status={row.status}
              expired={isQuoteExpired(row)}
            />
          </Link>
        ))}
        {rows.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No quotes yet.
          </p>
        )}
      </div>
    </div>
  );
}
