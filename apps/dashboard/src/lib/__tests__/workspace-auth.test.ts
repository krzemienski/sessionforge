/**
 * Unit tests for workspace-auth.ts
 *
 * Tests getAuthorizedWorkspace and getAuthorizedWorkspaceById with mocked DB
 * calls covering: owner access, member access, insufficient permissions,
 * and non-member access.
 */

import { describe, it, expect, beforeEach, beforeAll, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Mutable mock state
// ---------------------------------------------------------------------------

let mockWorkspaceRows: Record<string, unknown>[] = [];
let mockMemberRows: Record<string, unknown>[] = [];
let mockActivityInserted: Record<string, unknown>[] = [];

// ---------------------------------------------------------------------------
// Module mocks — must precede import of the module under test
// ---------------------------------------------------------------------------

const mockSelectFrom = {
  where: mock(() => ({
    limit: mock(() => mockWorkspaceRows),
  })),
};

const mockMemberSelectFrom = {
  where: mock(() => ({
    limit: mock(() => mockMemberRows),
  })),
};

const mockInsertValues = mock(async (vals: Record<string, unknown>) => {
  mockActivityInserted.push(vals);
});

mock.module("@/lib/db", () => ({
  db: {
    select: mock(() => ({
      from: mock((table: unknown) => {
        // Return workspace rows for workspaces table, member rows for members table
        const tableName = (table as { _?: { name?: string } })?._?.name;
        if (tableName === "workspace_members") return mockMemberSelectFrom;
        return mockSelectFrom;
      }),
    })),
    insert: mock(() => ({
      values: mockInsertValues,
    })),
  },
}));

mock.module("@sessionforge/db", () => ({
  workspaces: { _: { name: "workspaces" } },
  workspaceMembers: { _: { name: "workspace_members" } },
  workspaceActivity: { _: { name: "workspace_activity" } },
}));

mock.module("drizzle-orm/sql", () => ({
  eq: mock((...args: unknown[]) => args),
  and: mock((...args: unknown[]) => args),
}));

// ---------------------------------------------------------------------------
// Import module under test after mocks are set up
// ---------------------------------------------------------------------------

let getAuthorizedWorkspace: typeof import("../workspace-auth").getAuthorizedWorkspace;
let getAuthorizedWorkspaceById: typeof import("../workspace-auth").getAuthorizedWorkspaceById;
let logWorkspaceActivity: typeof import("../workspace-auth").logWorkspaceActivity;

beforeAll(async () => {
  const mod = await import("../workspace-auth");
  getAuthorizedWorkspace = mod.getAuthorizedWorkspace;
  getAuthorizedWorkspaceById = mod.getAuthorizedWorkspaceById;
  logWorkspaceActivity = mod.logWorkspaceActivity;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ownerSession = { user: { id: "user-owner" } } as any;
const memberSession = { user: { id: "user-member" } } as any;
const strangerSession = { user: { id: "user-stranger" } } as any;

const workspace = {
  id: "ws-1",
  slug: "test-ws",
  ownerId: "user-owner",
};

const memberRow = {
  id: "member-1",
  workspaceId: "ws-1",
  userId: "user-member",
  role: "editor",
  customPermissions: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockWorkspaceRows = [workspace];
  mockMemberRows = [];
  mockActivityInserted = [];
});

describe("getAuthorizedWorkspace", () => {
  it("grants owner full access without checking members table", async () => {
    const result = await getAuthorizedWorkspace(ownerSession, "test-ws", "content:read" as any);
    expect(result.role).toBe("owner");
    expect(result.workspace).toEqual(workspace);
    expect(result.member).toBeUndefined();
  });

  it("grants member access with sufficient permissions", async () => {
    mockMemberRows = [memberRow];
    const result = await getAuthorizedWorkspace(memberSession, "test-ws", "content:read" as any);
    expect(result.role).toBe("editor");
    expect(result.member).toEqual(memberRow);
  });

  it("throws FORBIDDEN for member with insufficient permissions", async () => {
    mockMemberRows = [memberRow]; // editor role
    await expect(
      getAuthorizedWorkspace(memberSession, "test-ws", "workspace:delete" as any)
    ).rejects.toThrow("You do not have permission");
  });

  it("throws NOT_FOUND for non-member user", async () => {
    mockMemberRows = [];
    await expect(
      getAuthorizedWorkspace(strangerSession, "test-ws")
    ).rejects.toThrow("Workspace not found");
  });

  it("throws NOT_FOUND when workspace does not exist", async () => {
    mockWorkspaceRows = [];
    await expect(
      getAuthorizedWorkspace(ownerSession, "nonexistent")
    ).rejects.toThrow("Workspace not found");
  });

  it("works without required permission (access check only)", async () => {
    const result = await getAuthorizedWorkspace(ownerSession, "test-ws");
    expect(result.role).toBe("owner");
  });

  it("respects custom permissions override", async () => {
    // Member with custom permissions that only include content:read
    mockMemberRows = [{
      ...memberRow,
      customPermissions: { "content:read": true },
    }];
    const result = await getAuthorizedWorkspace(memberSession, "test-ws", "content:read" as any);
    expect(result.role).toBe("editor");

    // But custom perms don't include workspace:settings
    mockMemberRows = [{
      ...memberRow,
      customPermissions: { "content:read": true },
    }];
    await expect(
      getAuthorizedWorkspace(memberSession, "test-ws", "workspace:settings" as any)
    ).rejects.toThrow("You do not have permission");
  });
});

describe("getAuthorizedWorkspaceById", () => {
  it("grants owner access by workspace ID", async () => {
    const result = await getAuthorizedWorkspaceById(ownerSession, "ws-1", "content:read" as any);
    expect(result.role).toBe("owner");
  });

  it("grants member access by workspace ID", async () => {
    mockMemberRows = [memberRow];
    const result = await getAuthorizedWorkspaceById(memberSession, "ws-1", "content:read" as any);
    expect(result.role).toBe("editor");
  });

  it("throws for non-member by workspace ID", async () => {
    mockMemberRows = [];
    await expect(
      getAuthorizedWorkspaceById(strangerSession, "ws-1")
    ).rejects.toThrow("Workspace not found");
  });
});

describe("logWorkspaceActivity", () => {
  it("inserts activity record into database", async () => {
    await logWorkspaceActivity("ws-1", "user-1", "member_added", "member", "m-1", { role: "editor" });
    expect(mockActivityInserted.length).toBe(1);
    expect(mockActivityInserted[0]).toMatchObject({
      workspaceId: "ws-1",
      userId: "user-1",
      action: "member_added",
      resourceType: "member",
      resourceId: "m-1",
    });
  });

  it("handles optional parameters", async () => {
    await logWorkspaceActivity("ws-1", "user-1", "session_upload");
    expect(mockActivityInserted.length).toBe(1);
    expect(mockActivityInserted[0]).toMatchObject({
      workspaceId: "ws-1",
      userId: "user-1",
      action: "session_upload",
      resourceType: null,
      resourceId: null,
      metadata: null,
    });
  });
});
