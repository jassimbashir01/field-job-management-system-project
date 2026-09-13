import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  LayoutDashboard,
  MapPin,
  Settings,
  Users2,
  Users,
  Wrench,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  resourceKey?: string;
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Jobs", href: "/jobs", icon: Briefcase, resourceKey: "jobs" },
  {
    label: "Customers",
    href: "/customers",
    icon: Users2,
    resourceKey: "customers",
  },
  { label: "Sites", href: "/sites", icon: MapPin, resourceKey: "sites" },
  {
    label: "Equipment",
    href: "/equipment",
    icon: Wrench,
    resourceKey: "equipment",
  },
  { label: "Team", href: "/team", icon: Users, resourceKey: "team" },
  { label: "Settings", href: "/settings", icon: Settings, adminOnly: true },
];
