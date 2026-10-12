import type { quotes } from "@/db/schema";

type QuoteStatus = (typeof quotes.$inferSelect)["status"];

const LABELS: Record<QuoteStatus | "expired", string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
};

const COLOR_VAR: Record<QuoteStatus | "expired", string> = {
  draft: "var(--status-draft)",
  sent: "var(--status-scheduled)",
  viewed: "var(--status-traveling)",
  accepted: "var(--status-completed)",
  declined: "var(--status-incomplete)",
  expired: "var(--status-paused)",
};

export function QuoteStatusBadge({
  status,
  expired = false,
}: {
  status: QuoteStatus;
  expired?: boolean;
}) {
  const shown: QuoteStatus | "expired" =
    expired && status !== "accepted" && status !== "declined"
      ? "expired"
      : status;
  const color = COLOR_VAR[shown];

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{ color, borderColor: color }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {LABELS[shown]}
    </span>
  );
}
