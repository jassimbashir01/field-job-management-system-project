"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CustomFieldInput } from "@/components/shared/custom-field-input";
import { useAutoDismiss } from "@/hooks/use-auto-dismiss";
import type { customFieldDefinitions, equipment, sites } from "@/db/schema";
import type { CustomFieldValue } from "@/lib/custom-fields";
import {
  createEquipmentAction,
  updateEquipmentAction,
  type FormState,
} from "./actions";

const initialState: FormState = { success: false, error: null };

type Equipment = typeof equipment.$inferSelect;
type Site = typeof sites.$inferSelect;
type Definition = typeof customFieldDefinitions.$inferSelect;

export function EquipmentForm({
  equipment: equipmentItem,
  sites,
  defaultSiteId,
  definitions,
  customFieldValues,
  readOnly = false,
}: {
  equipment?: Equipment;
  sites: Site[];
  defaultSiteId?: string;
  definitions: Definition[];
  customFieldValues?: Map<string, CustomFieldValue>;
  readOnly?: boolean;
}) {
  const action = equipmentItem
    ? updateEquipmentAction.bind(null, equipmentItem.id)
    : createEquipmentAction;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const showMessage = useAutoDismiss(
    state,
    Boolean(state.success || state.error),
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <EquipmentFields
        key={equipmentItem?.updatedAt.toISOString() ?? "new"}
        equipment={equipmentItem}
        sites={sites}
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
          {isPending
            ? "Saving…"
            : equipmentItem
              ? "Save changes"
              : "Create equipment"}
        </Button>
      )}
    </form>
  );
}

function EquipmentFields({
  equipment: equipmentItem,
  sites,
  defaultSiteId,
  definitions,
  customFieldValues,
  readOnly,
}: {
  equipment?: Equipment;
  sites: Site[];
  defaultSiteId?: string;
  definitions: Definition[];
  customFieldValues?: Map<string, CustomFieldValue>;
  readOnly: boolean;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="siteId">Site</Label>
        <select
          id="siteId"
          name="siteId"
          defaultValue={equipmentItem?.siteId ?? defaultSiteId ?? ""}
          disabled={readOnly}
          className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:opacity-50"
          required
        >
          <option value="" disabled>
            Select a site…
          </option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={equipmentItem?.name}
          placeholder="e.g. Rooftop HVAC Unit 2"
          disabled={readOnly}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="manufacturer">Manufacturer</Label>
          <Input
            id="manufacturer"
            name="manufacturer"
            defaultValue={equipmentItem?.manufacturer ?? ""}
            disabled={readOnly}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="model">Model</Label>
          <Input
            id="model"
            name="model"
            defaultValue={equipmentItem?.model ?? ""}
            disabled={readOnly}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="serialNumber">Serial number</Label>
        <Input
          id="serialNumber"
          name="serialNumber"
          defaultValue={equipmentItem?.serialNumber ?? ""}
          disabled={readOnly}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="installDate">Install date</Label>
          <Input
            id="installDate"
            name="installDate"
            type="date"
            defaultValue={equipmentItem?.installDate ?? ""}
            disabled={readOnly}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="warrantyExpiresAt">Warranty expires</Label>
          <Input
            id="warrantyExpiresAt"
            name="warrantyExpiresAt"
            type="date"
            defaultValue={equipmentItem?.warrantyExpiresAt ?? ""}
            disabled={readOnly}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastServiceDate">Last serviced</Label>
          <Input
            id="lastServiceDate"
            name="lastServiceDate"
            type="date"
            defaultValue={equipmentItem?.lastServiceDate ?? ""}
            disabled={readOnly}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={equipmentItem?.notes ?? ""}
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
