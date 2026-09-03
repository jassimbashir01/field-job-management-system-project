"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { getDb } from "@/db";
import { customFieldDefinitions } from "@/db/schema";
import { requireRole } from "@/lib/auth/guards";
import { toSafeError, type SafeError } from "@/lib/errors";

function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const definitionSchema = z.object({
  label: z.string().min(1),
  fieldType: z.enum([
    "text",
    "number",
    "decimal",
    "date",
    "boolean",
    "select",
    "multi_select",
    "measurement",
  ]),
  options: z.string().optional(),
  required: z.enum(["on"]).optional(),
});

export interface FormState {
  success: boolean;
  error: SafeError | null;
}

export async function createFieldDefinitionAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await requireRole("admin");

    const parsed = definitionSchema.safeParse(
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

    const isSelectType =
      parsed.data.fieldType === "select" ||
      parsed.data.fieldType === "multi_select";
    const options = isSelectType
      ? (parsed.data.options ?? "")
          .split(",")
          .map((option) => option.trim())
          .filter(Boolean)
      : null;

    if (isSelectType && (!options || options.length === 0)) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Select fields need at least one option.",
        },
      };
    }

    const db = getDb();
    await db.insert(customFieldDefinitions).values({
      entityType: "customer",
      key: slugify(parsed.data.label),
      label: parsed.data.label,
      fieldType: parsed.data.fieldType,
      options,
      required: parsed.data.required === "on",
    });

    revalidatePath("/settings/custom-fields");
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}

export async function deleteFieldDefinitionAction(
  definitionId: string,
): Promise<void> {
  await requireRole("admin");
  const db = getDb();
  await db
    .delete(customFieldDefinitions)
    .where(eq(customFieldDefinitions.id, definitionId));
  revalidatePath("/settings/custom-fields");
}
