import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { customerContacts, customers } from "@/db/schema";
import { requirePermissionOrRedirect } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-catalog";
import { getFieldDefinitions, getFieldValues } from "@/lib/custom-fields";
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

  const [definitions, fieldValues, contacts] = await Promise.all([
    getFieldDefinitions("customer"),
    getFieldValues(customer.id),
    db
      .select()
      .from(customerContacts)
      .where(eq(customerContacts.customerId, customer.id))
      .orderBy(asc(customerContacts.name)),
  ]);

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
      <ContactsSection customerId={customer.id} contacts={contacts} />
      <CustomerDeleteSection customer={customer} />
    </div>
  );
}
