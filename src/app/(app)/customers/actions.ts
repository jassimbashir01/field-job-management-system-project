"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import * as z from "zod";
import { getDb } from "@/db";
import {
  customFieldValues,
  customerContacts,
  customers,
  sites,
} from "@/db/schema";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-catalog";
import {
  getFieldDefinitions,
  setFieldValues,
  type CustomFieldValue,
} from "@/lib/custom-fields";
import { ConflictError, toSafeError, type SafeError } from "@/lib/errors";

const customerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  companyName: z.string().optional(),
  phone: z.string().optional(),
  email: z.union([z.email(), z.literal("")]).optional(),
  notes: z.string().optional(),
});

export interface FormState {
  success: boolean;
  error: SafeError | null;
}

function extractCustomFieldValues(
  formData: FormData,
  definitions: { id: string; fieldType: string }[],
): Map<string, CustomFieldValue> {
  const values = new Map<string, CustomFieldValue>();

  for (const definition of definitions) {
    const name = `custom_${definition.id}`;

    switch (definition.fieldType) {
      case "boolean":
        values.set(definition.id, formData.get(name) === "on");
        break;
      case "multi_select":
        values.set(definition.id, formData.getAll(name).map(String));
        break;
      case "number":
      case "decimal": {
        const raw = formData.get(name);
        values.set(definition.id, raw ? Number(raw) : null);
        break;
      }
      case "measurement": {
        const rawValue = formData.get(`${name}_value`);
        const unit = formData.get(`${name}_unit`);
        values.set(
          definition.id,
          rawValue
            ? { value: Number(rawValue), unit: String(unit ?? "") }
            : null,
        );
        break;
      }
      default: {
        const raw = formData.get(name);
        values.set(definition.id, raw ? String(raw) : null);
      }
    }
  }

  return values;
}

export async function createCustomerAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  let newCustomerId: string;

  try {
    await requirePermission(PERMISSIONS.CUSTOMERS_MANAGE);

    const parsed = customerSchema.safeParse(
      Object.fromEntries(formData.entries()),
    );
    if (!parsed.success) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Invalid input",
        },
      };
    }

    const db = getDb();
    const [created] = await db
      .insert(customers)
      .values({
        name: parsed.data.name,
        companyName: parsed.data.companyName || null,
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        notes: parsed.data.notes || null,
      })
      .returning();

    if (!created) {
      throw new ConflictError("Insert did not return the created customer row");
    }
    newCustomerId = created.id;

    const definitions = await getFieldDefinitions("customer");
    if (definitions.length > 0) {
      const values = extractCustomFieldValues(formData, definitions);
      await setFieldValues(newCustomerId, values);
    }
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }

  redirect(`/customers/${newCustomerId}`);
}

export async function updateCustomerAction(
  customerId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await requirePermission(PERMISSIONS.CUSTOMERS_MANAGE);

    const parsed = customerSchema.safeParse(
      Object.fromEntries(formData.entries()),
    );
    if (!parsed.success) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Invalid input",
        },
      };
    }

    const db = getDb();
    await db
      .update(customers)
      .set({
        name: parsed.data.name,
        companyName: parsed.data.companyName || null,
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        notes: parsed.data.notes || null,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customerId));

    const definitions = await getFieldDefinitions("customer");
    if (definitions.length > 0) {
      const values = extractCustomFieldValues(formData, definitions);
      await setFieldValues(customerId, values);
    }

    revalidatePath(`/customers/${customerId}`);
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}

export async function deleteCustomerAction(
  customerId: string,
): Promise<FormState> {
  try {
    await requirePermission(PERMISSIONS.CUSTOMERS_MANAGE);

    const db = getDb();
    await db.transaction(async (tx) => {
      const customerSites = await tx
        .select({ id: sites.id })
        .from(sites)
        .where(eq(sites.customerId, customerId));

      const entityIdsToClean = [customerId, ...customerSites.map((s) => s.id)];

      await tx
        .delete(customFieldValues)
        .where(inArray(customFieldValues.entityId, entityIdsToClean));
      await tx.delete(customers).where(eq(customers.id, customerId));
    });

    revalidatePath("/customers");
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }

  redirect("/customers");
}

const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  title: z.string().optional(),
  phone: z.string().optional(),
  email: z.union([z.email(), z.literal("")]).optional(),
});

export async function addContactAction(
  customerId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await requirePermission(PERMISSIONS.CUSTOMERS_MANAGE);

    const parsed = contactSchema.safeParse(
      Object.fromEntries(formData.entries()),
    );
    if (!parsed.success) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Invalid input",
        },
      };
    }

    const db = getDb();
    await db.insert(customerContacts).values({
      customerId,
      name: parsed.data.name,
      title: parsed.data.title || null,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
    });

    revalidatePath(`/customers/${customerId}`);
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}

export async function removeContactAction(
  customerId: string,
  contactId: string,
): Promise<void> {
  await requirePermission(PERMISSIONS.CUSTOMERS_MANAGE);
  const db = getDb();
  await db.delete(customerContacts).where(eq(customerContacts.id, contactId));
  revalidatePath(`/customers/${customerId}`);
}
