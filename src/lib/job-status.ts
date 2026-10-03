export type JobStatus =
  | "draft"
  | "scheduled"
  | "assigned"
  | "traveling"
  | "arrived"
  | "in_progress"
  | "paused"
  | "completed"
  | "incomplete"
  | "cancelled";

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  assigned: "Assigned",
  traveling: "Traveling",
  arrived: "Arrived",
  in_progress: "In Progress",
  paused: "Paused",
  completed: "Completed",
  incomplete: "Incomplete",
  cancelled: "Cancelled",
};

export const JOB_STATUS_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  draft: ["cancelled"],
  scheduled: ["cancelled"],
  assigned: ["traveling", "cancelled"],
  traveling: ["arrived", "cancelled"],
  arrived: ["in_progress", "cancelled"],
  in_progress: ["paused", "completed", "incomplete", "cancelled"],
  paused: ["in_progress", "incomplete", "cancelled"],
  completed: [],
  incomplete: [],
  cancelled: [],
};

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return JOB_STATUS_TRANSITIONS[from].includes(to);
}

const AUTO_MANAGED_STATUSES: JobStatus[] = ["draft", "scheduled", "assigned"];

export function deriveStatusFromData(
  hasSchedule: boolean,
  hasAssignment: boolean,
): JobStatus {
  if (hasSchedule && hasAssignment) return "assigned";
  if (hasSchedule) return "scheduled";
  return "draft";
}

export function computeAutoStatus(
  currentStatus: JobStatus,
  hasSchedule: boolean,
  hasAssignment: boolean,
): JobStatus {
  if (!AUTO_MANAGED_STATUSES.includes(currentStatus)) {
    return currentStatus;
  }
  return deriveStatusFromData(hasSchedule, hasAssignment);
}
