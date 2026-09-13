import { JOB_STATUS_LABELS, type JobStatus } from "@/lib/job-status";

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{
        color: `var(--status-${status.replace(/_/g, "-")})`,
        borderColor: `var(--status-${status.replace(/_/g, "-")})`,
      }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{
          backgroundColor: `var(--status-${status.replace(/_/g, "-")})`,
        }}
      />
      {JOB_STATUS_LABELS[status]}
    </span>
  );
}
