import type { ActivityLogEntry } from "@/lib/activity-log";

function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function ActivityTimeline({ entries }: { entries: ActivityLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map((entry) => (
        <div key={entry.id} className="flex gap-3 text-sm">
          <div className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
          <div>
            <p>
              <span className="font-medium">{entry.actorDisplayName}</span>{" "}
              {entry.summary}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatTimestamp(entry.createdAt)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
