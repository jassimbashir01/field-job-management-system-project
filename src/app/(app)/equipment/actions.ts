"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { getDb } from "@/db";
import { customFieldValues, equipment } from "@/db/schema";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-catalog";
import {
  getFieldDefinitions,
  setFieldValues,
  type CustomFieldValue,
} from "@/lib/custom-fields";
import { ConflictError, toSafeError, type SafeError } from "@/lib/errors";

const equipmentSchema = z.object({
  siteId: z.uuid(),
  name: z.string().min(1, "Name is required"),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  installDate: z.string().optional(),
  warrantyExpiresAt: z.string().optional(),
  lastServiceDate: z.string().optional(),
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

export async function createEquipmentAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  let newEquipmentId: string;

  try {
    await requirePermission(PERMISSIONS.EQUIPMENT_WRITE);

    const parsed = equipmentSchema.safeParse(
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
      .insert(equipment)
      .values({
        siteId: parsed.data.siteId,
        name: parsed.data.name,
        manufacturer: parsed.data.manufacturer || null,
        model: parsed.data.model || null,
        serialNumber: parsed.data.serialNumber || null,
        installDate: parsed.data.installDate || null,
        warrantyExpiresAt: parsed.data.warrantyExpiresAt || null,
        lastServiceDate: parsed.data.lastServiceDate || null,
        notes: parsed.data.notes || null,
      })
      .returning();

    if (!created) {
      throw new ConflictError(
        "Insert did not return the created equipment row",
      );
    }
    newEquipmentId = created.id;

    const definitions = await getFieldDefinitions("equipment");
    if (definitions.length > 0) {
      const values = extractCustomFieldValues(formData, definitions);
      await setFieldValues(newEquipmentId, values);
    }
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }

  redirect(`/equipment/${newEquipmentId}`);
}

export async function updateEquipmentAction(
  equipmentId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await requirePermission(PERMISSIONS.EQUIPMENT_WRITE);

    const parsed = equipmentSchema.safeParse(
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
      .update(equipment)
      .set({
        name: parsed.data.name,
        manufacturer: parsed.data.manufacturer || null,
        model: parsed.data.model || null,
        serialNumber: parsed.data.serialNumber || null,
        installDate: parsed.data.installDate || null,
        warrantyExpiresAt: parsed.data.warrantyExpiresAt || null,
        lastServiceDate: parsed.data.lastServiceDate || null,
        notes: parsed.data.notes || null,
        updatedAt: new Date(),
      })
      .where(eq(equipment.id, equipmentId));

    const definitions = await getFieldDefinitions("equipment");
    if (definitions.length > 0) {
      const values = extractCustomFieldValues(formData, definitions);
      await setFieldValues(equipmentId, values);
    }

    revalidatePath(`/equipment/${equipmentId}`);
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}

export async function deleteEquipmentAction(
  equipmentId: string,
): Promise<FormState> {
  try {
    await requirePermission(PERMISSIONS.EQUIPMENT_DELETE);

    const db = getDb();
    await db.transaction(async (tx) => {
      await tx
        .delete(customFieldValues)
        .where(eq(customFieldValues.entityId, equipmentId));
      await tx.delete(equipment).where(eq(equipment.id, equipmentId));
    });

    revalidatePath("/equipment");
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }

  redirect("/equipment");
}
