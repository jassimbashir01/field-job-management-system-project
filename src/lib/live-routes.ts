export type LiveKey =
  | "customers"
  | "sites"
  | "equipment"
  | "jobs"
  | "quotes"
  | "invoices"
  | "notifications";

const ALL_DATA: LiveKey[] = [
  "customers",
  "sites",
  "equipment",
  "jobs",
  "quotes",
  "invoices",
];

const RULES: Array<{ prefix: string; keys: LiveKey[] }> = [
  { prefix: "/dashboard", keys: [...ALL_DATA, "notifications"] },
  {
    prefix: "/jobs",
    keys: ["jobs", "customers", "sites", "equipment", "quotes", "invoices"],
  },
  { prefix: "/schedule", keys: ["jobs", "customers", "sites"] },
  {
    prefix: "/quotes",
    keys: ["quotes", "customers", "sites", "jobs", "invoices"],
  },
  {
    prefix: "/invoices",
    keys: ["invoices", "customers", "sites", "jobs", "quotes"],
  },
  {
    prefix: "/customers",
    keys: ["customers", "sites", "jobs", "quotes", "invoices"],
  },
  {
    prefix: "/sites",
    keys: ["sites", "customers", "equipment", "jobs", "quotes", "invoices"],
  },
  { prefix: "/equipment", keys: ["equipment", "sites", "jobs"] },
  { prefix: "/notifications", keys: ["notifications"] },
];

export function relevantKeys(pathname: string): LiveKey[] {
  const rule = RULES.find(
    (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`),
  );
  return rule?.keys ?? [];
}
