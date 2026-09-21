"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { getDb } from "@/db";
import {
  customFieldValues,
  jobTemplateChecklistItems,
  jobTemplates,
} from "@/db/schema";
import { requireRole } from "@/lib/auth/guards";
import {
  extractCustomFieldValues,
  getFieldDefinitions,
  setFieldValues,
} from "@/lib/custom-fields";
import { ConflictError, toSafeError, type SafeError } from "@/lib/errors";

const templateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  defaultJobType: z.string().optional(),
  checklistItems: z.string().optional(),
});

export interface FormState {
  success: boolean;
  error: SafeError | null;
}

function parseChecklistItems(raw: string | undefined): string[] {
  return (raw ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function createJobTemplateAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await requireRole("admin");

    const parsed = templateSchema.safeParse(
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

    const items = parseChecklistItems(parsed.data.checklistItems);

    const db = getDb();
    await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(jobTemplates)
        .values({
          name: parsed.data.name,
          description: parsed.data.description || null,
          defaultJobType: parsed.data.defaultJobType || null,
        })
        .returning();

      if (!created) {
        throw new ConflictError(
          "Insert did not return the created template row",
        );
      }

      if (items.length > 0) {
        await tx.insert(jobTemplateChecklistItems).values(
          items.map((label, index) => ({
            templateId: created.id,
            label,
            sortOrder: index,
          })),
        );
      }

      const definitions = await getFieldDefinitions("job");
      if (definitions.length > 0) {
        const values = extractCustomFieldValues(formData, definitions);
        await setFieldValues(created.id, values, tx);
      }
    });

    revalidatePath("/settings/job-templates");
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}

export async function updateJobTemplateAction(
  templateId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await requireRole("admin");

    const parsed = templateSchema.safeParse(
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

    const items = parseChecklistItems(parsed.data.checklistItems);

    const db = getDb();
    await db.transaction(async (tx) => {
      await tx
        .update(jobTemplates)
        .set({
          name: parsed.data.name,
          description: parsed.data.description || null,
          defaultJobType: parsed.data.defaultJobType || null,
          updatedAt: new Date(),
        })
        .where(eq(jobTemplates.id, templateId));

      await tx
        .delete(jobTemplateChecklistItems)
        .where(eq(jobTemplateChecklistItems.templateId, templateId));
      if (items.length > 0) {
        await tx.insert(jobTemplateChecklistItems).values(
          items.map((label, index) => ({
            templateId,
            label,
            sortOrder: index,
          })),
        );
      }

      const definitions = await getFieldDefinitions("job");
      if (definitions.length > 0) {
        const values = extractCustomFieldValues(formData, definitions);
        await setFieldValues(templateId, values, tx);
      }
    });

    revalidatePath("/settings/job-templates");
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}

export async function deleteJobTemplateAction(
  templateId: string,
): Promise<void> {
  await requireRole("admin");

  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .delete(customFieldValues)
      .where(eq(customFieldValues.entityId, templateId));
    await tx.delete(jobTemplates).where(eq(jobTemplates.id, templateId));
  });

  revalidatePath("/settings/job-templates");
}
