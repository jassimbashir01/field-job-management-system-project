"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CustomFieldInput } from "@/components/shared/custom-field-input";
import { useAutoDismiss } from "@/hooks/use-auto-dismiss";
import type { customers, customFieldDefinitions } from "@/db/schema";
import type { CustomFieldValue } from "@/lib/custom-fields";
import {
  createCustomerAction,
  updateCustomerAction,
  type FormState,
} from "./actions";

const initialState: FormState = { success: false, error: null };

type Customer = typeof customers.$inferSelect;
type Definition = typeof customFieldDefinitions.$inferSelect;

export function CustomerForm({
  customer,
  definitions,
  customFieldValues,
}: {
  customer?: Customer;
  definitions: Definition[];
  customFieldValues?: Map<string, CustomFieldValue>;
}) {
  const action = customer
    ? updateCustomerAction.bind(null, customer.id)
    : createCustomerAction;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const showMessage = useAutoDismiss(
    state,
    Boolean(state.success || state.error),
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <CustomerFields
        key={customer?.updatedAt.toISOString() ?? "new"}
        customer={customer}
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
        {isPending ? "Saving…" : customer ? "Save changes" : "Create customer"}
      </Button>
    </form>
  );
}

function CustomerFields({
  customer,
  definitions,
  customFieldValues,
}: {
  customer?: Customer;
  definitions: Definition[];
  customFieldValues?: Map<string, CustomFieldValue>;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={customer?.name} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="companyName">Company name</Label>
        <Input
          id="companyName"
          name="companyName"
          defaultValue={customer?.companyName ?? ""}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={customer?.phone ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={customer?.email ?? ""}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={customer?.notes ?? ""}
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
