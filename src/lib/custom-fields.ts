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
): Promise<Map<string, CustomFieldValue>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(customFieldValues)
    .where(eq(customFieldValues.entityId, entityId));
  return new Map(rows.map((row) => [row.definitionId, row.value]));
}

export async function setFieldValues(
  entityId: string,
  values: Map<string, CustomFieldValue>,
): Promise<void> {
  if (values.size === 0) return;
  const db = getDb();

  await db.transaction(async (tx) => {
    for (const [definitionId, value] of values) {
      await tx
        .insert(customFieldValues)
        .values({ definitionId, entityId, value })
        .onConflictDoUpdate({
          target: [customFieldValues.definitionId, customFieldValues.entityId],
          set: { value, updatedAt: new Date() },
        });
    }
  });
}
