"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAutoDismiss } from "@/hooks/use-auto-dismiss";
import {
  generateResetLinkAction,
  setTemporaryPasswordAction,
  type FormState,
  type ResetLinkState,
} from "../actions";

const initialFormState: FormState = { success: false, error: null };

export function PasswordResetSection({ userId }: { userId: string }) {
  const boundTempPasswordAction = setTemporaryPasswordAction.bind(null, userId);
  const [tempState, tempFormAction, tempPending] = useActionState(
    boundTempPasswordAction,
    initialFormState,
  );
  const showTempMessage = useAutoDismiss(
    tempState,
    Boolean(tempState.success || tempState.error),
  );

  const [linkState, setLinkState] = useState<ResetLinkState | null>(null);
  const [linkPending, startLinkTransition] = useTransition();

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold">Password</h2>

      <form action={tempFormAction} className="space-y-2">
        <Label htmlFor="tempPassword">Set a temporary password</Label>
        <div className="flex gap-2">
          <Input
            id="tempPassword"
            name="password"
            type="password"
            minLength={8}
            required
            className="max-w-xs"
          />
          <Button type="submit" variant="outline" disabled={tempPending}>
            {tempPending ? "Setting…" : "Set password"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          They&apos;ll be required to change it on their next sign-in.
        </p>
        {showTempMessage && tempState.error && (
          <p role="alert" className="text-sm text-destructive">
            {tempState.error.message}
          </p>
        )}
        {showTempMessage && tempState.success && (
          <p role="status" className="text-sm text-green-600">
            Password set.
          </p>
        )}
      </form>

      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          disabled={linkPending}
          onClick={() =>
            startLinkTransition(async () => {
              setLinkState(await generateResetLinkAction(userId));
            })
          }
        >
          {linkPending ? "Generating…" : "Generate reset link"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Valid for 1 hour, single-use. Copy it and send it however you normally
          would — automatic email delivery arrives in Phase 21.
        </p>
        {linkState?.link && (
          <Input
            readOnly
            value={linkState.link}
            onFocus={(e) => e.target.select()}
          />
        )}
        {linkState?.error && (
          <p role="alert" className="text-sm text-destructive">
            {linkState.error.message}
          </p>
        )}
      </div>
    </div>
  );
}
