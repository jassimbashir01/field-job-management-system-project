"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CustomFieldInput } from "@/components/shared/custom-field-input";
import { useAutoDismiss } from "@/hooks/use-auto-dismiss";
import type { customFieldDefinitions } from "@/db/schema";
import type { JobTemplateWithDetails } from "@/lib/job-templates";
import {
  createJobTemplateAction,
  deleteJobTemplateAction,
  updateJobTemplateAction,
  type FormState,
} from "./actions";

const initialState: FormState = { success: false, error: null };
type Definition = typeof customFieldDefinitions.$inferSelect;

export function JobTemplatesManager({
  templates,
  definitions,
}: {
  templates: JobTemplateWithDetails[];
  definitions: Definition[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-6">
      <div className="divide-y rounded-md border">
        {templates.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">No templates yet.</p>
        )}
        {templates.map((template) =>
          editingId === template.id ? (
            <div key={template.id} className="p-4">
              <TemplateForm
                template={template}
                definitions={definitions}
                onDone={() => setEditingId(null)}
              />
            </div>
          ) : (
            <div
              key={template.id}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium">{template.name}</p>
                <p className="text-xs text-muted-foreground">
                  {template.checklistItems.length} checklist item
                  {template.checklistItems.length === 1 ? "" : "s"}
                  {template.description && ` · ${template.description}`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingId(template.id)}
                >
                  Edit
                </Button>
                <DeleteTemplateButton templateId={template.id} />
              </div>
            </div>
          ),
        )}
      </div>

      {creating ? (
        <div className="rounded-md border p-4">
          <TemplateForm
            definitions={definitions}
            onDone={() => setCreating(false)}
          />
        </div>
      ) : (
        <Button variant="outline" onClick={() => setCreating(true)}>
          Add template
        </Button>
      )}
    </div>
  );
}

function TemplateForm({
  template,
  definitions,
  onDone,
}: {
  template?: JobTemplateWithDetails;
  definitions: Definition[];
  onDone: () => void;
}) {
  const action = template
    ? updateJobTemplateAction.bind(null, template.id)
    : createJobTemplateAction;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const showMessage = useAutoDismiss(
    state,
    Boolean(state.success || state.error),
  );

  useEffect(() => {
    if (state.success) {
      onDone();
    }
  }, [state.success, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Template name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={template?.name}
          placeholder="e.g. HVAC Repair"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          name="description"
          defaultValue={template?.description ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="defaultJobType">Default job type</Label>
        <Input
          id="defaultJobType"
          name="defaultJobType"
          defaultValue={template?.defaultJobType ?? ""}
          placeholder="Pre-fills the job's own 'Job type' field"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="checklistItems">Checklist items</Label>
        <Textarea
          id="checklistItems"
          name="checklistItems"
          rows={5}
          defaultValue={template?.checklistItems.join("\n") ?? ""}
          placeholder={
            "One item per line, e.g.\nTurn off breaker\nReplace filter\nTest system"
          }
        />
      </div>

      {definitions.length > 0 && (
        <div className="space-y-4 border-t pt-4">
          <p className="text-xs text-muted-foreground">
            Default values for this job type&apos;s custom fields:
          </p>
          {definitions.map((definition) => (
            <CustomFieldInput
              key={definition.id}
              definition={definition}
              defaultValue={template?.fieldDefaults[definition.id]}
            />
          ))}
        </div>
      )}

      {showMessage && state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error.message}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending
            ? "Saving…"
            : template
              ? "Save changes"
              : "Create template"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function DeleteTemplateButton({ templateId }: { templateId: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        Remove
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground">Delete?</span>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => deleteJobTemplateAction(templateId)}
      >
        Yes
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        No
      </Button>
    </div>
  );
}
