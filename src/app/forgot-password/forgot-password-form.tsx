"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordResetAction, type ForgotState } from "./actions";

const initialState: ForgotState = { status: "idle", message: null };

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    requestPasswordResetAction,
    initialState,
  );

  if (state.status === "sent") {
    return (
      <div className="space-y-4">
        <p role="status" className="text-sm">
          {state.message}
        </p>
        <p className="text-sm text-muted-foreground">
          Nothing arrived? Check your spam folder, or wait a couple of minutes
          and try again.
        </p>
        <Button
          render={<Link href="/login">Back to sign in</Link>}
          nativeButton={false}
          variant="outline"
        />
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
        />
      </div>
      {state.status === "error" && state.message && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Sending…" : "Email me a reset link"}
      </Button>
      <p className="text-center text-sm">
        <Link
          href="/login"
          className="text-muted-foreground underline underline-offset-4"
        >
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
