export interface QuickActionConfig {
  label: string;
  href: string;
  resourceKey: string;
}

export const QUICK_ACTIONS: QuickActionConfig[] = [
  { label: "Create Job", href: "/jobs/new", resourceKey: "jobs" },
  {
    label: "Create Customer",
    href: "/customers/new",
    resourceKey: "customers",
  },
  { label: "Create Site", href: "/sites/new", resourceKey: "sites" },
  {
    label: "Create Equipment",
    href: "/equipment/new",
    resourceKey: "equipment",
  },
];
