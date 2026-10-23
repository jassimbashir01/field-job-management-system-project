export function isInvoiceOverdue(invoice: {
  status: string;
  dueDate: string | null;
}): boolean {
  if (!invoice.dueDate) return false;
  if (invoice.status !== "sent" && invoice.status !== "viewed") return false;
  const today = new Date().toISOString().slice(0, 10);
  return invoice.dueDate < today;
}
