import { requirePermissionOrRedirect } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-catalog";
import { getFieldDefinitions } from "@/lib/custom-fields";
import { CustomerForm } from "../customer-form";

export default async function NewCustomerPage() {
  await requirePermissionOrRedirect(PERMISSIONS.CUSTOMERS_MANAGE);
  const definitions = await getFieldDefinitions("customer");

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold">New customer</h1>
      <CustomerForm definitions={definitions} />
    </div>
  );
}
