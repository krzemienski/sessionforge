/**
 * Unit tests for the GET / POST / DELETE /api/integrations/devto route handler.
 *
 * All external dependencies (auth, db, Next.js server utilities, Dev.to API
 * client) are replaced with controllable in-memory fakes so that tests run
 * without a real database connection, Next.js runtime, or network access.
 */

import { describe, it, expect, beforeEach, beforeAll, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Mutable mock state shared between mock factories and test cases
// ---------------------------------------------------------------------------

/** Controls what auth.api.getSession() resolves with. */
let mockAuthSession: { user: { id: string } } | null = { user: { id: "user-1" } };

/** Controls the workspace returned by db.query.workspaces.findFirst(). */
let mockWorkspace: { id: string; ownerId: string } | undefined = {
  id: "ws-1",
  ownerId: "user-1",
};

/** Controls the devto integration returned by db.query.devtoIntegrations.findFirst(). */
let mockIntegration:
  | { id: string; username: string; enabled: boolean; createdAt: Date }
  | undefined = undefined;

/** Tracks the last values passed to db.insert().values(). */
let lastInsertValues: Record<string, unknown> | null = null;

/** Tracks whether db.delete() was called. */
let deleteWasCalled = false;

/** Controls whether verifyDevtoApiKey resolves or rejects. */
let mockVerifyResult: { username: string; name: string } | Error = {
  username: "devuser",
  name: "Dev User",
};

// ---------------------------------------------------------------------------
// Module mocks (must be declared before importing the module under test)
// ---------------------------------------------------------------------------

mock.module("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: (_opts: unknown) => Promise.resolve(mockAuthSession),
    },
  },
}));

mock.module("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));

// Comprehensive shared @sessionforge/db mock — ensures cross-file compatibility
import { SHARED_SCHEMA_MOCK } from "@/__test-utils__/shared-schema-mock";

mock.module("@sessionforge/db", () => ({
  ...SHARED_SCHEMA_MOCK,
  devtoIntegrations: { workspaceId: "dti_workspaceId" },
}));

mock.module("drizzle-orm/sql", () => ({
  eq: (...args: unknown[]) => ({ op: "eq", args }),
}));

// Fake db that mirrors the route's usage of drizzle query API
const mockDb = {
  query: {
    workspaces: {
      findFirst: (_opts: unknown) => Promise.resolve(mockWorkspace),
    },
    devtoIntegrations: {
      findFirst: (_opts: unknown) => Promise.resolve(mockIntegration),
    },
  },
  insert(_table: unknown) {
    return {
      values(vals: Record<string, unknown>) {
        lastInsertValues = vals;
        return {
          onConflictDoUpdate(_opts: unknown) {
            return Promise.resolve();
          },
        };
      },
    };
  },
  delete(_table: unknown) {
    return {
      where(_condition: unknown) {
        deleteWasCalled = true;
        return Promise.resolve();
      },
    };
  },
};

mock.module("@/lib/db", () => ({ db: mockDb }));

mock.module("next/server", () => {
  const NextResponse = {
    json(data: unknown, init?: { status?: number }) {
      return {
        _status: init?.status ?? 200,
        _body: data,
        async json() {
          return data;
        },
      };
    },
  };
  return { NextResponse };
});

mock.module("@/lib/integrations/devto", () => ({
  verifyDevtoApiKey: async (_apiKey: string) => {
    if (mockVerifyResult instanceof Error) throw mockVerifyResult;
    return mockVerifyResult;
  },
  DevtoApiError: class DevtoApiError extends Error {
    status: number;
    code: string;
    constructor(message: string, status: number, code: string) {
      super(message);
      this.name = "DevtoApiError";
      this.status = status;
      this.code = code;
    }
  },
}));

// Dynamic imports AFTER all mocks are registered.
let GET: (req: Request) => Promise<Response>;
let POST: (req: Request) => Promise<Response>;
let DELETE: (req: Request) => Promise<Response>;

beforeAll(async () => {
  const mod = await import("../integrations/devto/route");
  GET = mod.GET;
  POST = mod.POST;
  DELETE = mod.DELETE;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type MockResponse = { _status: number; _body: Record<string, unknown> };

function makeGetRequest(params: Record<string, string> = {}): Request {
  const url = new URL("http://localhost/api/integrations/devto");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url.toString());
}

function makePostRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/integrations/devto", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeDeleteRequest(params: Record<string, string> = {}): Request {
  const url = new URL("http://localhost/api/integrations/devto");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url.toString(), { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("GET /api/integrations/devto", () => {
  beforeEach(() => {
    mockAuthSession = { user: { id: "user-1" } };
    mockWorkspace = { id: "ws-1", ownerId: "user-1" };
    mockIntegration = undefined;
  });

  describe("authentication", () => {
    it("returns 401 when no session exists", async () => {
      mockAuthSession = null;
      const res = (await GET(makeGetRequest({ workspace: "my-workspace" }))) as unknown as MockResponse;
      expect(res._status).toBe(401);
    });

    it("returns Unauthorized error body when not authenticated", async () => {
      mockAuthSession = null;
      const res = (await GET(makeGetRequest({ workspace: "my-workspace" }))) as unknown as MockResponse;
      expect(res._body.error).toBe("Unauthorized");
    });
  });

  describe("query parameter validation", () => {
    it("returns 400 when workspace param is missing", async () => {
      const res = (await GET(makeGetRequest())) as unknown as MockResponse;
      expect(res._status).toBe(400);
    });

    it("returns error body when workspace param is missing", async () => {
      const res = (await GET(makeGetRequest())) as unknown as MockResponse;
      expect(res._body.error).toBe("workspace query param required");
    });
  });

  describe("workspace lookup", () => {
    it("returns 404 when workspace is not found", async () => {
      mockWorkspace = undefined;
      const res = (await GET(makeGetRequest({ workspace: "missing" }))) as unknown as MockResponse;
      expect(res._status).toBe(404);
    });

    it("returns 404 when workspace belongs to a different user", async () => {
      mockWorkspace = { id: "ws-1", ownerId: "other-user" };
      const res = (await GET(makeGetRequest({ workspace: "my-workspace" }))) as unknown as MockResponse;
      expect(res._status).toBe(404);
    });

    it("returns Workspace not found error body when workspace is missing", async () => {
      mockWorkspace = undefined;
      const res = (await GET(makeGetRequest({ workspace: "missing" }))) as unknown as MockResponse;
      expect(res._body.error).toBe("Workspace not found");
    });
  });

  describe("integration status", () => {
    it("returns connected: false when no integration exists", async () => {
      mockIntegration = undefined;
      const res = (await GET(makeGetRequest({ workspace: "my-workspace" }))) as unknown as MockResponse;
      expect(res._body.connected).toBe(false);
    });

    it("returns 200 when no integration exists", async () => {
      mockIntegration = undefined;
      const res = (await GET(makeGetRequest({ workspace: "my-workspace" }))) as unknown as MockResponse;
      expect(res._status).toBe(200);
    });

    it("returns connected: true when an integration exists", async () => {
      mockIntegration = {
        id: "int-1",
        username: "devuser",
        enabled: true,
        createdAt: new Date("2024-01-01"),
      };
      const res = (await GET(makeGetRequest({ workspace: "my-workspace" }))) as unknown as MockResponse;
      expect(res._body.connected).toBe(true);
    });

    it("returns username from the integration", async () => {
      mockIntegration = {
        id: "int-1",
        username: "devuser",
        enabled: true,
        createdAt: new Date("2024-01-01"),
      };
      const res = (await GET(makeGetRequest({ workspace: "my-workspace" }))) as unknown as MockResponse;
      expect(res._body.username).toBe("devuser");
    });

    it("returns enabled status from the integration", async () => {
      mockIntegration = {
        id: "int-1",
        username: "devuser",
        enabled: false,
        createdAt: new Date("2024-01-01"),
      };
      const res = (await GET(makeGetRequest({ workspace: "my-workspace" }))) as unknown as MockResponse;
      expect(res._body.enabled).toBe(false);
    });

    it("returns connectedAt from the integration createdAt", async () => {
      const createdAt = new Date("2024-06-15");
      mockIntegration = {
        id: "int-1",
        username: "devuser",
        enabled: true,
        createdAt,
      };
      const res = (await GET(makeGetRequest({ workspace: "my-workspace" }))) as unknown as MockResponse;
      expect(res._body.connectedAt).toEqual(createdAt);
    });
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/integrations/devto", () => {
  beforeEach(() => {
    mockAuthSession = { user: { id: "user-1" } };
    mockWorkspace = { id: "ws-1", ownerId: "user-1" };
    mockVerifyResult = { username: "devuser", name: "Dev User" };
    lastInsertValues = null;
  });

  describe("authentication", () => {
    it("returns 401 when no session exists", async () => {
      mockAuthSession = null;
      const res = (await POST(makePostRequest({ workspaceSlug: "my-workspace", apiKey: "key-123" }))) as unknown as MockResponse;
      expect(res._status).toBe(401);
    });

    it("returns Unauthorized error body when not authenticated", async () => {
      mockAuthSession = null;
      const res = (await POST(makePostRequest({ workspaceSlug: "my-workspace", apiKey: "key-123" }))) as unknown as MockResponse;
      expect(res._body.error).toBe("Unauthorized");
    });
  });

  describe("body validation", () => {
    it("returns 400 when workspaceSlug is missing", async () => {
      const res = (await POST(makePostRequest({ apiKey: "key-123" }))) as unknown as MockResponse;
      expect(res._status).toBe(400);
    });

    it("returns 400 when apiKey is missing", async () => {
      const res = (await POST(makePostRequest({ workspaceSlug: "my-workspace" }))) as unknown as MockResponse;
      expect(res._status).toBe(400);
    });

    it("returns error body when required fields are missing", async () => {
      const res = (await POST(makePostRequest({}))) as unknown as MockResponse;
      expect(typeof res._body.error).toBe("string");
    });
  });

  describe("workspace lookup", () => {
    it("returns 404 when workspace is not found", async () => {
      mockWorkspace = undefined;
      const res = (await POST(makePostRequest({ workspaceSlug: "missing", apiKey: "key-123" }))) as unknown as MockResponse;
      expect(res._status).toBe(404);
    });

    it("returns 404 when workspace belongs to a different user", async () => {
      mockWorkspace = { id: "ws-1", ownerId: "other-user" };
      const res = (await POST(makePostRequest({ workspaceSlug: "my-workspace", apiKey: "key-123" }))) as unknown as MockResponse;
      expect(res._status).toBe(404);
    });
  });

  describe("successful connection", () => {
    it("returns 201 on successful connection", async () => {
      const res = (await POST(makePostRequest({ workspaceSlug: "my-workspace", apiKey: "key-123" }))) as unknown as MockResponse;
      expect(res._status).toBe(201);
    });

    it("returns connected: true on success", async () => {
      const res = (await POST(makePostRequest({ workspaceSlug: "my-workspace", apiKey: "key-123" }))) as unknown as MockResponse;
      expect(res._body.connected).toBe(true);
    });

    it("returns the verified username on success", async () => {
      mockVerifyResult = { username: "mydevuser", name: "My Dev User" };
      const res = (await POST(makePostRequest({ workspaceSlug: "my-workspace", apiKey: "key-123" }))) as unknown as MockResponse;
      expect(res._body.username).toBe("mydevuser");
    });

    it("stores the api key in the database", async () => {
      await POST(makePostRequest({ workspaceSlug: "my-workspace", apiKey: "my-api-key" }));
      expect(lastInsertValues?.apiKey).toBe("my-api-key");
    });

    it("stores the username in the database", async () => {
      mockVerifyResult = { username: "storeduser", name: "Stored User" };
      await POST(makePostRequest({ workspaceSlug: "my-workspace", apiKey: "key-123" }));
      expect(lastInsertValues?.username).toBe("storeduser");
    });

    it("sets enabled to true in the database", async () => {
      await POST(makePostRequest({ workspaceSlug: "my-workspace", apiKey: "key-123" }));
      expect(lastInsertValues?.enabled).toBe(true);
    });
  });

  describe("DevtoApiError handling", () => {
    it("returns 400 when the API key is invalid (401 from Dev.to)", async () => {
      const { DevtoApiError } = await import("@/lib/integrations/devto");
      mockVerifyResult = new DevtoApiError("Invalid Dev.to API key.", 401, "invalid_api_key");
      const res = (await POST(makePostRequest({ workspaceSlug: "my-workspace", apiKey: "bad-key" }))) as unknown as MockResponse;
      expect(res._status).toBe(400);
    });

    it("returns the error message when the API key is invalid", async () => {
      const { DevtoApiError } = await import("@/lib/integrations/devto");
      mockVerifyResult = new DevtoApiError("Invalid Dev.to API key.", 401, "invalid_api_key");
      const res = (await POST(makePostRequest({ workspaceSlug: "my-workspace", apiKey: "bad-key" }))) as unknown as MockResponse;
      expect(typeof res._body.error).toBe("string");
    });

    it("returns the error code when DevtoApiError is thrown", async () => {
      const { DevtoApiError } = await import("@/lib/integrations/devto");
      mockVerifyResult = new DevtoApiError("Rate limited.", 429, "rate_limited");
      const res = (await POST(makePostRequest({ workspaceSlug: "my-workspace", apiKey: "key" }))) as unknown as MockResponse;
      expect((res._body.details as Record<string, unknown>)?.devtoCode).toBe("rate_limited");
    });

    it("returns 429 status for rate_limited DevtoApiError", async () => {
      const { DevtoApiError } = await import("@/lib/integrations/devto");
      mockVerifyResult = new DevtoApiError("Rate limited.", 429, "rate_limited");
      const res = (await POST(makePostRequest({ workspaceSlug: "my-workspace", apiKey: "key" }))) as unknown as MockResponse;
      expect(res._status).toBe(429);
    });
  });

  describe("generic error handling", () => {
    it("returns 500 when an unexpected error is thrown", async () => {
      mockVerifyResult = new Error("Network failure");
      const res = (await POST(makePostRequest({ workspaceSlug: "my-workspace", apiKey: "key-123" }))) as unknown as MockResponse;
      expect(res._status).toBe(500);
    });

    it("returns error message for unexpected errors", async () => {
      mockVerifyResult = new Error("Network failure");
      const res = (await POST(makePostRequest({ workspaceSlug: "my-workspace", apiKey: "key-123" }))) as unknown as MockResponse;
      expect(typeof res._body.error).toBe("string");
    });

    it("returns 500 status for unexpected errors", async () => {
      mockVerifyResult = new Error("Unexpected failure");
      const res = (await POST(makePostRequest({ workspaceSlug: "my-workspace", apiKey: "key-123" }))) as unknown as MockResponse;
      expect(res._status).toBe(500);
    });
  });
});

// ---------------------------------------------------------------------------

describe("DELETE /api/integrations/devto", () => {
  beforeEach(() => {
    mockAuthSession = { user: { id: "user-1" } };
    mockWorkspace = { id: "ws-1", ownerId: "user-1" };
    mockIntegration = {
      id: "int-1",
      username: "devuser",
      enabled: true,
      createdAt: new Date("2024-01-01"),
    };
    deleteWasCalled = false;
  });

  describe("authentication", () => {
    it("returns 401 when no session exists", async () => {
      mockAuthSession = null;
      const res = (await DELETE(makeDeleteRequest({ workspace: "my-workspace" }))) as unknown as MockResponse;
      expect(res._status).toBe(401);
    });

    it("returns Unauthorized error body when not authenticated", async () => {
      mockAuthSession = null;
      const res = (await DELETE(makeDeleteRequest({ workspace: "my-workspace" }))) as unknown as MockResponse;
      expect(res._body.error).toBe("Unauthorized");
    });
  });

  describe("query parameter validation", () => {
    it("returns 400 when workspace param is missing", async () => {
      const res = (await DELETE(makeDeleteRequest())) as unknown as MockResponse;
      expect(res._status).toBe(400);
    });

    it("returns error body when workspace param is missing", async () => {
      const res = (await DELETE(makeDeleteRequest())) as unknown as MockResponse;
      expect(res._body.error).toBe("workspace query param required");
    });
  });

  describe("workspace lookup", () => {
    it("returns 404 when workspace is not found", async () => {
      mockWorkspace = undefined;
      const res = (await DELETE(makeDeleteRequest({ workspace: "missing" }))) as unknown as MockResponse;
      expect(res._status).toBe(404);
    });

    it("returns 404 when workspace belongs to a different user", async () => {
      mockWorkspace = { id: "ws-1", ownerId: "other-user" };
      const res = (await DELETE(makeDeleteRequest({ workspace: "my-workspace" }))) as unknown as MockResponse;
      expect(res._status).toBe(404);
    });
  });

  describe("integration existence check", () => {
    it("returns 404 when no integration exists for the workspace", async () => {
      mockIntegration = undefined;
      const res = (await DELETE(makeDeleteRequest({ workspace: "my-workspace" }))) as unknown as MockResponse;
      expect(res._status).toBe(404);
    });

    it("returns Integration not found error body when integration is missing", async () => {
      mockIntegration = undefined;
      const res = (await DELETE(makeDeleteRequest({ workspace: "my-workspace" }))) as unknown as MockResponse;
      expect(res._body.error).toBe("Integration not found");
    });
  });

  describe("successful disconnection", () => {
    it("returns 200 on successful disconnection", async () => {
      const res = (await DELETE(makeDeleteRequest({ workspace: "my-workspace" }))) as unknown as MockResponse;
      expect(res._status).toBe(200);
    });

    it("returns disconnected: true on success", async () => {
      const res = (await DELETE(makeDeleteRequest({ workspace: "my-workspace" }))) as unknown as MockResponse;
      expect(res._body.disconnected).toBe(true);
    });

    it("calls db.delete() to remove the integration", async () => {
      await DELETE(makeDeleteRequest({ workspace: "my-workspace" }));
      expect(deleteWasCalled).toBe(true);
    });
  });
});
