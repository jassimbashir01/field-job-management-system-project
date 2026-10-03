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
  scheduledDate,
  scheduledTime,
  assignedToUserId,
}: {
  jobId: string;
  status: JobStatus;
  scheduledDate: string | null;
  scheduledTime: string | null;
  assignedToUserId: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const nextStatuses = JOB_STATUS_TRANSITIONS[status];

  if (nextStatuses.length === 0) {
    return null;
  }

  function blockedReason(nextStatus: JobStatus): string | null {
    if (nextStatus === "scheduled" && (!scheduledDate || !scheduledTime)) {
      return "Set a scheduled date and time on the job first.";
    }
    if (nextStatus === "assigned" && !assignedToUserId) {
      return "Assign a technician to the job first.";
    }
    return null;
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Move to</h2>
      <div className="flex flex-wrap gap-3">
        {nextStatuses.map((nextStatus) => {
          const reason = blockedReason(nextStatus);
          return (
            <div key={nextStatus} className="flex flex-col items-start gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={isPending || Boolean(reason)}
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
              {reason && (
                <p className="max-w-[10rem] text-xs text-muted-foreground">
                  {reason}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
