"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAutoDismiss } from "@/hooks/use-auto-dismiss";
import type { customers, jobRecurrences, sites } from "@/db/schema";
import {
  createRecurrenceAction,
  updateRecurrenceAction,
  type FormState,
} from "./actions";

const initialState: FormState = { success: false, error: null };

type Customer = typeof customers.$inferSelect;
type Site = typeof sites.$inferSelect;
type Recurrence = typeof jobRecurrences.$inferSelect;

export function RecurrenceForm({
  customers,
  sites,
  technicians,
  recurrence,
  readOnly,
}: {
  customers: Customer[];
  sites: Site[];
  technicians: { id: string; displayName: string }[];
  recurrence?: Recurrence;
  readOnly?: boolean;
}) {
  const action = recurrence
    ? updateRecurrenceAction.bind(null, recurrence.id)
    : createRecurrenceAction;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const showMessage = useAutoDismiss(
    state,
    Boolean(state.success || state.error),
  );

  return (
    <form action={formAction} className="space-y-4">
      <RecurrenceFields
        key={recurrence?.updatedAt.toISOString() ?? "new"}
        customers={customers}
        sites={sites}
        technicians={technicians}
        recurrence={recurrence}
        readOnly={readOnly}
      />

      {showMessage && state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error.message}
        </p>
      )}
      {showMessage && state.success && recurrence && (
        <p className="text-sm text-muted-foreground">Saved.</p>
      )}

      {!readOnly && (
        <Button type="submit" disabled={isPending}>
          {isPending
            ? "Saving…"
            : recurrence
              ? "Save changes"
              : "Create recurring job"}
        </Button>
      )}
    </form>
  );
}

function RecurrenceFields({
  customers,
  sites,
  technicians,
  recurrence,
  readOnly,
}: {
  customers: Customer[];
  sites: Site[];
  technicians: { id: string; displayName: string }[];
  recurrence?: Recurrence;
  readOnly?: boolean;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="customerId">Customer</Label>
        <select
          id="customerId"
          name="customerId"
          defaultValue={recurrence?.customerId ?? ""}
          disabled={readOnly}
          className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:opacity-50"
          required
        >
          <option value="" disabled>
            Select a customer…
          </option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="siteId">Site</Label>
        <select
          id="siteId"
          name="siteId"
          defaultValue={recurrence?.siteId ?? ""}
          disabled={readOnly}
          className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:opacity-50"
        >
          <option value="">No site — use a one-time location below</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="oneOffLocation">
          One-time location (used only when no site is selected)
        </Label>
        <Input
          id="oneOffLocation"
          name="oneOffLocation"
          defaultValue={recurrence?.oneOffLocation ?? ""}
          disabled={readOnly}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="assignedToUserId">Default technician</Label>
        <select
          id="assignedToUserId"
          name="assignedToUserId"
          defaultValue={recurrence?.assignedToUserId ?? ""}
          disabled={readOnly}
          className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:opacity-50"
        >
          <option value="">Unassigned</option>
          {technicians.map((t) => (
            <option key={t.id} value={t.id}>
              {t.displayName}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Job title</Label>
        <Input
          id="title"
          name="title"
          defaultValue={recurrence?.title}
          disabled={readOnly}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="jobType">Job type</Label>
        <Input
          id="jobType"
          name="jobType"
          defaultValue={recurrence?.jobType ?? ""}
          disabled={readOnly}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={recurrence?.description ?? ""}
          disabled={readOnly}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reference">Reference</Label>
        <Input
          id="reference"
          name="reference"
          defaultValue={recurrence?.reference ?? ""}
          disabled={readOnly}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="intervalCount">Repeat every</Label>
          <Input
            id="intervalCount"
            name="intervalCount"
            type="number"
            min={1}
            max={365}
            defaultValue={recurrence?.intervalCount ?? 1}
            disabled={readOnly}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="intervalUnit">Unit</Label>
          <select
            id="intervalUnit"
            name="intervalUnit"
            defaultValue={recurrence?.intervalUnit ?? "month"}
            disabled={readOnly}
            className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="day">Day(s)</option>
            <option value="week">Week(s)</option>
            <option value="month">Month(s)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate">Starts on</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={recurrence?.startDate ?? ""}
            disabled={readOnly}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">Ends on (optional)</Label>
          <Input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={recurrence?.endDate ?? ""}
            disabled={readOnly}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="scheduledTime">Scheduled time (optional)</Label>
        <Input
          id="scheduledTime"
          name="scheduledTime"
          type="time"
          defaultValue={recurrence?.scheduledTime ?? ""}
          disabled={readOnly}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="active"
          name="active"
          type="checkbox"
          defaultChecked={recurrence?.active ?? true}
          disabled={readOnly}
          className="h-4 w-4"
        />
        <Label htmlFor="active">Active — keep generating new jobs</Label>
      </div>
    </>
  );
}
