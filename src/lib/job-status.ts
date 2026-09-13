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
  draft: ["scheduled", "cancelled"],
  scheduled: ["assigned", "cancelled"],
  assigned: ["traveling", "scheduled", "cancelled"],
  traveling: ["arrived", "cancelled"],
  arrived: ["in_progress", "cancelled"],
  in_progress: ["paused", "completed", "incomplete", "cancelled"],
  paused: ["in_progress", "incomplete", "cancelled"],
  completed: [],
  incomplete: ["scheduled"],
  cancelled: [],
};

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return JOB_STATUS_TRANSITIONS[from].includes(to);
}
