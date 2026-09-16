"use client";

import { useState, useTransition } from "react";
import {
  JOB_STATUS_LABELS,
  JOB_STATUS_TRANSITIONS,
  type JobStatus,
} from "@/lib/job-status";
import { transitionJobStatusAction } from "./actions";

export function JobStatusQuickSelect({
  jobId,
  status,
  disabled,
}: {
  jobId: string;
  status: JobStatus;
  disabled?: boolean;
}) {
  const [current, setCurrent] = useState(status);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const options = [current, ...JOB_STATUS_TRANSITIONS[current]];

  if (disabled || options.length <= 1) {
    return (
      <span className="text-xs text-muted-foreground">
        {JOB_STATUS_LABELS[current]}
      </span>
    );
  }

  return (
    <div
      onClick={(e) => e.preventDefault()}
      className="flex flex-col items-end gap-1"
    >
      <select
        value={current}
        disabled={isPending}
        onChange={(e) => {
          const next = e.target.value as JobStatus;
          const previous = current;
          setCurrent(next);
          setError(null);
          startTransition(async () => {
            const result = await transitionJobStatusAction(jobId, next);
            if (!result.success) {
              setCurrent(previous);
              setError(result.error?.message ?? "Couldn't update status.");
            }
          });
        }}
        className="rounded-full border px-2 py-0.5 text-xs font-medium disabled:opacity-50"
        style={{
          color: `var(--status-${current.replace(/_/g, "-")})`,
          borderColor: `var(--status-${current.replace(/_/g, "-")})`,
        }}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {JOB_STATUS_LABELS[option]}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
