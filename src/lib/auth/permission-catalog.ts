export const PERMISSIONS = {
  JOBS_CREATE: "jobs:create",
  JOBS_EDIT: "jobs:edit",
  JOBS_SCHEDULE: "jobs:schedule",
  JOBS_ASSIGN: "jobs:assign",
  CUSTOMERS_MANAGE: "customers:manage",
  SITES_MANAGE: "sites:manage",
  TEMPLATES_MANAGE: "templates:manage",
  REPORTS_VIEW: "reports:view",
  TEAM_RESET_PASSWORD: "team:reset_password",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
