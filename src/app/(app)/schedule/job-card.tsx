"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { JobStatusBadge } from "@/components/shared/job-status-badge";
import type { JobStatus } from "@/lib/job-status";
import { isDateTimeInPast, todayDateString } from "@/lib/week";
import { reassignJobAction } from "./actions";

interface WeekJob {
  id: string;
  jobNumber: number;
  title: string;
  status: JobStatus;
  scheduledDate: string | null;
  scheduledTime: string | null;
  assignedToUserId: string | null;
  customerName: string;
  siteName: string | null;
  oneOffLocation: string | null;
}

interface Technician {
  id: string;
  displayName: string;
}

export function ScheduleJobCard({
  job,
  technicians,
  disabled,
}: {
  job: WeekJob;
  technicians: Technician[];
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [assignedTo, setAssignedTo] = useState(job.assignedToUserId ?? "");
  const [date, setDate] = useState(job.scheduledDate ?? todayDateString());
  const [time, setTime] = useState(job.scheduledTime ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const location = job.siteName ?? job.oneOffLocation;

  if (!editing) {
    return (
      <div className="space-y-1 rounded-md border p-2 text-xs">
        <Link href={`/jobs/${job.id}`} className="block hover:underline">
          <p className="font-medium">
            #{job.jobNumber} — {job.title}
          </p>
          <p className="text-muted-foreground">
            {job.customerName}
            {location && ` · ${location}`}
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
      <input
        type="date"
        value={date}
        min={todayDateString()}
        onChange={(e) => setDate(e.target.value)}
        className="w-full rounded border px-1 py-1 text-xs"
      />
      <input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="w-full rounded border px-1 py-1 text-xs"
      />
      {error && <p className="text-destructive">{error}</p>}
      <div className="flex gap-1">
        <Button
          size="sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              if (isDateTimeInPast(date, time)) {
                setError("Can't schedule a job in the past.");
                return;
              }
              const result = await reassignJobAction(
                job.id,
                assignedTo || null,
                date || null,
                time || null,
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
