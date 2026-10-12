"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CustomFieldInput } from "@/components/shared/custom-field-input";
import { CustomerAndSitePickers } from "@/components/shared/customer-site-pickers";
import { useAutoDismiss } from "@/hooks/use-auto-dismiss";
import type {
  customers,
  customFieldDefinitions,
  quotes,
  sites,
} from "@/db/schema";
import type { CustomFieldValue } from "@/lib/custom-fields";
import {
  createQuoteAction,
  updateQuoteAction,
  type FormState,
} from "./actions";
import { LineItemsInput, type LineItemRow } from "./line-items-input";

type Definition = typeof customFieldDefinitions.$inferSelect;
type Customer = typeof customers.$inferSelect;
type Site = typeof sites.$inferSelect;

const initialState: FormState = { success: false, error: null };

export function QuoteForm({
  quote,
  customers,
  sites,
  definitions,
  customFieldValues,
  lineItemRows,
}: {
  quote?: typeof quotes.$inferSelect;
  customers: Customer[];
  sites: Site[];
  definitions: Definition[];
  customFieldValues?: Map<string, CustomFieldValue>;
  lineItemRows: LineItemRow[];
}) {
  const action = quote
    ? updateQuoteAction.bind(null, quote.id)
    : createQuoteAction;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const showMessage = useAutoDismiss(
    state,
    Boolean(state.success || state.error),
  );
  const router = useRouter();

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  const readOnly = Boolean(quote && quote.status !== "draft");

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <QuoteFields
        key={quote?.updatedAt.toISOString() ?? "new"}
        quote={quote}
        customers={customers}
        sites={sites}
        definitions={definitions}
        customFieldValues={customFieldValues}
        lineItemRows={lineItemRows}
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
          {isPending ? "Saving…" : quote ? "Save changes" : "Create quote"}
        </Button>
      )}
      {readOnly && (
        <p className="text-sm text-muted-foreground">
          This quote has been sent and can no longer be edited here — duplicate
          it below to make changes.
        </p>
      )}
    </form>
  );
}

function QuoteFields({
  quote,
  customers,
  sites,
  definitions,
  customFieldValues,
  lineItemRows,
  readOnly,
}: {
  quote?: typeof quotes.$inferSelect;
  customers: Customer[];
  sites: Site[];
  definitions: Definition[];
  customFieldValues?: Map<string, CustomFieldValue>;
  lineItemRows: LineItemRow[];
  readOnly: boolean;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          defaultValue={quote?.title}
          disabled={readOnly}
          required
        />
      </div>

      <CustomerAndSitePickers
        customers={customers}
        sites={sites}
        defaultCustomerId={quote?.customerId}
        defaultSiteId={quote?.siteId ?? undefined}
        defaultOneOffLocation={quote?.oneOffLocation}
        disabled={readOnly}
      />

      <div className="space-y-2">
        <Label htmlFor="expiresAt">Expires on (optional)</Label>
        <Input
          id="expiresAt"
          name="expiresAt"
          type="date"
          defaultValue={quote?.expiresAt ?? ""}
          disabled={readOnly}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={quote?.notes ?? ""}
          disabled={readOnly}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>Line items</Label>
        <LineItemsInput initialRows={lineItemRows} disabled={readOnly} />
      </div>

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
