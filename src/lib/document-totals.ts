import { inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { companies, invoiceLineItems, quoteLineItems } from "@/db/schema";
import { computeTotalCents } from "@/lib/money";

export async function getCompanyCurrency(): Promise<string> {
  const db = getDb();
  const rows = await db
    .select({ currency: companies.currency })
    .from(companies)
    .limit(1);
  return rows[0]?.currency ?? "USD";
}

export async function getQuoteTotals(
  quoteIds: string[],
): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (quoteIds.length === 0) return totals;

  const db = getDb();
  const rows = await db
    .select()
    .from(quoteLineItems)
    .where(inArray(quoteLineItems.quoteId, quoteIds));

  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = grouped.get(row.quoteId) ?? [];
    list.push(row);
    grouped.set(row.quoteId, list);
  }
  for (const [quoteId, lines] of grouped) {
    totals.set(quoteId, computeTotalCents(lines));
  }
  return totals;
}

export async function getInvoiceTotals(
  invoiceIds: string[],
): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (invoiceIds.length === 0) return totals;

  const db = getDb();
  const rows = await db
    .select()
    .from(invoiceLineItems)
    .where(inArray(invoiceLineItems.invoiceId, invoiceIds));

  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = grouped.get(row.invoiceId) ?? [];
    list.push(row);
    grouped.set(row.invoiceId, list);
  }
  for (const [invoiceId, lines] of grouped) {
    totals.set(invoiceId, computeTotalCents(lines));
  }
  return totals;
}
