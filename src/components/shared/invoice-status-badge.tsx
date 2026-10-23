import type { invoices } from "@/db/schema";

type InvoiceStatus = (typeof invoices.$inferSelect)["status"];
type Shown = InvoiceStatus | "overdue";

const LABELS: Record<Shown, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  payment_reported: "Payment reported",
  paid: "Paid",
  void: "Void",
  overdue: "Overdue",
};

const COLOR_VAR: Record<Shown, string> = {
  draft: "var(--status-draft)",
  sent: "var(--status-scheduled)",
  viewed: "var(--status-traveling)",
  payment_reported: "var(--status-in-progress)",
  paid: "var(--status-completed)",
  void: "var(--status-cancelled)",
  overdue: "var(--status-incomplete)",
};

export function InvoiceStatusBadge({
  status,
  overdue = false,
}: {
  status: InvoiceStatus;
  overdue?: boolean;
}) {
  const shown: Shown =
    overdue && (status === "sent" || status === "viewed") ? "overdue" : status;
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
