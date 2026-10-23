"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CustomFieldInput } from "@/components/shared/custom-field-input";
import { CustomerAndSitePickers } from "@/components/shared/customer-site-pickers";
import {
  LineItemsInput,
  type LineItemRow,
} from "@/components/shared/line-items-input";
import { useAutoDismiss } from "@/hooks/use-auto-dismiss";
import type {
  customers,
  customFieldDefinitions,
  invoices,
  paymentOptions,
  sites,
} from "@/db/schema";
import type { CustomFieldValue } from "@/lib/custom-fields";
import {
  createInvoiceAction,
  updateInvoiceAction,
  type FormState,
} from "./actions";

type Definition = typeof customFieldDefinitions.$inferSelect;
type Customer = typeof customers.$inferSelect;
type Site = typeof sites.$inferSelect;
type PaymentOption = typeof paymentOptions.$inferSelect;

export interface InvoiceDefaults {
  title?: string;
  notes?: string | null;
  customerId?: string;
  siteId?: string | null;
  oneOffLocation?: string | null;
}

const initialState: FormState = { success: false, error: null };

export function InvoiceForm({
  invoice,
  defaults,
  source,
  customers,
  sites,
  definitions,
  customFieldValues,
  lineItemRows,
  paymentOptions,
  attachedOptionIds,
  canWrite = true,
}: {
  invoice?: typeof invoices.$inferSelect;
  defaults?: InvoiceDefaults;
  source?: { jobId?: string; quoteId?: string };
  canWrite?: boolean;
  customers: Customer[];
  sites: Site[];
  definitions: Definition[];
  customFieldValues?: Map<string, CustomFieldValue>;
  lineItemRows: LineItemRow[];
  paymentOptions: PaymentOption[];
  attachedOptionIds: string[];
}) {
  const action = invoice
    ? updateInvoiceAction.bind(null, invoice.id)
    : createInvoiceAction;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const showMessage = useAutoDismiss(
    state,
    Boolean(state.success || state.error),
  );
  const router = useRouter();

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  const readOnly = Boolean(
    invoice && (invoice.status !== "draft" || !canWrite),
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
      {!invoice && source?.jobId && (
        <input type="hidden" name="jobId" value={source.jobId} />
      )}
      {!invoice && source?.quoteId && (
        <input type="hidden" name="quoteId" value={source.quoteId} />
      )}

      <InvoiceFields
        key={invoice?.updatedAt.toISOString() ?? "new"}
        invoice={invoice}
        defaults={defaults}
        customers={customers}
        sites={sites}
        definitions={definitions}
        customFieldValues={customFieldValues}
        lineItemRows={lineItemRows}
        paymentOptions={paymentOptions}
        attachedOptionIds={attachedOptionIds}
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
          {isPending ? "Saving…" : invoice ? "Save changes" : "Create invoice"}
        </Button>
      )}
      {readOnly && invoice && (
        <p className="text-sm text-muted-foreground">
          {invoice.status !== "draft"
            ? "This invoice has been sent and can no longer be edited here — duplicate it above to make changes."
            : "You have read-only access to Invoices."}
        </p>
      )}
    </form>
  );
}

function InvoiceFields({
  invoice,
  defaults,
  customers,
  sites,
  definitions,
  customFieldValues,
  lineItemRows,
  paymentOptions,
  attachedOptionIds,
  readOnly,
}: {
  invoice?: typeof invoices.$inferSelect;
  defaults?: InvoiceDefaults;
  customers: Customer[];
  sites: Site[];
  definitions: Definition[];
  customFieldValues?: Map<string, CustomFieldValue>;
  lineItemRows: LineItemRow[];
  paymentOptions: PaymentOption[];
  attachedOptionIds: string[];
  readOnly: boolean;
}) {
  const attached = new Set(attachedOptionIds);
  const visibleOptions = paymentOptions.filter(
    (o) => o.isActive || attached.has(o.id),
  );

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          defaultValue={invoice?.title ?? defaults?.title}
          disabled={readOnly}
          required
        />
      </div>

      <CustomerAndSitePickers
        customers={customers}
        sites={sites}
        defaultCustomerId={invoice?.customerId ?? defaults?.customerId}
        defaultSiteId={
          (invoice ? invoice.siteId : defaults?.siteId) ?? undefined
        }
        defaultOneOffLocation={
          invoice ? invoice.oneOffLocation : defaults?.oneOffLocation
        }
        disabled={readOnly}
      />

      <div className="space-y-2">
        <Label htmlFor="dueDate">Due date (optional)</Label>
        <Input
          id="dueDate"
          name="dueDate"
          type="date"
          defaultValue={invoice?.dueDate ?? ""}
          disabled={readOnly}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={
            invoice ? (invoice.notes ?? "") : (defaults?.notes ?? "")
          }
          disabled={readOnly}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>Line items</Label>
        <LineItemsInput initialRows={lineItemRows} disabled={readOnly} />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          Payment options to show the customer
        </legend>
        {visibleOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No payment options exist yet. An administrator can add them under
            Settings → Payment options. An invoice needs at least one before it
            can be sent.
          </p>
        ) : (
          <div className="space-y-1">
            {visibleOptions.map((option) => (
              <label key={option.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="paymentOptionId"
                  value={option.id}
                  defaultChecked={
                    invoice ? attached.has(option.id) : option.isActive
                  }
                  disabled={readOnly}
                  className="mt-1 size-4"
                />
                <span>
                  {option.label}
                  {!option.isActive && (
                    <span className="text-muted-foreground">
                      {" "}
                      (deactivated)
                    </span>
                  )}
                  {option.details && (
                    <span className="block text-xs whitespace-pre-wrap text-muted-foreground">
                      {option.details}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        )}
        {!readOnly && (
          <p className="text-xs text-muted-foreground">
            Manage the list in{" "}
            <Link href="/settings/payment-options" className="underline">
              Settings → Payment options
            </Link>{" "}
            (administrators only).
          </p>
        )}
      </fieldset>

      {definitions.length > 0 && (
        <div className="space-y-4 border-t pt-4">
          {definitions.map((def) => (
            <CustomFieldInput
              key={def.id}
              definition={def}
              defaultValue={customFieldValues?.get(def.id)}
              disabled={readOnly}
            />
          ))}
        </div>
      )}
    </>
  );
}
