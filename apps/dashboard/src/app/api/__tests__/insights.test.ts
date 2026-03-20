/**
 * Unit tests for the /api/insights route handlers.
 *
 * Covers:
 *   GET  /api/insights           – list insights with filtering & pagination
 *   POST /api/insights/extract   – stream AI insight extraction for session(s)
 *   GET  /api/insights/[id]      – fetch a single insight by ID
 *
 * All external dependencies (auth, db, Next.js server utilities, AI agents)
 * are replaced with controllable in-memory fakes so that tests run without a
 * real database connection or Next.js runtime.
 */

import { describe, it, expect, beforeEach, beforeAll, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Mutable mock state shared between mock factories and test cases
// ---------------------------------------------------------------------------

/** Controls what auth.api.getSession() resolves with. */
let mockAuthSession: { user: { id: string } } | null = { user: { id: "user-1" } };

/** Controls the workspace lookup result for db.query.workspaces.findFirst(). */
let mockWorkspaceResult: { id: string; slug: string; ownerId: string } | undefined = {
  id: "ws-1",
  slug: "my-workspace",
  ownerId: "user-1",
};

/** Controls the rows returned by db.query.insights.findMany(). */
let mockInsightRows: Record<string, unknown>[] = [];

/** Controls the single insight returned by db.query.insights.findFirst(). */
let mockInsightResult: Record<string, unknown> | undefined = undefined;

/** Controls the rows returned by db.select().from(claudeSessions).where().limit(). */
let mockDbSessionRows: { id: string; sessionId: string }[] = [
  { id: "cs-db-1", sessionId: "sess-abc" },
];

/** Controls checkQuota() result. */
let mockQuotaResult: { allowed: boolean; limit: number; remaining: number; percentUsed: number } = {
  allowed: true,
  limit: 100,
  remaining: 95,
  percentUsed: 5,
};

// ---------------------------------------------------------------------------
// Module mocks (must be declared before importing the modules under test)
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

// Lightweight stand-ins for drizzle table schema objects.
mock.module("@sessionforge/db", () => ({
  insights: {
    id: "i_id",
    workspaceId: "i_workspaceId",
    sessionId: "i_sessionId",
    compositeScore: "i_compositeScore",
    category: "i_category",
    createdAt: "i_createdAt",
  },
  workspaces: {
    id: "ws_id",
    slug: "ws_slug",
    ownerId: "ws_ownerId",
  },
  claudeSessions: {
    id: "cs_id",
    sessionId: "cs_sessionId",
    workspaceId: "cs_workspaceId",
  },
  webhookEndpoints: {
    workspaceId: "we_workspaceId",
    events: "we_events",
    isActive: "we_isActive",
    url: "we_url",
    secret: "we_secret",
  },
  insightCategoryEnum: {
    enumValues: ["performance", "learning", "decision", "blocker", "achievement", "pattern"],
  },
  workspaceMembers: {
    workspaceId: "wm_workspaceId",
    userId: "wm_userId",
    role: "wm_role",
  },
  workspaceActivity: {
    workspaceId: "wa_workspaceId",
    userId: "wa_userId",
    action: "wa_action",
  },
}));

// Mock workspace-auth to use existing mockWorkspaceResult + mockAuthSession
mock.module("@/lib/workspace-auth", () => {
  class AppError extends Error {
    code: string;
    statusCode: number;
    constructor(msg: string, code: string, status?: number) {
      super(msg);
      this.code = code;
      this.statusCode = status ?? 500;
    }
  }
  const getAuthorizedWorkspace = async (session: any, slug: string, _perm?: string) => {
    if (!mockWorkspaceResult) throw new AppError("Workspace not found", "NOT_FOUND", 404);
    if (mockWorkspaceResult.ownerId !== session.user.id) {
      throw new AppError("Workspace not found", "NOT_FOUND", 404);
    }
    return { workspace: mockWorkspaceResult, role: "owner" };
  };
  const getAuthorizedWorkspaceById = async (session: any, id: string, _perm?: string) => {
    if (!mockWorkspaceResult) throw new AppError("Workspace not found", "NOT_FOUND", 404);
    if (mockWorkspaceResult.ownerId !== session.user.id) {
      throw new AppError("Workspace not found", "NOT_FOUND", 404);
    }
    return { workspace: mockWorkspaceResult, role: "owner" };
  };
  const logWorkspaceActivity = async () => {};
  return { getAuthorizedWorkspace, getAuthorizedWorkspaceById, logWorkspaceActivity };
});

mock.module("@/lib/permissions", () => ({
  PERMISSIONS: {
    CONTENT_READ: "content:read",
    CONTENT_CREATE: "content:create",
    CONTENT_EDIT: "content:edit",
    CONTENT_DELETE: "content:delete",
    INSIGHTS_READ: "insights:read",
    INSIGHTS_EXTRACT: "insights:extract",
    WORKSPACE_SETTINGS: "workspace:settings",
  },
  ROLES: { OWNER: "owner" },
  hasPermission: () => true,
}));

// Lightweight stand-ins for drizzle-orm/sql query builder helpers.
mock.module("drizzle-orm/sql", () => ({
  eq: (...args: unknown[]) => ({ op: "eq", args }),
  desc: (col: unknown) => ({ op: "desc", col }),
  gte: (...args: unknown[]) => ({ op: "gte", args }),
  lte: (...args: unknown[]) => ({ op: "lte", args }),
  and: (...args: unknown[]) => ({ op: "and", args }),
}));

// Mock webhooks to avoid transitive DB access.
mock.module("@/lib/webhooks/events", () => ({
  fireWebhookEvent: async () => {},
}));

// Mock billing/usage used by extract route.
mock.module("@/lib/billing/usage", () => ({
  checkQuota: async () => mockQuotaResult,
  recordUsage: async () => {},
}));

// Mock AI MCP server and agent runner used by extract route.
mock.module("@/lib/ai/mcp-server-factory", () => ({
  createAgentMcpServer: () => ({ name: "mock-mcp" }),
}));

const mockRunAgentStreaming = mock(
  (_opts: unknown, _meta?: unknown): Response =>
    new Response("data: mock\n\n", {
      headers: { "Content-Type": "text/event-stream" },
    })
);

mock.module("@/lib/ai/agent-runner", () => ({
  runAgentStreaming: mockRunAgentStreaming,
}));

mock.module("@/lib/ai/prompts/insight-extraction", () => ({
  INSIGHT_EXTRACTION_PROMPT: "You are an insight extractor.",
}));

// Fake db with both query-style and chained interfaces.
const mockDb = {
  query: {
    workspaces: {
      findFirst: (_opts?: unknown) => Promise.resolve(mockWorkspaceResult),
    },
    insights: {
      findMany: (_opts?: unknown) => Promise.resolve(mockInsightRows),
      findFirst: (_opts?: unknown) => Promise.resolve(mockInsightResult),
    },
  },
  // Chainable select used by extract route's claudeSessions lookup.
  select: (_fields?: unknown) => ({
    from: (_table: unknown) => ({
      where: (_cond: unknown) => ({
        limit: async (_n: number) => mockDbSessionRows,
      }),
    }),
  }),
};

mock.module("@/lib/db", () => ({ db: mockDb }));

// Minimal NextResponse.json implementation that exposes _status and _body.
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

// ---------------------------------------------------------------------------
// Dynamic imports AFTER all mocks are registered.
// ---------------------------------------------------------------------------

let getInsights: (req: Request) => Promise<Response>;
let postExtract: (req: Request) => Promise<Response>;
let getInsightById: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

beforeAll(async () => {
  const insightsMod = await import("../insights/route");
  getInsights = insightsMod.GET;
  const extractMod = await import("../insights/extract/route");
  postExtract = extractMod.POST;
  const insightByIdMod = await import("../insights/[id]/route");
  getInsightById = insightByIdMod.GET;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type MockResponse = { _status: number; _body: unknown };

/**
 * Builds a minimal Request-like object whose `.url` property is the only part
 * the GET /api/insights handler reads.
 */
function makeListRequest(params: Record<string, string> = {}): Request {
  const url = new URL("http://localhost/api/insights");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return { url: url.toString() } as unknown as Request;
}

/**
 * Builds a minimal Request-like object whose `.json()` method resolves to the
 * given body – used for POST handlers.
 */
function makePostRequest(body: Record<string, unknown>): Request {
  return {
    json: () => Promise.resolve(body),
  } as unknown as Request;
}

/**
 * Builds the params object expected by route handlers that receive a dynamic
 * segment (e.g. GET /api/insights/[id]).
 */
function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("GET /api/insights", () => {
  beforeEach(() => {
    mockAuthSession = { user: { id: "user-1" } };
    mockWorkspaceResult = { id: "ws-1", slug: "my-workspace", ownerId: "user-1" };
    mockInsightRows = [];
  });

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  describe("authentication", () => {
    it("returns 401 when no session exists", async () => {
      mockAuthSession = null;
      const res = (await getInsights(
        makeListRequest({ workspace: "my-workspace" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(401);
    });

    it("returns Unauthorized error body when not authenticated", async () => {
      mockAuthSession = null;
      const res = (await getInsights(
        makeListRequest({ workspace: "my-workspace" })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, string>).error).toBe("Unauthorized");
    });

    it("does not return 401 when a valid session exists", async () => {
      const res = (await getInsights(
        makeListRequest({ workspace: "my-workspace" })
      )) as unknown as MockResponse;
      expect(res._status).not.toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // Required query parameter
  // -------------------------------------------------------------------------

  describe("workspace query param", () => {
    it("returns 400 when the workspace param is absent", async () => {
      const res = (await getInsights(makeListRequest())) as unknown as MockResponse;
      expect(res._status).toBe(400);
    });

    it("returns the correct error body when workspace param is absent", async () => {
      const res = (await getInsights(makeListRequest())) as unknown as MockResponse;
      expect((res._body as Record<string, string>).error).toBe(
        "workspace query param required"
      );
    });

    it("proceeds when the workspace param is provided", async () => {
      const res = (await getInsights(
        makeListRequest({ workspace: "my-workspace" })
      )) as unknown as MockResponse;
      expect(res._status).not.toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // Workspace lookup
  // -------------------------------------------------------------------------

  describe("workspace lookup", () => {
    it("returns 404 when workspace is not found", async () => {
      mockWorkspaceResult = undefined;
      const res = (await getInsights(
        makeListRequest({ workspace: "missing" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(404);
    });

    it("returns 404 when workspace belongs to a different user", async () => {
      mockWorkspaceResult = { id: "ws-1", slug: "other-ws", ownerId: "other-user" };
      const res = (await getInsights(
        makeListRequest({ workspace: "other-ws" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(404);
    });

    it("returns Workspace not found error body when workspace is missing", async () => {
      mockWorkspaceResult = undefined;
      const res = (await getInsights(
        makeListRequest({ workspace: "missing" })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, string>).error).toBe("Workspace not found");
    });

    it("proceeds past workspace lookup when workspace exists and belongs to the user", async () => {
      const res = (await getInsights(
        makeListRequest({ workspace: "my-workspace" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // Successful response shape
  // -------------------------------------------------------------------------

  describe("response structure", () => {
    it("returns 200 on a successful request", async () => {
      const res = (await getInsights(
        makeListRequest({ workspace: "my-workspace" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(200);
    });

    it("response body contains an insights array", async () => {
      const res = (await getInsights(
        makeListRequest({ workspace: "my-workspace" })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).insights).toBeDefined();
    });

    it("response body contains a limit field", async () => {
      const res = (await getInsights(
        makeListRequest({ workspace: "my-workspace" })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).limit).toBeDefined();
    });

    it("response body contains an offset field", async () => {
      const res = (await getInsights(
        makeListRequest({ workspace: "my-workspace" })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).offset).toBeDefined();
    });

    it("insights array contains the rows returned by the database", async () => {
      mockInsightRows = [
        { id: "i-1", summary: "alpha", compositeScore: 0.9 },
        { id: "i-2", summary: "beta", compositeScore: 0.7 },
      ];
      const res = (await getInsights(
        makeListRequest({ workspace: "my-workspace" })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).insights).toEqual(mockInsightRows);
    });

    it("insights array is empty when no insights are found", async () => {
      mockInsightRows = [];
      const res = (await getInsights(
        makeListRequest({ workspace: "my-workspace" })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).insights).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Pagination parameters
  // -------------------------------------------------------------------------

  describe("pagination", () => {
    it("uses a default limit of 20 when the limit parameter is absent", async () => {
      const res = (await getInsights(
        makeListRequest({ workspace: "my-workspace" })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).limit).toBe(20);
    });

    it("uses a default offset of 0 when the offset parameter is absent", async () => {
      const res = (await getInsights(
        makeListRequest({ workspace: "my-workspace" })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).offset).toBe(0);
    });

    it("reflects a custom limit in the response", async () => {
      const res = (await getInsights(
        makeListRequest({ workspace: "my-workspace", limit: "10" })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).limit).toBe(10);
    });

    it("reflects a custom offset in the response", async () => {
      const res = (await getInsights(
        makeListRequest({ workspace: "my-workspace", offset: "40" })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).offset).toBe(40);
    });
  });

  // -------------------------------------------------------------------------
  // minScore filter
  // -------------------------------------------------------------------------

  describe("minScore filter", () => {
    it("returns 200 when minScore is provided", async () => {
      const res = (await getInsights(
        makeListRequest({ workspace: "my-workspace", minScore: "0.5" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(200);
    });

    it("returns 200 when minScore is 0 (default, no filter applied)", async () => {
      const res = (await getInsights(
        makeListRequest({ workspace: "my-workspace", minScore: "0" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(200);
    });

    it("returns 200 when minScore is 1.0 (maximum)", async () => {
      const res = (await getInsights(
        makeListRequest({ workspace: "my-workspace", minScore: "1.0" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(200);
    });
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/insights/extract", () => {
  beforeEach(() => {
    mockAuthSession = { user: { id: "user-1" } };
    mockWorkspaceResult = { id: "ws-1", slug: "my-workspace", ownerId: "user-1" };
    mockDbSessionRows = [{ id: "cs-db-1", sessionId: "sess-abc" }];
    mockQuotaResult = { allowed: true, limit: 100, remaining: 95, percentUsed: 5 };
    mockRunAgentStreaming.mockClear();
    mockRunAgentStreaming.mockImplementation(
      () =>
        new Response("data: mock\n\n", {
          headers: { "Content-Type": "text/event-stream" },
        })
    );
  });

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  describe("authentication", () => {
    it("returns 401 when no session exists", async () => {
      mockAuthSession = null;
      const res = (await postExtract(
        makePostRequest({ sessionIds: ["cs-db-1"], workspaceSlug: "my-workspace" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(401);
    });

    it("returns Unauthorized error body when not authenticated", async () => {
      mockAuthSession = null;
      const res = (await postExtract(
        makePostRequest({ sessionIds: ["cs-db-1"], workspaceSlug: "my-workspace" })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, string>).error).toBe("Unauthorized");
    });
  });

  // -------------------------------------------------------------------------
  // Input validation
  // -------------------------------------------------------------------------

  describe("input validation", () => {
    it("returns 400 when sessionIds is missing", async () => {
      const res = (await postExtract(
        makePostRequest({ workspaceSlug: "my-workspace" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(400);
    });

    it("returns 400 when workspaceSlug is missing", async () => {
      const res = (await postExtract(
        makePostRequest({ sessionIds: ["cs-db-1"] })
      )) as unknown as MockResponse;
      expect(res._status).toBe(400);
    });

    it("returns 400 when body is empty", async () => {
      const res = (await postExtract(makePostRequest({}))) as unknown as MockResponse;
      expect(res._status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // Workspace lookup
  // -------------------------------------------------------------------------

  describe("workspace lookup", () => {
    it("returns 404 when workspace is not found", async () => {
      mockWorkspaceResult = undefined;
      const res = (await postExtract(
        makePostRequest({ sessionIds: ["cs-db-1"], workspaceSlug: "missing" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(404);
    });

    it("returns 404 when workspace belongs to a different user", async () => {
      mockWorkspaceResult = { id: "ws-1", slug: "other-ws", ownerId: "other-user" };
      const res = (await postExtract(
        makePostRequest({ sessionIds: ["cs-db-1"], workspaceSlug: "other-ws" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(404);
    });

    it("returns Workspace not found error body", async () => {
      mockWorkspaceResult = undefined;
      const res = (await postExtract(
        makePostRequest({ sessionIds: ["cs-db-1"], workspaceSlug: "missing" })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, string>).error).toBe("Workspace not found");
    });
  });

  // -------------------------------------------------------------------------
  // Quota enforcement
  // -------------------------------------------------------------------------

  describe("quota enforcement", () => {
    it("returns 402 when quota is exceeded", async () => {
      mockQuotaResult = { allowed: false, limit: 100, remaining: 0, percentUsed: 100 };
      const res = (await postExtract(
        makePostRequest({ sessionIds: ["cs-db-1"], workspaceSlug: "my-workspace" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(402);
    });

    it("returns quota info in the 402 response body", async () => {
      mockQuotaResult = { allowed: false, limit: 100, remaining: 0, percentUsed: 100 };
      const res = (await postExtract(
        makePostRequest({ sessionIds: ["cs-db-1"], workspaceSlug: "my-workspace" })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).quota).toBeDefined();
    });

    it("proceeds past quota check when quota is allowed", async () => {
      mockQuotaResult = { allowed: true, limit: 100, remaining: 50, percentUsed: 50 };
      const res = await postExtract(
        makePostRequest({ sessionIds: ["cs-db-1"], workspaceSlug: "my-workspace" })
      );
      // Not 402
      const status = ("_status" in (res as object) ? (res as MockResponse)._status : (res as Response).status);
      expect(status).not.toBe(402);
    });
  });

  // -------------------------------------------------------------------------
  // Session lookup
  // -------------------------------------------------------------------------

  describe("session lookup", () => {
    it("returns 404 when the session is not found in the database", async () => {
      mockDbSessionRows = [];
      const res = (await postExtract(
        makePostRequest({ sessionIds: ["nonexistent"], workspaceSlug: "my-workspace" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(404);
    });

    it("returns Session not found error body when session is missing", async () => {
      mockDbSessionRows = [];
      const res = (await postExtract(
        makePostRequest({ sessionIds: ["nonexistent"], workspaceSlug: "my-workspace" })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, string>).error).toBe("Session not found");
    });
  });

  // -------------------------------------------------------------------------
  // Successful extraction (streaming)
  // -------------------------------------------------------------------------

  describe("successful extraction", () => {
    it("returns a streaming Response on success", async () => {
      const res = await postExtract(
        makePostRequest({ sessionIds: ["cs-db-1"], workspaceSlug: "my-workspace" })
      );
      expect(res).toBeInstanceOf(Response);
    });

    it("calls runAgentStreaming on success", async () => {
      await postExtract(
        makePostRequest({ sessionIds: ["cs-db-1"], workspaceSlug: "my-workspace" })
      );
      expect(mockRunAgentStreaming).toHaveBeenCalled();
    });

    it("passes insight-extractor as the agentType", async () => {
      await postExtract(
        makePostRequest({ sessionIds: ["cs-db-1"], workspaceSlug: "my-workspace" })
      );
      const call = mockRunAgentStreaming.mock.calls[0][0] as { agentType: string };
      expect(call.agentType).toBe("insight-extractor");
    });
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/insights/[id]", () => {
  beforeEach(() => {
    mockAuthSession = { user: { id: "user-1" } };
    mockInsightResult = {
      id: "insight-1",
      summary: "test insight",
      workspace: { id: "ws-1", ownerId: "user-1" },
      session: { id: "s-1" },
    };
  });

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  describe("authentication", () => {
    it("returns 401 when no session exists", async () => {
      mockAuthSession = null;
      const res = (await getInsightById(
        {} as Request,
        makeParams("insight-1")
      )) as unknown as MockResponse;
      expect(res._status).toBe(401);
    });

    it("returns Unauthorized error body when not authenticated", async () => {
      mockAuthSession = null;
      const res = (await getInsightById(
        {} as Request,
        makeParams("insight-1")
      )) as unknown as MockResponse;
      expect((res._body as Record<string, string>).error).toBe("Unauthorized");
    });
  });

  // -------------------------------------------------------------------------
  // Insight lookup
  // -------------------------------------------------------------------------

  describe("insight lookup", () => {
    it("returns 404 when the insight is not found", async () => {
      mockInsightResult = undefined;
      const res = (await getInsightById(
        {} as Request,
        makeParams("nonexistent")
      )) as unknown as MockResponse;
      expect(res._status).toBe(404);
    });

    it("returns Insight not found error body when missing", async () => {
      mockInsightResult = undefined;
      const res = (await getInsightById(
        {} as Request,
        makeParams("nonexistent")
      )) as unknown as MockResponse;
      expect((res._body as Record<string, string>).error).toBe("Insight not found");
    });
  });

  // -------------------------------------------------------------------------
  // Ownership verification
  // -------------------------------------------------------------------------

  describe("ownership verification", () => {
    it("returns 403 when the workspace belongs to a different user", async () => {
      mockInsightResult = {
        id: "insight-1",
        summary: "test",
        workspace: { id: "ws-2", ownerId: "other-user" },
        session: { id: "s-1" },
      };
      const res = (await getInsightById(
        {} as Request,
        makeParams("insight-1")
      )) as unknown as MockResponse;
      expect(res._status).toBe(403);
    });

    it("returns Forbidden error body when ownership check fails", async () => {
      mockInsightResult = {
        id: "insight-1",
        summary: "test",
        workspace: { id: "ws-2", ownerId: "other-user" },
        session: { id: "s-1" },
      };
      const res = (await getInsightById(
        {} as Request,
        makeParams("insight-1")
      )) as unknown as MockResponse;
      expect((res._body as Record<string, string>).error).toBe("Forbidden");
    });
  });

  // -------------------------------------------------------------------------
  // Successful response
  // -------------------------------------------------------------------------

  describe("successful response", () => {
    it("returns 200 when the insight exists and belongs to the user", async () => {
      const res = (await getInsightById(
        {} as Request,
        makeParams("insight-1")
      )) as unknown as MockResponse;
      expect(res._status).toBe(200);
    });

    it("returns the full insight object in the response body", async () => {
      const res = (await getInsightById(
        {} as Request,
        makeParams("insight-1")
      )) as unknown as MockResponse;
      expect(res._body).toEqual(mockInsightResult);
    });

    it("response body contains the insight id", async () => {
      const res = (await getInsightById(
        {} as Request,
        makeParams("insight-1")
      )) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).id).toBe("insight-1");
    });

    it("response body contains the workspace relation", async () => {
      const res = (await getInsightById(
        {} as Request,
        makeParams("insight-1")
      )) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).workspace).toBeDefined();
    });

    it("response body contains the session relation", async () => {
      const res = (await getInsightById(
        {} as Request,
        makeParams("insight-1")
      )) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).session).toBeDefined();
    });
  });
});
