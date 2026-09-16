"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { JobStatusBadge } from "@/components/shared/job-status-badge";
import type { JobStatus } from "@/lib/job-status";
import { reassignJobAction } from "./actions";

interface WeekJob {
  id: string;
  jobNumber: number;
  title: string;
  status: JobStatus;
  scheduledDate: string | null;
  assignedToUserId: string | null;
  customerName: string;
  siteName: string | null;
}

interface Technician {
  id: string;
  displayName: string;
}

export function ScheduleJobCard({
  job,
  technicians,
  weekDates,
  disabled,
}: {
  job: WeekJob;
  technicians: Technician[];
  weekDates: string[];
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [assignedTo, setAssignedTo] = useState(job.assignedToUserId ?? "");
  const [date, setDate] = useState(job.scheduledDate ?? weekDates[0] ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <div className="space-y-1 rounded-md border p-2 text-xs">
        <Link href={`/jobs/${job.id}`} className="block hover:underline">
          <p className="font-medium">
            #{job.jobNumber} — {job.title}
          </p>
          <p className="text-muted-foreground">
            {job.customerName}
            {job.siteName && ` · ${job.siteName}`}
          </p>
        </Link>
        <div className="flex items-center justify-between">
          <JobStatusBadge status={job.status} />
          {!disabled && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-muted-foreground underline hover:text-foreground"
            >
              Reassign
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1 rounded-md border p-2 text-xs">
      <select
        value={assignedTo}
        onChange={(e) => setAssignedTo(e.target.value)}
        className="w-full rounded border px-1 py-1 text-xs"
      >
        <option value="">Unassigned</option>
        {technicians.map((technician) => (
          <option key={technician.id} value={technician.id}>
            {technician.displayName}
          </option>
        ))}
      </select>
      <select
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full rounded border px-1 py-1 text-xs"
      >
        {weekDates.map((weekDate) => (
          <option key={weekDate} value={weekDate}>
            {weekDate}
          </option>
        ))}
      </select>
      {error && <p className="text-destructive">{error}</p>}
      <div className="flex gap-1">
        <Button
          size="sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await reassignJobAction(
                job.id,
                assignedTo || null,
                date || null,
              );
              if (result.success) {
                setEditing(false);
              } else {
                setError(result.error?.message ?? "Couldn't reassign.");
              }
            })
          }
        >
          {isPending ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
