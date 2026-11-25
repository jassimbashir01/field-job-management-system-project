import { HOLIDAY_STATUS_LABELS, type HolidayStatus } from "@/lib/holidays";

const COLOR_VAR: Record<HolidayStatus, string> = {
  sent: "var(--status-scheduled)",
  viewed: "var(--status-traveling)",
  accepted: "var(--status-completed)",
  rejected: "var(--status-incomplete)",
};

export function HolidayStatusBadge({ status }: { status: HolidayStatus }) {
  const color = COLOR_VAR[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{ color, borderColor: color }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {HOLIDAY_STATUS_LABELS[status]}
    </span>
  );
}
