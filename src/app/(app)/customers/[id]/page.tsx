import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { customerContacts, customers, sites } from "@/db/schema";
import { requirePermissionOrRedirect } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-catalog";
import { getFieldDefinitions, getFieldValues } from "@/lib/custom-fields";
import { Button } from "@/components/ui/button";
import { CustomerForm } from "../customer-form";
import { ContactsSection, CustomerDeleteSection } from "./contacts-and-delete";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermissionOrRedirect(PERMISSIONS.CUSTOMERS_MANAGE);
  const { id } = await params;

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

  const [definitions, fieldValues, contacts, customerSites] = await Promise.all(
    [
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
    ],
  );

  return (
    <div className="max-w-lg space-y-10">
      <div>
        <h1 className="text-xl font-semibold">{customer.name}</h1>
        <CustomerForm
          customer={customer}
          definitions={definitions}
          customFieldValues={fieldValues}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Sites</h2>
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

      <ContactsSection customerId={customer.id} contacts={contacts} />
      <CustomerDeleteSection customer={customer} />
    </div>
  );
}
