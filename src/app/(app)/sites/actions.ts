"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { getDb } from "@/db";
import { customFieldValues, sites } from "@/db/schema";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-catalog";
import {
  getFieldDefinitions,
  setFieldValues,
  type CustomFieldValue,
} from "@/lib/custom-fields";
import { ConflictError, toSafeError, type SafeError } from "@/lib/errors";

const siteSchema = z.object({
  customerId: z.uuid(),
  name: z.string().min(1, "Name is required"),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  accessNotes: z.string().optional(),
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

export async function createSiteAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  let newSiteId: string;

  try {
    await requirePermission(PERMISSIONS.SITES_MANAGE);

    const parsed = siteSchema.safeParse(Object.fromEntries(formData.entries()));
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
      .insert(sites)
      .values({
        customerId: parsed.data.customerId,
        name: parsed.data.name,
        addressLine1: parsed.data.addressLine1 || null,
        addressLine2: parsed.data.addressLine2 || null,
        city: parsed.data.city || null,
        region: parsed.data.region || null,
        postalCode: parsed.data.postalCode || null,
        country: parsed.data.country || null,
        accessNotes: parsed.data.accessNotes || null,
      })
      .returning();

    if (!created) {
      throw new ConflictError("Insert did not return the created site row");
    }
    newSiteId = created.id;

    const definitions = await getFieldDefinitions("site");
    if (definitions.length > 0) {
      const values = extractCustomFieldValues(formData, definitions);
      await setFieldValues(newSiteId, values);
    }
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }

  redirect(`/sites/${newSiteId}`);
}

export async function updateSiteAction(
  siteId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await requirePermission(PERMISSIONS.SITES_MANAGE);

    const parsed = siteSchema.safeParse(Object.fromEntries(formData.entries()));
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
      .update(sites)
      .set({
        name: parsed.data.name,
        addressLine1: parsed.data.addressLine1 || null,
        addressLine2: parsed.data.addressLine2 || null,
        city: parsed.data.city || null,
        region: parsed.data.region || null,
        postalCode: parsed.data.postalCode || null,
        country: parsed.data.country || null,
        accessNotes: parsed.data.accessNotes || null,
        updatedAt: new Date(),
      })
      .where(eq(sites.id, siteId));

    const definitions = await getFieldDefinitions("site");
    if (definitions.length > 0) {
      const values = extractCustomFieldValues(formData, definitions);
      await setFieldValues(siteId, values);
    }

    revalidatePath(`/sites/${siteId}`);
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}

export async function deleteSiteAction(siteId: string): Promise<FormState> {
  try {
    await requirePermission(PERMISSIONS.SITES_MANAGE);

    const db = getDb();
    await db.transaction(async (tx) => {
      await tx
        .delete(customFieldValues)
        .where(eq(customFieldValues.entityId, siteId));
      await tx.delete(sites).where(eq(sites.id, siteId));
    });

    revalidatePath("/sites");
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }

  redirect("/sites");
}
