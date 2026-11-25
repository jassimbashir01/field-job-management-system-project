export const STALE_PUNCH_HOURS = 16;
export const MAX_PUNCH_HOURS = 24;

export function durationMinutes(
  punchedInAt: Date,
  punchedOutAt: Date | null,
  now: Date,
): number {
  const end = punchedOutAt ?? now;
  return Math.max(
    0,
    Math.round((end.getTime() - punchedInAt.getTime()) / 60_000),
  );
}

export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function isStale(punchedInAt: Date, now: Date): boolean {
  return now.getTime() - punchedInAt.getTime() > STALE_PUNCH_HOURS * 3_600_000;
}

export function exceedsMaxLength(
  punchedInAt: Date,
  punchedOutAt: Date,
): boolean {
  return (
    punchedOutAt.getTime() - punchedInAt.getTime() > MAX_PUNCH_HOURS * 3_600_000
  );
}

export function punchesOverlap(
  aIn: Date,
  aOut: Date | null,
  bIn: Date,
  bOut: Date | null,
): boolean {
  const aEnd = aOut ? aOut.getTime() : Number.POSITIVE_INFINITY;
  const bEnd = bOut ? bOut.getTime() : Number.POSITIVE_INFINITY;
  return aIn.getTime() < bEnd && bIn.getTime() < aEnd;
}

export function mapLink(latitude: number, longitude: number): string {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
}
