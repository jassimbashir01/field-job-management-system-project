"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { customFieldDefinitions } from "@/db/schema";
import { useAutoDismiss } from "@/hooks/use-auto-dismiss";
import {
  createFieldDefinitionAction,
  deleteFieldDefinitionAction,
  type FormState,
} from "./actions";

const initialState: FormState = { success: false, error: null };
const SELECT_TYPES = new Set(["select", "multi_select"]);

type Definition = typeof customFieldDefinitions.$inferSelect;

export function CustomFieldsManager({
  definitions,
}: {
  definitions: Definition[];
}) {
  return (
    <div className="space-y-8">
      <div className="divide-y rounded-md border">
        {definitions.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            No custom fields yet.
          </p>
        )}
        {definitions.map((definition) => (
          <DefinitionRow key={definition.id} definition={definition} />
        ))}
      </div>
      <NewDefinitionForm />
    </div>
  );
}

function DefinitionRow({ definition }: { definition: Definition }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm">
      <div>
        <p className="font-medium">{definition.label}</p>
        <p className="text-xs text-muted-foreground">
          {definition.fieldType}
          {definition.required ? " · required" : ""}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(() => deleteFieldDefinitionAction(definition.id))
        }
      >
        Remove
      </Button>
    </div>
  );
}

function NewDefinitionForm() {
  const [state, formAction, isPending] = useActionState(
    createFieldDefinitionAction,
    initialState,
  );
  const showMessage = useAutoDismiss(
    state,
    Boolean(state.success || state.error),
  );
  const [fieldType, setFieldType] = useState("text");

  return (
    <form action={formAction} className="space-y-4 rounded-md border p-4">
      <h2 className="text-sm font-semibold">Add a field</h2>

      <div className="space-y-2">
        <Label htmlFor="label">Field label</Label>
        <Input
          id="label"
          name="label"
          required
          placeholder="e.g. Preferred contact time"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="fieldType">Type</Label>
        <input type="hidden" name="fieldType" value={fieldType} />
        <Select
          value={fieldType}
          onValueChange={(v) => setFieldType(v ?? "text")}
        >
          <SelectTrigger id="fieldType" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="number">Number</SelectItem>
            <SelectItem value="decimal">Decimal</SelectItem>
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="boolean">Yes / No</SelectItem>
            <SelectItem value="select">Dropdown (single choice)</SelectItem>
            <SelectItem value="multi_select">
              Dropdown (multiple choice)
            </SelectItem>
            <SelectItem value="measurement">Measurement</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {SELECT_TYPES.has(fieldType) && (
        <div className="space-y-2">
          <Label htmlFor="options">Options</Label>
          <Input
            id="options"
            name="options"
            placeholder="Residential, Commercial, Industrial"
          />
          <p className="text-xs text-muted-foreground">Comma-separated.</p>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="required" className="size-4" />
        Required
      </label>

      {showMessage && state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error.message}
        </p>
      )}

      <Button type="submit" disabled={isPending} variant="outline">
        {isPending ? "Adding…" : "Add field"}
      </Button>
    </form>
  );
}
