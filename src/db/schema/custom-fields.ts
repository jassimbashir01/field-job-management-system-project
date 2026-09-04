import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const customFieldEntityTypeEnum = pgEnum("custom_field_entity_type", [
  "customer",
  "site",
]);

export const customFieldTypeEnum = pgEnum("custom_field_type", [
  "text",
  "number",
  "decimal",
  "date",
  "boolean",
  "select",
  "multi_select",
  "measurement",
]);

export const customFieldDefinitions = pgTable(
  "custom_field_definitions",
  {
    id: uuid().primaryKey().defaultRandom(),
    entityType: customFieldEntityTypeEnum().notNull(),
    key: text().notNull(),
    label: text().notNull(),
    fieldType: customFieldTypeEnum().notNull(),
    options: jsonb().$type<string[]>(),
    required: boolean().notNull().default(false),
    sortOrder: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.entityType, table.key)],
);

export const customFieldValues = pgTable(
  "custom_field_values",
  {
    id: uuid().primaryKey().defaultRandom(),
    definitionId: uuid()
      .notNull()
      .references(() => customFieldDefinitions.id, { onDelete: "cascade" }),
    entityId: uuid().notNull(),
    value: jsonb().$type<
      | string
      | number
      | boolean
      | string[]
      | { value: number; unit: string }
      | null
    >(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.definitionId, table.entityId)],
);
