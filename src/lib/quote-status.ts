export function isQuoteExpired(quote: { expiresAt: string | null }): boolean {
  if (!quote.expiresAt) return false;
  const today = new Date().toISOString().slice(0, 10);
  return quote.expiresAt < today;
}
