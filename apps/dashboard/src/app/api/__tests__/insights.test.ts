/**
 * Unit tests for the /api/insights route handlers.
 *
 * Covers:
 *   GET  /api/insights           – list insights with filtering & pagination
 *   POST /api/insights/extract   – trigger AI insight extraction for a session
 *   GET  /api/insights/[id]      – fetch a single insight by ID
 *
 * All external dependencies (auth, db, Next.js server utilities, AI agents)
 * are replaced with controllable in-memory fakes so that tests run without a
 * real database connection or Next.js runtime.
 */

import { describe, it, expect, beforeEach, mock } from "bun:test";

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

/** Controls the result returned by extractInsight(). */
let mockExtractResult: Record<string, unknown> = { id: "insight-1", summary: "test" };

/** When truthy, extractInsight() throws this error. */
let mockExtractError: Error | null = null;

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
    compositeScore: "i_compositeScore",
  },
  workspaces: {
    id: "ws_id",
    slug: "ws_slug",
    ownerId: "ws_ownerId",
  },
}));

// Lightweight stand-ins for drizzle-orm query builder helpers.
mock.module("drizzle-orm", () => ({
  eq: (...args: unknown[]) => ({ op: "eq", args }),
  desc: (col: unknown) => ({ op: "desc", col }),
  gte: (...args: unknown[]) => ({ op: "gte", args }),
  and: (...args: unknown[]) => ({ op: "and", args }),
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
};

mock.module("@/lib/db", () => ({ db: mockDb }));

// Mock the AI insight extractor used by the extract endpoint.
mock.module("@/lib/ai/agents/insight-extractor", () => ({
  extractInsight: (_opts: unknown) => {
    if (mockExtractError) return Promise.reject(mockExtractError);
    return Promise.resolve(mockExtractResult);
  },
}));

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

// Import route handlers AFTER all mocks are registered.
// eslint-disable-next-line import/first
import { GET as getInsights } from "../insights/route";
// eslint-disable-next-line import/first
import { POST as postExtract } from "../insights/extract/route";
// eslint-disable-next-line import/first
import { GET as getInsightById } from "../insights/[id]/route";

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
 * given body – used for the POST /api/insights/extract handler.
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
    mockExtractResult = { id: "insight-1", summary: "extracted insight" };
    mockExtractError = null;
  });

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  describe("authentication", () => {
    it("returns 401 when no session exists", async () => {
      mockAuthSession = null;
      const res = (await postExtract(
        makePostRequest({ sessionId: "s-1", workspaceSlug: "my-workspace" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(401);
    });

    it("returns Unauthorized error body when not authenticated", async () => {
      mockAuthSession = null;
      const res = (await postExtract(
        makePostRequest({ sessionId: "s-1", workspaceSlug: "my-workspace" })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, string>).error).toBe("Unauthorized");
    });
  });

  // -------------------------------------------------------------------------
  // Input validation
  // -------------------------------------------------------------------------

  describe("input validation", () => {
    it("returns 400 when sessionId is missing", async () => {
      const res = (await postExtract(
        makePostRequest({ workspaceSlug: "my-workspace" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(400);
    });

    it("returns 400 when workspaceSlug is missing", async () => {
      const res = (await postExtract(
        makePostRequest({ sessionId: "s-1" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(400);
    });

    it("returns the correct error body when required fields are absent", async () => {
      const res = (await postExtract(makePostRequest({}))) as unknown as MockResponse;
      expect((res._body as Record<string, string>).error).toBe(
        "sessionId and workspaceSlug are required"
      );
    });

    it("returns 400 when both sessionId and workspaceSlug are missing", async () => {
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
        makePostRequest({ sessionId: "s-1", workspaceSlug: "missing" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(404);
    });

    it("returns 404 when workspace belongs to a different user", async () => {
      mockWorkspaceResult = { id: "ws-1", slug: "other-ws", ownerId: "other-user" };
      const res = (await postExtract(
        makePostRequest({ sessionId: "s-1", workspaceSlug: "other-ws" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(404);
    });

    it("returns Workspace not found error body", async () => {
      mockWorkspaceResult = undefined;
      const res = (await postExtract(
        makePostRequest({ sessionId: "s-1", workspaceSlug: "missing" })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, string>).error).toBe("Workspace not found");
    });
  });

  // -------------------------------------------------------------------------
  // Successful extraction
  // -------------------------------------------------------------------------

  describe("successful extraction", () => {
    it("returns 200 on a successful extraction", async () => {
      const res = (await postExtract(
        makePostRequest({ sessionId: "s-1", workspaceSlug: "my-workspace" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(200);
    });

    it("returns the extraction result in the response body", async () => {
      mockExtractResult = { id: "insight-99", summary: "deep analysis", compositeScore: 0.95 };
      const res = (await postExtract(
        makePostRequest({ sessionId: "s-1", workspaceSlug: "my-workspace" })
      )) as unknown as MockResponse;
      expect(res._body).toEqual(mockExtractResult);
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe("error handling", () => {
    it("returns 500 when the extractor throws an Error", async () => {
      mockExtractError = new Error("AI service unavailable");
      const res = (await postExtract(
        makePostRequest({ sessionId: "s-1", workspaceSlug: "my-workspace" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(500);
    });

    it("returns the error message when the extractor throws an Error", async () => {
      mockExtractError = new Error("AI service unavailable");
      const res = (await postExtract(
        makePostRequest({ sessionId: "s-1", workspaceSlug: "my-workspace" })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, string>).error).toBe("AI service unavailable");
    });

    it("returns 'Extraction failed' when the extractor throws a non-Error value", async () => {
      mockExtractError = "string error" as unknown as Error;
      const res = (await postExtract(
        makePostRequest({ sessionId: "s-1", workspaceSlug: "my-workspace" })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, string>).error).toBe("Extraction failed");
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
