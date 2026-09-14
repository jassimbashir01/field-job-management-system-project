"use client";

import { JOB_STATUS_LABELS } from "@/lib/job-status";

export function JobStatusFilter({ currentStatus }: { currentStatus: string }) {
  return (
    <select
      name="status"
      defaultValue={currentStatus}
      onChange={(e) => e.currentTarget.form?.submit()}
      className="rounded-md border border-input px-3 py-2 text-sm"
    >
      <option value="">All statuses</option>
      {Object.entries(JOB_STATUS_LABELS).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
