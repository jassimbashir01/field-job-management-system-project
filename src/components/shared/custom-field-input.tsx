"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { customFieldDefinitions } from "@/db/schema";

type Definition = typeof customFieldDefinitions.$inferSelect;

export function CustomFieldInput({
  definition,
  defaultValue,
}: {
  definition: Definition;
  defaultValue: unknown;
}) {
  const name = `custom_${definition.id}`;

  switch (definition.fieldType) {
    case "boolean":
      return (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name={name}
            defaultChecked={defaultValue === true}
            className="size-4"
          />
          {definition.label}
        </label>
      );

    case "select":
      return (
        <div className="space-y-2">
          <Label htmlFor={name}>{definition.label}</Label>
          <select
            id={name}
            name={name}
            defaultValue={typeof defaultValue === "string" ? defaultValue : ""}
            className="w-full rounded-md border border-input px-3 py-2 text-sm"
            required={definition.required}
          >
            <option value="">—</option>
            {(definition.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      );

    case "multi_select": {
      const selected = Array.isArray(defaultValue) ? defaultValue : [];
      return (
        <div className="space-y-2">
          <Label>{definition.label}</Label>
          <div className="space-y-1">
            {(definition.options ?? []).map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={name}
                  value={option}
                  defaultChecked={selected.includes(option)}
                  className="size-4"
                />
                {option}
              </label>
            ))}
          </div>
        </div>
      );
    }

    case "date":
      return (
        <div className="space-y-2">
          <Label htmlFor={name}>{definition.label}</Label>
          <Input
            id={name}
            name={name}
            type="date"
            defaultValue={typeof defaultValue === "string" ? defaultValue : ""}
            required={definition.required}
          />
        </div>
      );

    case "number":
    case "decimal":
      return (
        <div className="space-y-2">
          <Label htmlFor={name}>{definition.label}</Label>
          <Input
            id={name}
            name={name}
            type="number"
            step={definition.fieldType === "decimal" ? "any" : "1"}
            defaultValue={typeof defaultValue === "number" ? defaultValue : ""}
            required={definition.required}
          />
        </div>
      );

    case "measurement": {
      const measurement = (defaultValue ?? {}) as {
        value?: number;
        unit?: string;
      };
      return (
        <div className="space-y-2">
          <Label>{definition.label}</Label>
          <div className="flex gap-2">
            <Input
              name={`${name}_value`}
              type="number"
              step="any"
              defaultValue={measurement.value ?? ""}
              placeholder="Value"
              required={definition.required}
            />
            <Input
              name={`${name}_unit`}
              defaultValue={measurement.unit ?? ""}
              placeholder="Unit"
              className="max-w-24"
            />
          </div>
        </div>
      );
    }

    case "text":
    default:
      return (
        <div className="space-y-2">
          <Label htmlFor={name}>{definition.label}</Label>
          <Input
            id={name}
            name={name}
            defaultValue={typeof defaultValue === "string" ? defaultValue : ""}
            required={definition.required}
          />
        </div>
      );
  }
}
