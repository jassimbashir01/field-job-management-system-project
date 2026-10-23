"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { reportPaymentAction } from "./actions";

export function InvoiceResponseActions({ token }: { token: string }) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function report() {
    setError(null);
    startTransition(async () => {
      const result = await reportPaymentAction(token);
      if (result.success) {
        router.refresh();
      } else {
        setConfirming(false);
        setError(
          result.error?.message ?? "Something went wrong. Please try again.",
        );
      }
    });
  }

  return (
    <div className="space-y-2">
      {!confirming ? (
        <Button onClick={() => setConfirming(true)}>I&apos;ve paid</Button>
      ) : (
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-sm">
            Only continue once you&apos;ve completed the payment — we&apos;ll
            then check that it has arrived.
          </p>
          <div className="flex gap-2">
            <Button disabled={isPending} onClick={report}>
              {isPending ? "Submitting…" : "Yes, I've paid"}
            </Button>
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() => setConfirming(false)}
            >
              Not yet
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
