"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useResetTokenAction, type ResetState } from "./actions";

const initialState: ResetState = { status: "idle", message: null };

export function ResetPasswordForm({ token }: { token: string }) {
  const boundAction = useResetTokenAction.bind(null, token);
  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialState,
  );

  if (state.status === "success") {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm">
          Password updated. You can sign in with it now.
        </p>
        <Button
          render={<Link href="/login">Go to sign in</Link>}
          nativeButton={false}
        />
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
