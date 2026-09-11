import { requireUser } from "@/lib/auth/guards";
import { getResourceAccess } from "@/lib/auth/permissions";
import { getFieldDefinitions } from "@/lib/custom-fields";
import { ForbiddenMessage } from "@/components/shared/forbidden-message";
import { CustomerForm } from "../customer-form";

export default async function NewCustomerPage() {
  const viewer = await requireUser();
  const access = await getResourceAccess(viewer, "customers");
  if (!access.canWrite) {
    return <ForbiddenMessage />;
  }

  const definitions = await getFieldDefinitions("customer");

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold">New customer</h1>
      <CustomerForm definitions={definitions} />
    </div>
  );
}
