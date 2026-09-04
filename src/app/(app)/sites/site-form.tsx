"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CustomFieldInput } from "@/components/shared/custom-field-input";
import { useAutoDismiss } from "@/hooks/use-auto-dismiss";
import type { customers, customFieldDefinitions, sites } from "@/db/schema";
import type { CustomFieldValue } from "@/lib/custom-fields";
import { createSiteAction, updateSiteAction, type FormState } from "./actions";

const initialState: FormState = { success: false, error: null };

type Site = typeof sites.$inferSelect;
type Customer = typeof customers.$inferSelect;
type Definition = typeof customFieldDefinitions.$inferSelect;

export function SiteForm({
  site,
  customers,
  defaultCustomerId,
  definitions,
  customFieldValues,
}: {
  site?: Site;
  customers: Customer[];
  defaultCustomerId?: string;
  definitions: Definition[];
  customFieldValues?: Map<string, CustomFieldValue>;
}) {
  const action = site ? updateSiteAction.bind(null, site.id) : createSiteAction;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const showMessage = useAutoDismiss(
    state,
    Boolean(state.success || state.error),
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <SiteFields
        key={site?.updatedAt.toISOString() ?? "new"}
        site={site}
        customers={customers}
        defaultCustomerId={defaultCustomerId}
        definitions={definitions}
        customFieldValues={customFieldValues}
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

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : site ? "Save changes" : "Create site"}
      </Button>
    </form>
  );
}

function SiteFields({
  site,
  customers,
  defaultCustomerId,
  definitions,
  customFieldValues,
}: {
  site?: Site;
  customers: Customer[];
  defaultCustomerId?: string;
  definitions: Definition[];
  customFieldValues?: Map<string, CustomFieldValue>;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="customerId">Customer</Label>
        <select
          id="customerId"
          name="customerId"
          defaultValue={site?.customerId ?? defaultCustomerId ?? ""}
          className="w-full rounded-md border border-input px-3 py-2 text-sm"
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
        <Label htmlFor="name">Site name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={site?.name}
          placeholder="e.g. Main office, Warehouse 2"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="addressLine1">Address line 1</Label>
        <Input
          id="addressLine1"
          name="addressLine1"
          defaultValue={site?.addressLine1 ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="addressLine2">Address line 2</Label>
        <Input
          id="addressLine2"
          name="addressLine2"
          defaultValue={site?.addressLine2 ?? ""}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" defaultValue={site?.city ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="region">Region / state</Label>
          <Input id="region" name="region" defaultValue={site?.region ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="postalCode">Postal code</Label>
          <Input
            id="postalCode"
            name="postalCode"
            defaultValue={site?.postalCode ?? ""}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="country">Country</Label>
        <Input id="country" name="country" defaultValue={site?.country ?? ""} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="accessNotes">Access notes</Label>
        <Textarea
          id="accessNotes"
          name="accessNotes"
          placeholder="Gate codes, parking, where to find the technician entrance…"
          defaultValue={site?.accessNotes ?? ""}
        />
      </div>

      {definitions.length > 0 && (
        <div className="space-y-4 border-t pt-4">
          {definitions.map((definition) => (
            <CustomFieldInput
              key={definition.id}
              definition={definition}
              defaultValue={customFieldValues?.get(definition.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}
