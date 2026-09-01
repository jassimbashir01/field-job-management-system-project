"use client";

import { useActionState, useMemo, useState } from "react";
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
import type { companies } from "@/db/schema";
import { useAutoDismiss } from "@/hooks/use-auto-dismiss";
import { updateSettingsAction, type SettingsState } from "./actions";

const initialState: SettingsState = { success: false, error: null };

function getTimezoneOptions(currentValue: string): string[] {
  const fromBrowser =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : [];
  const zones = new Set(["UTC", currentValue, ...fromBrowser]);
  return Array.from(zones).sort();
}

export function SettingsForm({
  company,
}: {
  company: typeof companies.$inferSelect;
}) {
  const [state, formAction, isPending] = useActionState(
    updateSettingsAction,
    initialState,
  );
  const showMessage = useAutoDismiss(
    state,
    Boolean(state.success || state.error),
  );

  return (
    <form action={formAction} className="space-y-6">
      <SettingsFields key={company.updatedAt.toISOString()} company={company} />

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
        {isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

function SettingsFields({
  company,
}: {
  company: typeof companies.$inferSelect;
}) {
  const [timezone, setTimezone] = useState(company.timezone);
  const timezoneOptions = useMemo(
    () => getTimezoneOptions(company.timezone),
    [company.timezone],
  );

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="name">Company name</Label>
        <Input id="name" name="name" defaultValue={company.name} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="logoUrl">Logo URL</Label>
        <Input
          id="logoUrl"
          name="logoUrl"
          type="url"
          defaultValue={company.logoUrl ?? ""}
          placeholder="https://…"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="primaryColor">Primary color</Label>
        <Input
          id="primaryColor"
          name="primaryColor"
          type="color"
          defaultValue={company.primaryColor ?? "#000000"}
          className="h-10 w-20 p-1"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contactEmail">Contact email</Label>
          <Input
            id="contactEmail"
            name="contactEmail"
            type="email"
            defaultValue={company.contactEmail ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactPhone">Contact phone</Label>
          <Input
            id="contactPhone"
            name="contactPhone"
            defaultValue={company.contactPhone ?? ""}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="addressLine1">Address line 1</Label>
        <Input
          id="addressLine1"
          name="addressLine1"
          defaultValue={company.addressLine1 ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="addressLine2">Address line 2</Label>
        <Input
          id="addressLine2"
          name="addressLine2"
          defaultValue={company.addressLine2 ?? ""}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" defaultValue={company.city ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="region">Region / state</Label>
          <Input
            id="region"
            name="region"
            defaultValue={company.region ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="postalCode">Postal code</Label>
          <Input
            id="postalCode"
            name="postalCode"
            defaultValue={company.postalCode ?? ""}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="country">Country</Label>
        <Input
          id="country"
          name="country"
          defaultValue={company.country ?? ""}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="timezone">Timezone</Label>
        <input type="hidden" name="timezone" value={timezone} />
        <Select
          value={timezone}
          onValueChange={(value) => setTimezone(value ?? company.timezone)}
        >
          <SelectTrigger id="timezone" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {timezoneOptions.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="defaultTeamMemberLabel">
          Default team member label
        </Label>
        <Input
          id="defaultTeamMemberLabel"
          name="defaultTeamMemberLabel"
          defaultValue={company.defaultTeamMemberLabel}
        />
      </div>
    </>
  );
}
