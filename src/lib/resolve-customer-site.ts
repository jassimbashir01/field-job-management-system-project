import { type getDb } from "@/db";
import { customers, sites } from "@/db/schema";
import { ConflictError, ValidationError } from "@/lib/errors";

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

/** Resolves a selected customerId, or creates a customer from the
 *  newCustomer* fields. Always call inside the caller's transaction. */
export async function resolveCustomerId(
  tx: Tx,
  formData: FormData,
): Promise<string> {
  const newName = formData.get("newCustomerName");
  if (newName && String(newName).trim()) {
    const [created] = await tx
      .insert(customers)
      .values({
        name: String(newName).trim(),
        phone: (formData.get("newCustomerPhone") as string) || null,
        email: (formData.get("newCustomerEmail") as string) || null,
      })
      .returning();
    if (!created) throw new ConflictError("Could not create the new customer.");
    return created.id;
  }

  const existingId = formData.get("customerId");
  if (typeof existingId !== "string" || !existingId) {
    throw new ValidationError("A customer is required.");
  }
  return existingId;
}

export async function resolveSiteId(
  tx: Tx,
  formData: FormData,
  customerId: string,
): Promise<string | null> {
  const newName = formData.get("newSiteName");
  if (newName && String(newName).trim()) {
    const [created] = await tx
      .insert(sites)
      .values({
        customerId,
        name: String(newName).trim(),
        addressLine1: (formData.get("newSiteAddressLine1") as string) || null,
        city: (formData.get("newSiteCity") as string) || null,
        postalCode: (formData.get("newSitePostalCode") as string) || null,
      })
      .returning();
    if (!created) throw new ConflictError("Could not create the new site.");
    return created.id;
  }

  const existingId = formData.get("siteId");
  return typeof existingId === "string" && existingId ? existingId : null;
}
