export interface LineItemLike {
  quantity: string | number;
  unitPriceCents: number;
}

export function computeLineTotalCents(item: LineItemLike): number {
  return Math.round(Number(item.quantity) * item.unitPriceCents);
}

export function computeTotalCents(items: LineItemLike[]): number {
  return items.reduce((sum, item) => sum + computeLineTotalCents(item), 0);
}

export function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}
