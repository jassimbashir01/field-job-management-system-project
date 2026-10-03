"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  JOB_STATUS_LABELS,
  JOB_STATUS_TRANSITIONS,
  type JobStatus,
} from "@/lib/job-status";
import {
  reopenJobAction,
  transitionJobStatusAction,
  type FormState,
} from "../actions";

const AUTO_STATUS_HINTS: Partial<Record<JobStatus, string>> = {
  draft:
    "Add a scheduled date to move this job to Scheduled automatically — add a technician too, and it moves straight to Assigned.",
  scheduled:
    "Will move to Assigned automatically once a technician is assigned.",
  assigned:
    "Fully scheduled and assigned — removing the date or the technician will move it back automatically.",
};

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
  const autoHint = AUTO_STATUS_HINTS[status];
  const canReopen = status === "incomplete";
  const hasButtons = nextStatuses.length > 0 || canReopen;

  if (!hasButtons && !autoHint) {
    return null;
  }

  function runTransition(action: () => Promise<FormState>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error?.message ?? "Couldn't update status.");
      }
    });
  }

  return (
    <div className="space-y-2">
      {hasButtons && <h2 className="text-sm font-semibold">Move to</h2>}
      {autoHint && <p className="text-xs text-muted-foreground">{autoHint}</p>}
      {hasButtons && (
        <div className="flex flex-wrap gap-3">
          {nextStatuses.map((nextStatus) => (
            <Button
              key={nextStatus}
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() =>
                runTransition(() =>
                  transitionJobStatusAction(jobId, nextStatus),
                )
              }
            >
              {JOB_STATUS_LABELS[nextStatus]}
            </Button>
          ))}
          {canReopen && (
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => runTransition(() => reopenJobAction(jobId))}
            >
              Reopen
            </Button>
          )}
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
