export type ShiftState = "draft" | "changed" | "published" | "cancelled";

export function normalizeTime(value: string): string | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function minutesOf(time: string): number {
  const normalized = normalizeTime(time);
  if (!normalized) return Number.NaN;
  const [hours, minutes] = normalized.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export function timesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return (
    minutesOf(aStart) < minutesOf(bEnd) && minutesOf(bStart) < minutesOf(aEnd)
  );
}

export function formatTimeRange(start: string, end: string): string {
  return `${normalizeTime(start) ?? start}–${normalizeTime(end) ?? end}`;
}

export function needsAnnouncing(row: {
  status: "draft" | "published" | "cancelled";
  notifiedAt: Date | null;
  updatedAt: Date;
}): boolean {
  if (row.status === "draft") return true;
  return row.notifiedAt === null || row.updatedAt > row.notifiedAt;
}

export function shiftState(row: {
  status: "draft" | "published" | "cancelled";
  notifiedAt: Date | null;
  updatedAt: Date;
}): ShiftState {
  if (row.status === "draft") return "draft";
  if (row.status === "cancelled") return "cancelled";
  return needsAnnouncing(row) ? "changed" : "published";
}

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
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parts(dateString: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

export function dayLabelOf(dateString: string): string {
  const p = parts(dateString);
  if (!p) return dateString;
  const date = new Date(p.y, p.m - 1, p.d);
  return `${DAYS[date.getDay()] ?? ""} ${p.d} ${MONTHS[p.m - 1] ?? ""}`;
}

export function shortDateOf(dateString: string): string {
  const p = parts(dateString);
  return p ? `${p.d} ${MONTHS[p.m - 1] ?? ""}` : dateString;
}
