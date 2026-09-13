"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CustomFieldInput } from "@/components/shared/custom-field-input";
import { useAutoDismiss } from "@/hooks/use-auto-dismiss";
import type {
  customFieldDefinitions,
  customers,
  jobs,
  sites,
  users,
} from "@/db/schema";
import type { CustomFieldValue } from "@/lib/custom-fields";
import { createJobAction, updateJobAction, type FormState } from "./actions";

const initialState: FormState = { success: false, error: null };

type Job = typeof jobs.$inferSelect;
type Customer = typeof customers.$inferSelect;
type Site = typeof sites.$inferSelect;
type Technician = typeof users.$inferSelect;
type Definition = typeof customFieldDefinitions.$inferSelect;

export function JobForm({
  job,
  customers,
  sites,
  technicians,
  defaultCustomerId,
  defaultSiteId,
  definitions,
  customFieldValues,
  readOnly = false,
}: {
  job?: Job;
  customers: Customer[];
  sites: Site[];
  technicians: Technician[];
  defaultCustomerId?: string;
  defaultSiteId?: string;
  definitions: Definition[];
  customFieldValues?: Map<string, CustomFieldValue>;
  readOnly?: boolean;
}) {
  const action = job ? updateJobAction.bind(null, job.id) : createJobAction;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const showMessage = useAutoDismiss(
    state,
    Boolean(state.success || state.error),
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <JobFields
        key={job?.updatedAt.toISOString() ?? "new"}
        job={job}
        customers={customers}
        sites={sites}
        technicians={technicians}
        defaultCustomerId={defaultCustomerId}
        defaultSiteId={defaultSiteId}
        definitions={definitions}
        customFieldValues={customFieldValues}
        readOnly={readOnly}
      />

      {showMessage && state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error.message}
        </p>
      )}
      {showMessage && state.success && (
        <p role="status" className="text-sm text-green-600">
          Saved.
        </p>
      )}

      {!readOnly && (
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : job ? "Save changes" : "Create job"}
        </Button>
      )}
    </form>
  );
}

function JobFields({
  job,
  customers,
  sites,
  technicians,
  defaultCustomerId,
  defaultSiteId,
  definitions,
  customFieldValues,
  readOnly,
}: {
  job?: Job;
  customers: Customer[];
  sites: Site[];
  technicians: Technician[];
  defaultCustomerId?: string;
  defaultSiteId?: string;
  definitions: Definition[];
  customFieldValues?: Map<string, CustomFieldValue>;
  readOnly: boolean;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          defaultValue={job?.title}
          placeholder="e.g. Annual boiler service"
          disabled={readOnly}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="customerId">Customer</Label>
          <select
            id="customerId"
            name="customerId"
            defaultValue={job?.customerId ?? defaultCustomerId ?? ""}
            disabled={readOnly}
            className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:opacity-50"
            required
          >
            <option value="" disabled>
              Select a customer…
            </option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="siteId">Site</Label>
          <select
            id="siteId"
            name="siteId"
            defaultValue={job?.siteId ?? defaultSiteId ?? ""}
            disabled={readOnly}
            className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">No site yet</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="assignedToUserId">Assigned to</Label>
        <select
          id="assignedToUserId"
          name="assignedToUserId"
          defaultValue={job?.assignedToUserId ?? ""}
          disabled={readOnly}
          className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:opacity-50"
        >
          <option value="">Unassigned</option>
          {technicians.map((technician) => (
            <option key={technician.id} value={technician.id}>
              {technician.displayName}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="jobType">Job type</Label>
          <Input
            id="jobType"
            name="jobType"
            defaultValue={job?.jobType ?? ""}
            placeholder="e.g. Repair, Installation"
            disabled={readOnly}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reference">Reference</Label>
          <Input
            id="reference"
            name="reference"
            defaultValue={job?.reference ?? ""}
            disabled={readOnly}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="scheduledDate">Scheduled date</Label>
          <Input
            id="scheduledDate"
            name="scheduledDate"
            type="date"
            defaultValue={job?.scheduledDate ?? ""}
            disabled={readOnly}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="scheduledTime">Scheduled time</Label>
          <Input
            id="scheduledTime"
            name="scheduledTime"
            type="time"
            defaultValue={job?.scheduledTime ?? ""}
            disabled={readOnly}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={job?.description ?? ""}
          disabled={readOnly}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={job?.notes ?? ""}
          disabled={readOnly}
        />
      </div>

      {definitions.length > 0 && (
        <div className="space-y-4 border-t pt-4">
          {definitions.map((definition) => (
            <CustomFieldInput
              key={definition.id}
              definition={definition}
              defaultValue={customFieldValues?.get(definition.id)}
              disabled={readOnly}
            />
          ))}
        </div>
      )}
    </>
  );
}
