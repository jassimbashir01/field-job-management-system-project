"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { acceptQuoteAction, declineQuoteAction } from "./actions";

export function QuoteResponseActions({ token }: { token: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function respond(
    action: (
      token: string,
    ) => Promise<{ success: boolean; error?: { message: string } }>,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action(token);
      if (result.success) {
        router.refresh();
      } else {
        setError(
          result.error?.message ?? "Something went wrong. Please try again.",
        );
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        <Button disabled={isPending} onClick={() => respond(acceptQuoteAction)}>
          {isPending ? "Submitting…" : "Accept quote"}
        </Button>
        <Button
          variant="outline"
          disabled={isPending}
          onClick={() => respond(declineQuoteAction)}
        >
          {isPending ? "Submitting…" : "Decline"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
