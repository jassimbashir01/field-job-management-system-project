export type AccessLevel = "read" | "write" | "delete";

export interface ResourceConfig {
  key: string;
  label: string;
  maxLevel: AccessLevel;
}

/**
 * Every resource a permission level can apply to, across the whole
 * project. Extended purely in code as each phase adds one — "equipment"
 * (Phase 10), "jobs" (Phase 11), and onward. Adding a resource here is
 * never a migration.
 */
export const RESOURCES: ResourceConfig[] = [
  { key: "customers", label: "Customers", maxLevel: "delete" },
  { key: "sites", label: "Sites", maxLevel: "delete" },
  { key: "team", label: "Team (view + reset passwords)", maxLevel: "write" },
];

const LEVEL_ORDER: AccessLevel[] = ["read", "write", "delete"];

export function permissionKey(resourceKey: string, level: AccessLevel): string {
  return `${resourceKey}:${level}`;
}

export function levelsUpTo(level: AccessLevel): AccessLevel[] {
  const index = LEVEL_ORDER.indexOf(level);
  return LEVEL_ORDER.slice(0, index + 1);
}

export function getCurrentLevel(
  resourceKey: string,
  grantedKeys: Set<string>,
): AccessLevel | "none" {
  for (let i = LEVEL_ORDER.length - 1; i >= 0; i--) {
    const level = LEVEL_ORDER[i];
    if (level && grantedKeys.has(permissionKey(resourceKey, level))) {
      return level;
    }
  }
  return "none";
}

export const PERMISSIONS = {
  CUSTOMERS_READ: permissionKey("customers", "read"),
  CUSTOMERS_WRITE: permissionKey("customers", "write"),
  CUSTOMERS_DELETE: permissionKey("customers", "delete"),
  SITES_READ: permissionKey("sites", "read"),
  SITES_WRITE: permissionKey("sites", "write"),
  SITES_DELETE: permissionKey("sites", "delete"),
  TEAM_READ: permissionKey("team", "read"),
  TEAM_WRITE: permissionKey("team", "write"),
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
