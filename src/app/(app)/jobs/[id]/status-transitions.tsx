"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  JOB_STATUS_LABELS,
  JOB_STATUS_TRANSITIONS,
  type JobStatus,
} from "@/lib/job-status";
import { transitionJobStatusAction } from "../actions";

export function StatusTransitions({
  jobId,
  status,
}: {
  jobId: string;
  status: JobStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const nextStatuses = JOB_STATUS_TRANSITIONS[status];

  if (nextStatuses.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Move to</h2>
      <div className="flex flex-wrap gap-2">
        {nextStatuses.map((nextStatus) => (
          <Button
            key={nextStatus}
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await transitionJobStatusAction(
                  jobId,
                  nextStatus,
                );
                if (!result.success && result.error) {
                  setError(result.error.message);
                }
              })
            }
          >
            {JOB_STATUS_LABELS[nextStatus]}
          </Button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
