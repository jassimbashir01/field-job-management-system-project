export const NOTIFICATION_CATEGORIES = [
  {
    key: "invoice_payment_reported",
    label: "A customer says they've paid an invoice",
    resourceKey: "invoices",
  },
  {
    key: "quote_accepted",
    label: "A customer accepts a quote",
    resourceKey: "quotes",
  },
  {
    key: "quote_declined",
    label: "A customer declines a quote",
    resourceKey: "quotes",
  },
] as const;

export type NotificationCategory =
  (typeof NOTIFICATION_CATEGORIES)[number]["key"];

export const DEFAULT_IN_APP = true;
export const DEFAULT_EMAIL = false;

export function getCategory(key: string) {
  return NOTIFICATION_CATEGORIES.find((c) => c.key === key);
}
