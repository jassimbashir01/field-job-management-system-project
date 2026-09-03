import Link from "next/link";
import { asc, ilike, or } from "drizzle-orm";
import { getDb } from "@/db";
import { customers } from "@/db/schema";
import { requirePermissionOrRedirect } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-catalog";
import { Button } from "@/components/ui/button";
import { CustomerSearchInput } from "./search-input";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePermissionOrRedirect(PERMISSIONS.CUSTOMERS_MANAGE);
  const { q } = await searchParams;

  const db = getDb();
  const query = q?.trim();
  const rows = await db
    .select()
    .from(customers)
    .where(
      query
        ? or(
            ilike(customers.name, `%${query}%`),
            ilike(customers.companyName, `%${query}%`),
            ilike(customers.phone, `%${query}%`),
            ilike(customers.email, `%${query}%`),
          )
        : undefined,
    )
    .orderBy(asc(customers.name));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Customers</h1>
        <Button
          render={<Link href="/customers/new">New customer</Link>}
          nativeButton={false}
        />
      </div>

      <form method="get" className="mt-4">
        <CustomerSearchInput defaultQuery={query ?? ""} />
      </form>

      <div className="mt-6 divide-y rounded-md border">
        {rows.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            {query ? "No matches." : "No customers yet."}
          </p>
        )}
        {rows.map((customer) => (
          <Link
            key={customer.id}
            href={`/customers/${customer.id}`}
            className="flex items-center justify-between px-4 py-3 text-sm hover:bg-accent"
          >
            <div>
              <p className="font-medium">{customer.name}</p>
              {customer.companyName && (
                <p className="text-xs text-muted-foreground">
                  {customer.companyName}
                </p>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {customer.phone ?? customer.email ?? ""}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
