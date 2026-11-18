import { count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { invoices, jobs, quotes } from "@/db/schema";

export interface Dependents {
  jobs: number;
  quotes: number;
  invoices: number;
  total: number;
  summary: string;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function build(jobsN: number, quotesN: number, invoicesN: number): Dependents {
  const parts: string[] = [];
  if (jobsN > 0) parts.push(plural(jobsN, "job"));
  if (quotesN > 0) parts.push(plural(quotesN, "quote"));
  if (invoicesN > 0) parts.push(plural(invoicesN, "invoice"));
  const last = parts.at(-1);
  const summary =
    parts.length > 1
      ? `${parts.slice(0, -1).join(", ")} and ${last}`
      : (last ?? "");
  return {
    jobs: jobsN,
    quotes: quotesN,
    invoices: invoicesN,
    total: jobsN + quotesN + invoicesN,
    summary,
  };
}

export async function getCustomerDependents(
  customerId: string,
): Promise<Dependents> {
  const db = getDb();
  const [[j], [q], [i]] = await Promise.all([
    db
      .select({ value: count() })
      .from(jobs)
      .where(eq(jobs.customerId, customerId)),
    db
      .select({ value: count() })
      .from(quotes)
      .where(eq(quotes.customerId, customerId)),
    db
      .select({ value: count() })
      .from(invoices)
      .where(eq(invoices.customerId, customerId)),
  ]);
  return build(
    Number(j?.value ?? 0),
    Number(q?.value ?? 0),
    Number(i?.value ?? 0),
  );
}

export async function getSiteDependents(siteId: string): Promise<Dependents> {
  const db = getDb();
  const [[j], [q], [i]] = await Promise.all([
    db.select({ value: count() }).from(jobs).where(eq(jobs.siteId, siteId)),
    db.select({ value: count() }).from(quotes).where(eq(quotes.siteId, siteId)),
    db
      .select({ value: count() })
      .from(invoices)
      .where(eq(invoices.siteId, siteId)),
  ]);
  return build(
    Number(j?.value ?? 0),
    Number(q?.value ?? 0),
    Number(i?.value ?? 0),
  );
}
