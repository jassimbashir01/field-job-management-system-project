export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

function safeZone(timeZone: string): string {
  return isValidTimeZone(timeZone) ? timeZone : "UTC";
}

interface Parts {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
}

function partsOf(instant: Date, timeZone: string): Parts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const get = (type: string) =>
    Number(
      formatter.formatToParts(instant).find((p) => p.type === type)?.value ??
        "0",
    );
  return {
    y: get("year"),
    mo: get("month"),
    d: get("day"),
    h: get("hour"),
    mi: get("minute"),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function localDateOf(instant: Date, timeZone: string): string {
  const p = partsOf(instant, timeZone);
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}`;
}

export function localTimeOf(instant: Date, timeZone: string): string {
  const p = partsOf(instant, timeZone);
  return `${pad(p.h)}:${pad(p.mi)}`;
}

export function toLocalInput(instant: Date, timeZone: string): string {
  return `${localDateOf(instant, timeZone)}T${localTimeOf(instant, timeZone)}`;
}

/** How far ahead of UTC the zone is at this instant, in minutes. */
function offsetMinutes(instant: Date, timeZone: string): number {
  const p = partsOf(instant, timeZone);
  const asUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi);
  const truncated = Math.floor(instant.getTime() / 60_000) * 60_000;
  return Math.round((asUtc - truncated) / 60_000);
}

export function fromLocalInput(value: string, timeZone: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [y, mo, d, h, mi] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  const check = new Date(Date.UTC(y, mo - 1, d, h, mi));
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== mo - 1 ||
    check.getUTCDate() !== d ||
    h > 23 ||
    mi > 59
  ) {
    return null;
  }
  const guess = check.getTime();
  const zone = safeZone(timeZone);
  const first = offsetMinutes(new Date(guess), zone);
  let result = guess - first * 60_000;
  const second = offsetMinutes(new Date(result), zone);
  if (second !== first) result = guess - second * 60_000;
  return new Date(result);
}
