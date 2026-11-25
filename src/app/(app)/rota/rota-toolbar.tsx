"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { copyPreviousWeekAction, publishWeekAction } from "./actions";

export function RotaToolbar({
  weekStart,
  pendingCount,
  peopleToTell,
  canWrite,
}: {
  weekStart: string;
  pendingCount: number;
  peopleToTell: number;
  canWrite: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canWrite) return null;

  const run = (task: () => ReturnType<typeof publishWeekAction>) =>
    startTransition(async () => {
      setMessage(null);
      setError(null);
      const result = await task();
      setConfirming(false);
      if (result.success) setMessage(result.message);
      else setError(result.error?.message ?? "Something went wrong.");
    });

  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => run(() => copyPreviousWeekAction(weekStart))}
        >
          Copy previous week
        </Button>

        {!confirming ? (
          <Button
            type="button"
            size="sm"
            disabled={isPending || pendingCount === 0}
            onClick={() => setConfirming(true)}
          >
            {pendingCount === 0
              ? "Nothing to publish"
              : `Publish week (${pendingCount})`}
          </Button>
        ) : (
          <span className="flex flex-wrap items-center gap-2 text-sm">
            Publish and email {peopleToTell}{" "}
            {peopleToTell === 1 ? "person" : "people"}?
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={() => run(() => publishWeekAction(weekStart))}
            >
              {isPending ? "Publishing…" : "Confirm"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
          </span>
        )}
      </div>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
