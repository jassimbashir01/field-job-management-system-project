import { ValidationError, NotFoundError } from "@/lib/errors";
import { formatDuration } from "@/lib/punch";
import {
  getPunchSettings,
  getTeamMemberName,
  listCompletedJobs,
  listPunches,
} from "@/lib/punch-data";
import { localDateOf } from "@/lib/punch-time";
import { daysInclusive } from "@/lib/holidays";
import { dayLabelOf } from "@/lib/rota";
import { loadBranding } from "./load-document";
import type { AttendanceModel } from "./attendance-pdf";

const MAX_RANGE_DAYS = 92;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function loadAttendance(
  userId: string,
  fromDate: string,
  toDate: string,
): Promise<{ model: AttendanceModel; fileName: string }> {
  if (!DATE.test(fromDate) || !DATE.test(toDate)) {
    throw new ValidationError("Choose a valid start and end date.");
  }
  const length = daysInclusive(fromDate, toDate);
  if (length < 1)
    throw new ValidationError("The end date can't be before the start date.");
  if (length > MAX_RANGE_DAYS) {
    throw new ValidationError(
      `Choose a period of at most ${MAX_RANGE_DAYS} days.`,
    );
  }

  const personName = await getTeamMemberName(userId);
  if (!personName)
    throw new NotFoundError("That team member couldn't be found.");

  const settings = await getPunchSettings();
  const now = new Date();
  const [rows, jobs, { branding }] = await Promise.all([
    listPunches(userId, fromDate, toDate, settings.timeZone, now),
    listCompletedJobs(userId, fromDate, toDate, settings.timeZone),
    loadBranding(),
  ]);

  const byDay = new Map<string, AttendanceModel["days"][number]["punches"]>();
  let total = 0;
  for (const p of rows) {
    total += p.minutes;
    const notes = [
      p.source === "manager"
        ? "added by a manager"
        : p.edited
          ? "edited by a manager"
          : null,
      p.inLocation.status === "unavailable" ||
      p.outLocation.status === "unavailable"
        ? "location unavailable"
        : null,
    ]
      .filter((n): n is string => n !== null)
      .join(", ");
    const entry = {
      time: `${p.inTime} – ${p.open ? "still in" : `${p.outTime ?? ""}${p.outDate ? ` (${p.outDate})` : ""}`}`,
      duration: formatDuration(p.minutes),
      notes,
    };
    byDay.set(p.date, [...(byDay.get(p.date) ?? []), entry]);
  }

  const model: AttendanceModel = {
    personName,
    fromDate,
    toDate,
    timeZone: settings.timeZone,
    days: [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, punches]) => ({ label: dayLabelOf(date), punches })),
    totalLabel: formatDuration(total),
    jobs: jobs.map((j) => ({
      jobNumber: j.jobNumber,
      title: j.title,
      completedOn: j.completedOn,
    })),
    generatedOn: localDateOf(now, settings.timeZone),
    branding,
  };

  const slug =
    personName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "person";
  return { model, fileName: `attendance-${slug}-${fromDate}-to-${toDate}.pdf` };
}
