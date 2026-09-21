import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { jobTemplateChecklistItems, jobTemplates } from "@/db/schema";
import { getFieldValues, type CustomFieldValue } from "./custom-fields";

export interface JobTemplateWithDetails {
  id: string;
  name: string;
  description: string | null;
  defaultJobType: string | null;
  checklistItems: string[];
  fieldDefaults: Record<string, CustomFieldValue>;
}

export async function getJobTemplatesWithDetails(): Promise<
  JobTemplateWithDetails[]
> {
  const db = getDb();
  const templates = await db
    .select()
    .from(jobTemplates)
    .orderBy(asc(jobTemplates.name));

  return Promise.all(
    templates.map(async (template) => {
      const [checklistRows, fieldDefaults] = await Promise.all([
        db
          .select({ label: jobTemplateChecklistItems.label })
          .from(jobTemplateChecklistItems)
          .where(eq(jobTemplateChecklistItems.templateId, template.id))
          .orderBy(asc(jobTemplateChecklistItems.sortOrder)),
        getFieldValues(template.id),
      ]);

      return {
        id: template.id,
        name: template.name,
        description: template.description,
        defaultJobType: template.defaultJobType,
        checklistItems: checklistRows.map((row) => row.label),
        fieldDefaults: Object.fromEntries(fieldDefaults),
      };
    }),
  );
}

export function parseChecklistItems(raw: string | undefined | null): string[] {
  return (raw ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
