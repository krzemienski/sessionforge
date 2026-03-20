export const PERMISSIONS = {
  CONTENT_READ: "content:read",
  CONTENT_CREATE: "content:create",
  CONTENT_EDIT: "content:edit",
  CONTENT_DELETE: "content:delete",
  CONTENT_APPROVE: "content:approve",
  SESSIONS_READ: "sessions:read",
  SESSIONS_SCAN: "sessions:scan",
  INSIGHTS_READ: "insights:read",
  INSIGHTS_EXTRACT: "insights:extract",
  INTEGRATIONS_READ: "integrations:read",
  INTEGRATIONS_MANAGE: "integrations:manage",
  PUBLISHING_PUBLISH: "publishing:publish",
  PUBLISHING_SCHEDULE: "publishing:schedule",
  ANALYTICS_READ: "analytics:read",
  ANALYTICS_MANAGE: "analytics:manage",
  WORKSPACE_SETTINGS: "workspace:settings",
  WORKSPACE_MEMBERS: "workspace:members",
  WORKSPACE_DELETE: "workspace:delete",
  WORKSPACE_BILLING: "workspace:billing",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLES = {
  OWNER: "owner",
  EDITOR: "editor",
  PUBLISHER: "publisher",
  REVIEWER: "reviewer",
  ANALYST: "analyst",
  VIEWER: "viewer",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

const ALL_PERMISSIONS: readonly Permission[] = Object.values(PERMISSIONS);

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [ROLES.OWNER]: ALL_PERMISSIONS,

  [ROLES.EDITOR]: [
    PERMISSIONS.CONTENT_READ,
    PERMISSIONS.CONTENT_CREATE,
    PERMISSIONS.CONTENT_EDIT,
    PERMISSIONS.CONTENT_DELETE,
    PERMISSIONS.SESSIONS_READ,
    PERMISSIONS.SESSIONS_SCAN,
    PERMISSIONS.INSIGHTS_READ,
    PERMISSIONS.INSIGHTS_EXTRACT,
    PERMISSIONS.PUBLISHING_PUBLISH,
    PERMISSIONS.PUBLISHING_SCHEDULE,
    PERMISSIONS.ANALYTICS_READ,
  ],

  [ROLES.PUBLISHER]: [
    PERMISSIONS.CONTENT_READ,
    PERMISSIONS.CONTENT_APPROVE,
    PERMISSIONS.PUBLISHING_PUBLISH,
    PERMISSIONS.PUBLISHING_SCHEDULE,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.INTEGRATIONS_READ,
  ],

  [ROLES.REVIEWER]: [
    PERMISSIONS.CONTENT_READ,
    PERMISSIONS.CONTENT_APPROVE,
    PERMISSIONS.SESSIONS_READ,
    PERMISSIONS.INSIGHTS_READ,
    PERMISSIONS.ANALYTICS_READ,
  ],

  [ROLES.ANALYST]: [
    PERMISSIONS.CONTENT_READ,
    PERMISSIONS.SESSIONS_READ,
    PERMISSIONS.INSIGHTS_READ,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.ANALYTICS_MANAGE,
  ],

  [ROLES.VIEWER]: [
    PERMISSIONS.CONTENT_READ,
    PERMISSIONS.SESSIONS_READ,
    PERMISSIONS.INSIGHTS_READ,
    PERMISSIONS.INTEGRATIONS_READ,
    PERMISSIONS.ANALYTICS_READ,
  ],
};

export function hasPermission(
  role: Role,
  permission: Permission,
  customPermissions?: readonly Permission[]
): boolean {
  if (customPermissions) {
    return customPermissions.includes(permission);
  }
  const rolePerms = ROLE_PERMISSIONS[role];
  if (!rolePerms) {
    return false;
  }
  return rolePerms.includes(permission);
}

export function getPermissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export interface PolicyPreset {
  readonly name: string;
  readonly description: string;
  readonly availableRoles: readonly Role[];
  readonly defaultRole: Role;
}

export const POLICY_PRESETS = {
  solo: {
    name: "Solo Creator",
    description: "Single user workspace with full control",
    availableRoles: [ROLES.OWNER],
    defaultRole: ROLES.OWNER,
  },
  startup: {
    name: "Startup Team",
    description: "Small team with editors and reviewers",
    availableRoles: [ROLES.OWNER, ROLES.EDITOR, ROLES.REVIEWER, ROLES.VIEWER],
    defaultRole: ROLES.EDITOR,
  },
  agency: {
    name: "Agency",
    description:
      "Full role hierarchy for client and team management",
    availableRoles: [
      ROLES.OWNER,
      ROLES.EDITOR,
      ROLES.PUBLISHER,
      ROLES.REVIEWER,
      ROLES.ANALYST,
      ROLES.VIEWER,
    ],
    defaultRole: ROLES.VIEWER,
  },
} as const satisfies Record<string, PolicyPreset>;

export type PolicyPresetKey = keyof typeof POLICY_PRESETS;
