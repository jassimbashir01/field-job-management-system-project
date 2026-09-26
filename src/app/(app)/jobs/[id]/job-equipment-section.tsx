"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAutoDismiss } from "@/hooks/use-auto-dismiss";
import {
  addJobEquipmentAction,
  removeJobEquipmentAction,
  type FormState,
} from "./equipment-actions";

const initialState: FormState = { success: false, error: null };

interface LinkedEquipment {
  linkId: string;
  equipmentId: string;
  name: string;
  notes: string | null;
}

interface AvailableEquipment {
  id: string;
  name: string;
}

export function JobEquipmentSection({
  jobId,
  linked,
  available,
  disabled,
}: {
  jobId: string;
  linked: LinkedEquipment[];
  available: AvailableEquipment[];
  disabled?: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const linkedIds = new Set(linked.map((item) => item.equipmentId));
  const selectableEquipment = available.filter(
    (item) => !linkedIds.has(item.id),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Equipment</h2>
        {!disabled && !showForm && selectableEquipment.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            Link equipment
          </Button>
        )}
      </div>

      {linked.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No equipment linked yet.
        </p>
      ) : (
        <div className="divide-y rounded-md border">
          {linked.map((item) => (
            <div
              key={item.linkId}
              className="flex items-center justify-between px-4 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{item.name}</p>
                {item.notes && (
                  <p className="text-xs text-muted-foreground">{item.notes}</p>
                )}
              </div>
              {!disabled && <RemoveButton jobId={jobId} linkId={item.linkId} />}
            </div>
          ))}
        </div>
      )}

      {!disabled && showForm && (
        <AddEquipmentForm
          jobId={jobId}
          options={selectableEquipment}
          onDone={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function RemoveButton({ jobId, linkId }: { jobId: string; linkId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(() => removeJobEquipmentAction(jobId, linkId))
      }
    >
      {isPending ? "Removing…" : "Remove"}
    </Button>
  );
}

function AddEquipmentForm({
  jobId,
  options,
  onDone,
}: {
  jobId: string;
  options: AvailableEquipment[];
  onDone: () => void;
}) {
  const boundAction = addJobEquipmentAction.bind(null, jobId);
  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialState,
  );
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
    <form action={formAction} className="space-y-2 rounded-md border p-4">
      <div className="space-y-2">
        <Label htmlFor="equipmentId">Equipment</Label>
        <select
          id="equipmentId"
          name="equipmentId"
          defaultValue=""
          required
          className="w-full rounded-md border border-input px-3 py-2 text-sm"
        >
          <option value="" disabled>
            Select equipment…
          </option>
          {options.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Input id="notes" name="notes" placeholder="e.g. Replaced capacitor" />
      </div>
      {showMessage && state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error.message}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant="outline" disabled={isPending}>
          {isPending ? "Linking…" : "Link equipment"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
