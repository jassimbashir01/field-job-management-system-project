"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { useAutoDismiss } from "@/hooks/use-auto-dismiss";
import { savePreferencesAction, type PreferencesState } from "../actions";

export interface PreferenceRow {
  key: string;
  label: string;
  inApp: boolean;
  email: boolean;
}

const initial: PreferencesState = { success: false, error: null };

export function PreferencesForm({
  rows,
  emailEnabled,
}: {
  rows: PreferenceRow[];
  emailEnabled: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    savePreferencesAction,
    initial,
  );
  const showSaved = useAutoDismiss(state, state.success);
  const showError = useAutoDismiss(state, Boolean(state.error));

  return (
    <form action={formAction} className="space-y-4">
      <div className="rounded-md border">
        <div className="grid grid-cols-[1fr_5rem_5rem] gap-2 border-b px-4 py-2 text-xs font-medium text-muted-foreground uppercase">
          <span>Event</span>
          <span className="text-center">In-app</span>
          <span className="text-center">Email</span>
        </div>
        {rows.map((row) => (
          <div
            key={row.key}
            className="grid grid-cols-[1fr_5rem_5rem] items-center gap-2 border-b px-4 py-3 last:border-b-0"
          >
            <span className="text-sm">{row.label}</span>
            <span className="text-center">
              <input
                type="checkbox"
                name={`inApp:${row.key}`}
                defaultChecked={row.inApp}
                aria-label={`${row.label} — in-app`}
              />
            </span>
            <span className="text-center">
              <input
                type="checkbox"
                name={`email:${row.key}`}
                defaultChecked={row.email}
                disabled={!emailEnabled}
                aria-label={`${row.label} — email`}
              />
            </span>
          </div>
        ))}
      </div>

      {!emailEnabled && (
        <p className="text-sm text-muted-foreground">
          Email isn&apos;t set up on this server yet, so the email column is
          disabled.
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save preferences"}
        </Button>
        {showSaved && (
          <p role="status" className="text-sm text-green-600">
            Saved.
          </p>
        )}
        {showError && state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error.message}
          </p>
        )}
      </div>
    </form>
  );
}
