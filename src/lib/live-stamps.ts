import "server-only";
import { and, count, eq, max, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  customers,
  equipment,
  holidayRequests,
  invoices,
  jobChecklistItems,
  jobEquipment,
  jobFiles,
  jobs,
  punches,
  quotes,
  shifts,
  sites,
  users,
} from "@/db/schema";
import type { LiveKey } from "@/lib/live-routes";

type Stamp = Array<{ c: number; m: Date | null }>;
const text = (rows: Stamp) =>
  `${rows[0]?.c ?? 0}:${rows[0]?.m?.toISOString() ?? ""}`;

export async function getLiveStamps(
  readable: ReadonlySet<string>,
): Promise<Partial<Record<LiveKey, string>>> {
  const db = getDb();
  const out: Partial<Record<LiveKey, string>> = {};
  const tasks: Array<Promise<void>> = [];

  const simple = (key: LiveKey, query: () => Promise<Stamp>) => {
    if (!readable.has(key)) return;
    tasks.push(query().then((rows) => void (out[key] = text(rows))));
  };

  simple("customers", () =>
    db.select({ c: count(), m: max(customers.updatedAt) }).from(customers),
  );
  simple("sites", () =>
    db.select({ c: count(), m: max(sites.updatedAt) }).from(sites),
  );
  simple("equipment", () =>
    db.select({ c: count(), m: max(equipment.updatedAt) }).from(equipment),
  );
  simple("holidays", () =>
    db
      .select({ c: count(), m: max(holidayRequests.updatedAt) })
      .from(holidayRequests),
  );
  simple("punch", () =>
    db.select({ c: count(), m: max(punches.updatedAt) }).from(punches),
  );
  simple("quotes", () =>
    db.select({ c: count(), m: max(quotes.updatedAt) }).from(quotes),
  );
  simple("invoices", () =>
    db.select({ c: count(), m: max(invoices.updatedAt) }).from(invoices),
  );

  if (readable.has("rota")) {
    tasks.push(
      Promise.all([
        db.select({ c: count(), m: max(shifts.updatedAt) }).from(shifts),
        db
          .select({ c: count(), m: max(users.updatedAt) })
          .from(users)
          .where(and(eq(users.role, "team_member"), eq(users.isActive, true))),
      ]).then(([s, people]) => {
        out.rota = `${text(s)}|${text(people)}`;
      }),
    );
  }

  if (readable.has("jobs")) {
    tasks.push(
      Promise.all([
        db.select({ c: count(), m: max(jobs.updatedAt) }).from(jobs),
        db
          .select({
            c: count(),
            d: sql<number>`count(*) filter (where ${jobChecklistItems.completed})`,
          })
          .from(jobChecklistItems),
        db.select({ c: count() }).from(jobFiles),
        db.select({ c: count() }).from(jobEquipment),
      ]).then(([j, checklist, files, linked]) => {
        out.jobs = [
          text(j),
          `${checklist[0]?.c ?? 0}/${checklist[0]?.d ?? 0}`,
          files[0]?.c ?? 0,
          linked[0]?.c ?? 0,
        ].join("|");
      }),
    );
  }

  await Promise.all(tasks);
  return out;
}

export async function getPublicStamp(
  kind: "quote" | "invoice",
  token: string,
): Promise<string | null> {
  const db = getDb();
  if (kind === "quote") {
    const [row] = await db
      .select({ status: quotes.status, updatedAt: quotes.updatedAt })
      .from(quotes)
      .where(eq(quotes.publicToken, token))
      .limit(1);
    return row ? `${row.status}:${row.updatedAt.toISOString()}` : null;
  }
  const [row] = await db
    .select({ status: invoices.status, updatedAt: invoices.updatedAt })
    .from(invoices)
    .where(eq(invoices.publicToken, token))
    .limit(1);
  return row ? `${row.status}:${row.updatedAt.toISOString()}` : null;
}
