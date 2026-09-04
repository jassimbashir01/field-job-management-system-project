export interface QuickActionConfig {
  label: string;
  href: string;
}

export const QUICK_ACTIONS: QuickActionConfig[] = [
  { label: "Create Customer", href: "/customers/new" },
  { label: "Create Site", href: "/sites/new" },
];
