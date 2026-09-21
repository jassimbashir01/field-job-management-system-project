import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  customFieldDefinitions,
  customFieldValues,
  type customFieldEntityTypeEnum,
} from "@/db/schema";

export type EntityType = (typeof customFieldEntityTypeEnum.enumValues)[number];

export type CustomFieldValue =
  string | number | boolean | string[] | { value: number; unit: string } | null;

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

export async function getFieldDefinitions(entityType: EntityType) {
  const db = getDb();
  return db
    .select()
    .from(customFieldDefinitions)
    .where(eq(customFieldDefinitions.entityType, entityType))
    .orderBy(asc(customFieldDefinitions.sortOrder));
}

export async function getFieldValues(
  entityId: string,
  tx?: Tx,
): Promise<Map<string, CustomFieldValue>> {
  const db = tx ?? getDb();
  const rows = await db
    .select()
    .from(customFieldValues)
    .where(eq(customFieldValues.entityId, entityId));
  return new Map(rows.map((row) => [row.definitionId, row.value]));
}

export async function setFieldValues(
  entityId: string,
  values: Map<string, CustomFieldValue>,
  tx?: Tx,
): Promise<void> {
  if (values.size === 0) return;

  const run = async (db: Tx) => {
    for (const [definitionId, value] of values) {
      await db
        .insert(customFieldValues)
        .values({ definitionId, entityId, value })
        .onConflictDoUpdate({
          target: [customFieldValues.definitionId, customFieldValues.entityId],
          set: { value, updatedAt: new Date() },
        });
    }
  };

  if (tx) {
    await run(tx);
  } else {
    const db = getDb();
    await db.transaction(run);
  }
}

export function extractCustomFieldValues(
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
