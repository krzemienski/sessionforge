import { describe, it, expect } from "bun:test";
import {
  PERMISSIONS,
  ROLES,
  hasPermission,
  getPermissionsForRole,
  POLICY_PRESETS,
} from "../permissions";
import type { Permission, Role } from "../permissions";

// ---------------------------------------------------------------------------
// hasPermission — role defaults
// ---------------------------------------------------------------------------

describe("hasPermission", () => {
  it("owner has all permissions", () => {
    for (const perm of Object.values(PERMISSIONS)) {
      expect(hasPermission(ROLES.OWNER, perm)).toBe(true);
    }
  });

  it("viewer has read-only permissions", () => {
    expect(hasPermission(ROLES.VIEWER, PERMISSIONS.CONTENT_READ)).toBe(true);
    expect(hasPermission(ROLES.VIEWER, PERMISSIONS.SESSIONS_READ)).toBe(true);
    expect(hasPermission(ROLES.VIEWER, PERMISSIONS.INSIGHTS_READ)).toBe(true);
    expect(hasPermission(ROLES.VIEWER, PERMISSIONS.ANALYTICS_READ)).toBe(true);
    expect(hasPermission(ROLES.VIEWER, PERMISSIONS.INTEGRATIONS_READ)).toBe(true);
  });

  it("viewer cannot create, edit, or delete content", () => {
    expect(hasPermission(ROLES.VIEWER, PERMISSIONS.CONTENT_CREATE)).toBe(false);
    expect(hasPermission(ROLES.VIEWER, PERMISSIONS.CONTENT_EDIT)).toBe(false);
    expect(hasPermission(ROLES.VIEWER, PERMISSIONS.CONTENT_DELETE)).toBe(false);
  });

  it("viewer cannot manage workspace", () => {
    expect(hasPermission(ROLES.VIEWER, PERMISSIONS.WORKSPACE_SETTINGS)).toBe(false);
    expect(hasPermission(ROLES.VIEWER, PERMISSIONS.WORKSPACE_MEMBERS)).toBe(false);
    expect(hasPermission(ROLES.VIEWER, PERMISSIONS.WORKSPACE_DELETE)).toBe(false);
    expect(hasPermission(ROLES.VIEWER, PERMISSIONS.WORKSPACE_BILLING)).toBe(false);
  });

  it("editor can create, edit, and delete content", () => {
    expect(hasPermission(ROLES.EDITOR, PERMISSIONS.CONTENT_READ)).toBe(true);
    expect(hasPermission(ROLES.EDITOR, PERMISSIONS.CONTENT_CREATE)).toBe(true);
    expect(hasPermission(ROLES.EDITOR, PERMISSIONS.CONTENT_EDIT)).toBe(true);
    expect(hasPermission(ROLES.EDITOR, PERMISSIONS.CONTENT_DELETE)).toBe(true);
  });

  it("editor can publish and schedule", () => {
    expect(hasPermission(ROLES.EDITOR, PERMISSIONS.PUBLISHING_PUBLISH)).toBe(true);
    expect(hasPermission(ROLES.EDITOR, PERMISSIONS.PUBLISHING_SCHEDULE)).toBe(true);
  });

  it("editor cannot manage workspace settings or members", () => {
    expect(hasPermission(ROLES.EDITOR, PERMISSIONS.WORKSPACE_SETTINGS)).toBe(false);
    expect(hasPermission(ROLES.EDITOR, PERMISSIONS.WORKSPACE_MEMBERS)).toBe(false);
    expect(hasPermission(ROLES.EDITOR, PERMISSIONS.WORKSPACE_DELETE)).toBe(false);
  });

  it("publisher can approve and publish content", () => {
    expect(hasPermission(ROLES.PUBLISHER, PERMISSIONS.CONTENT_APPROVE)).toBe(true);
    expect(hasPermission(ROLES.PUBLISHER, PERMISSIONS.PUBLISHING_PUBLISH)).toBe(true);
    expect(hasPermission(ROLES.PUBLISHER, PERMISSIONS.PUBLISHING_SCHEDULE)).toBe(true);
  });

  it("publisher cannot create or edit content", () => {
    expect(hasPermission(ROLES.PUBLISHER, PERMISSIONS.CONTENT_CREATE)).toBe(false);
    expect(hasPermission(ROLES.PUBLISHER, PERMISSIONS.CONTENT_EDIT)).toBe(false);
    expect(hasPermission(ROLES.PUBLISHER, PERMISSIONS.CONTENT_DELETE)).toBe(false);
  });

  it("reviewer can approve content and read analytics", () => {
    expect(hasPermission(ROLES.REVIEWER, PERMISSIONS.CONTENT_APPROVE)).toBe(true);
    expect(hasPermission(ROLES.REVIEWER, PERMISSIONS.CONTENT_READ)).toBe(true);
    expect(hasPermission(ROLES.REVIEWER, PERMISSIONS.ANALYTICS_READ)).toBe(true);
  });

  it("reviewer cannot create, edit, or publish content", () => {
    expect(hasPermission(ROLES.REVIEWER, PERMISSIONS.CONTENT_CREATE)).toBe(false);
    expect(hasPermission(ROLES.REVIEWER, PERMISSIONS.CONTENT_EDIT)).toBe(false);
    expect(hasPermission(ROLES.REVIEWER, PERMISSIONS.PUBLISHING_PUBLISH)).toBe(false);
  });

  it("analyst can read and manage analytics", () => {
    expect(hasPermission(ROLES.ANALYST, PERMISSIONS.ANALYTICS_READ)).toBe(true);
    expect(hasPermission(ROLES.ANALYST, PERMISSIONS.ANALYTICS_MANAGE)).toBe(true);
    expect(hasPermission(ROLES.ANALYST, PERMISSIONS.CONTENT_READ)).toBe(true);
    expect(hasPermission(ROLES.ANALYST, PERMISSIONS.SESSIONS_READ)).toBe(true);
  });

  it("analyst cannot create or publish content", () => {
    expect(hasPermission(ROLES.ANALYST, PERMISSIONS.CONTENT_CREATE)).toBe(false);
    expect(hasPermission(ROLES.ANALYST, PERMISSIONS.PUBLISHING_PUBLISH)).toBe(false);
  });

  it("returns false for unknown role", () => {
    expect(hasPermission("nonexistent" as Role, PERMISSIONS.CONTENT_READ)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasPermission — custom permissions override
// ---------------------------------------------------------------------------

describe("hasPermission with custom permissions", () => {
  it("custom permissions override role defaults — grant", () => {
    // Viewer normally can't create content, but custom perms grant it
    const custom: Permission[] = [PERMISSIONS.CONTENT_CREATE, PERMISSIONS.CONTENT_READ];
    expect(hasPermission(ROLES.VIEWER, PERMISSIONS.CONTENT_CREATE, custom)).toBe(true);
  });

  it("custom permissions override role defaults — revoke", () => {
    // Editor normally has CONTENT_EDIT, but custom perms don't include it
    const custom: Permission[] = [PERMISSIONS.CONTENT_READ];
    expect(hasPermission(ROLES.EDITOR, PERMISSIONS.CONTENT_EDIT, custom)).toBe(false);
  });

  it("empty custom permissions array denies everything", () => {
    expect(hasPermission(ROLES.OWNER, PERMISSIONS.CONTENT_READ, [])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getPermissionsForRole
// ---------------------------------------------------------------------------

describe("getPermissionsForRole", () => {
  it("owner gets all permissions", () => {
    const ownerPerms = getPermissionsForRole(ROLES.OWNER);
    expect(ownerPerms.length).toBe(Object.values(PERMISSIONS).length);
  });

  it("viewer gets fewer permissions than editor", () => {
    const viewerPerms = getPermissionsForRole(ROLES.VIEWER);
    const editorPerms = getPermissionsForRole(ROLES.EDITOR);
    expect(editorPerms.length).toBeGreaterThan(viewerPerms.length);
  });

  it("returns empty for unknown role", () => {
    expect(getPermissionsForRole("nonexistent" as Role)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Policy presets
// ---------------------------------------------------------------------------

describe("POLICY_PRESETS", () => {
  it("solo preset has only owner role", () => {
    expect(POLICY_PRESETS.solo.availableRoles).toEqual([ROLES.OWNER]);
    expect(POLICY_PRESETS.solo.defaultRole).toBe(ROLES.OWNER);
  });

  it("startup preset includes owner, editor, reviewer, viewer", () => {
    const roles = POLICY_PRESETS.startup.availableRoles;
    expect(roles).toContain(ROLES.OWNER);
    expect(roles).toContain(ROLES.EDITOR);
    expect(roles).toContain(ROLES.REVIEWER);
    expect(roles).toContain(ROLES.VIEWER);
    expect(POLICY_PRESETS.startup.defaultRole).toBe(ROLES.EDITOR);
  });

  it("agency preset includes all 6 roles", () => {
    const roles = POLICY_PRESETS.agency.availableRoles;
    expect(roles.length).toBe(6);
    expect(roles).toContain(ROLES.OWNER);
    expect(roles).toContain(ROLES.EDITOR);
    expect(roles).toContain(ROLES.PUBLISHER);
    expect(roles).toContain(ROLES.REVIEWER);
    expect(roles).toContain(ROLES.ANALYST);
    expect(roles).toContain(ROLES.VIEWER);
    expect(POLICY_PRESETS.agency.defaultRole).toBe(ROLES.VIEWER);
  });
});
