function parseDateString(dateString: string): {
  year: number;
  month: number;
  day: number;
} {
  const [year, month, day] = dateString.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`Invalid date string: "${dateString}"`);
  }
  return { year, month, day };
}

export function getWeekDates(anchorDateString: string): string[] {
  const { year, month, day } = parseDateString(anchorDateString);
  const anchor = new Date(year, month - 1, day);
  const dayOfWeek = anchor.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() + diffToMonday);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(formatDateString(d));
  }
  return dates;
}

function formatDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(dateString: string, days: number): string {
  const { year, month, day } = parseDateString(dateString);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return formatDateString(date);
}

export function todayDateString(): string {
  return formatDateString(new Date());
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function weekdayLabel(index: number): string {
  return WEEKDAY_LABELS[index] ?? "";
}
