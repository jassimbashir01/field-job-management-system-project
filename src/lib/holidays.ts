export type HolidayStatus = "sent" | "viewed" | "accepted" | "rejected";

export const HOLIDAY_STATUS_LABELS: Record<HolidayStatus, string> = {
  sent: "Sent",
  viewed: "Viewed",
  accepted: "Accepted",
  rejected: "Rejected",
};

export const MAX_HOLIDAY_DAYS = 90;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function parts(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

export function daysInclusive(start: string, end: string): number {
  const a = parts(start);
  const b = parts(end);
  if (!a || !b) return 0;
  const ms = Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d);
  return Math.round(ms / 86_400_000) + 1;
}

export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export function dateInRange(day: string, start: string, end: string): boolean {
  return day >= start && day <= end;
}

export function formatDateRange(start: string, end: string): string {
  const a = parts(start);
  const b = parts(end);
  if (!a || !b) return `${start} – ${end}`;
  const left = `${a.d} ${MONTHS[a.m - 1] ?? ""}`;
  const right = `${b.d} ${MONTHS[b.m - 1] ?? ""} ${b.y}`;
  if (start === end) return right;
  return a.y === b.y ? `${left} – ${right}` : `${left} ${a.y} – ${right}`;
}
