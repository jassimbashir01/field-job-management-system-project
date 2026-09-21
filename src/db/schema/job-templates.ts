import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const jobTemplates = pgTable("job_templates", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  description: text(),
  defaultJobType: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const jobTemplateChecklistItems = pgTable(
  "job_template_checklist_items",
  {
    id: uuid().primaryKey().defaultRandom(),
    templateId: uuid()
      .notNull()
      .references(() => jobTemplates.id, { onDelete: "cascade" }),
    label: text().notNull(),
    sortOrder: integer().notNull().default(0),
  },
);
