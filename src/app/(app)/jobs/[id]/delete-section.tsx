"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { jobs } from "@/db/schema";
import { deleteJobAction } from "../actions";

type Job = typeof jobs.$inferSelect;

export function JobDeleteSection({
  job,
  canDelete,
}: {
  job: Job;
  canDelete: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!canDelete) return null;

  const confirmValue = `${job.jobNumber}`;

  if (!confirming) {
    return (
      <div>
        <h2 className="text-sm font-semibold">Delete job</h2>
        <p className="mt-1 mb-2 text-xs text-muted-foreground">
          Permanent — cannot be undone.
        </p>
        <Button variant="destructive" onClick={() => setConfirming(true)}>
          Delete job #{job.jobNumber}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Delete job</h2>
      <p className="text-xs text-muted-foreground">
        Type <strong>{confirmValue}</strong> to confirm — this is permanent.
      </p>
      <Input
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        className="max-w-xs"
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          variant="destructive"
          disabled={confirmText !== confirmValue || isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteJobAction(job.id);
              if (!result.success && result.error) {
                setError(result.error.message);
              }
            })
          }
        >
          {isPending ? "Deleting…" : "Confirm delete"}
        </Button>
        <Button variant="outline" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
