/**
 * Unit tests for the GET /api/sessions route handler.
 *
 * All external dependencies (auth, db, Next.js server utilities) are replaced
 * with controllable in-memory fakes so that tests run without a real database
 * connection or Next.js runtime.
 */

import { describe, it, expect, beforeEach, beforeAll, mock } from "bun:test";
import { AppError, ERROR_CODES } from "@/lib/errors";

// ---------------------------------------------------------------------------
// Mutable mock state shared between mock factories and test cases
// ---------------------------------------------------------------------------

/** Controls what auth.api.getSession() resolves with. */
let mockAuthSession: { user: { id: string } } | null = { user: { id: "user-1" } };

/** Controls the workspace lookup result. */
let mockWorkspaceResult: { id: string }[] = [{ id: "ws-1" }];

/** Controls the session rows returned for the main query. */
let mockSessionRows: Record<string, unknown>[] = [];

/** Controls the total count returned by the count query. */
let mockSessionCount = 0;

/** Tracks how many times db.select() has been called in a given request. */
let dbSelectCallIndex = 0;

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

// Provide lightweight stand-ins for drizzle table schema objects.
// The mock db ignores the column references, so any non-null values suffice.
mock.module("@sessionforge/db", () => ({
  claudeSessions: {
    workspaceId: "cs_workspaceId",
    startedAt: "cs_startedAt",
    messageCount: "cs_messageCount",
    costUsd: "cs_costUsd",
    durationSeconds: "cs_durationSeconds",
    projectName: "cs_projectName",
  },
  workspaces: {
    id: "ws_id",
    ownerId: "ws_ownerId",
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

// Mock workspace-auth to use existing mockWorkspaceResult + mockAuthSession.
// Uses the REAL AppError (imported above) so withApiHandler recognises it.
mock.module("@/lib/workspace-auth", () => {
  const getAuthorizedWorkspace = async (session: any, slug: string, _perm?: string) => {
    if (!mockWorkspaceResult.length) throw new AppError("Workspace not found", ERROR_CODES.NOT_FOUND);
    return { workspace: { ...mockWorkspaceResult[0], slug, ownerId: session.user.id }, role: "owner" };
  };
  const getAuthorizedWorkspaceById = async (session: any, id: string, _perm?: string) => {
    if (!mockWorkspaceResult.length) throw new AppError("Workspace not found", ERROR_CODES.NOT_FOUND);
    return { workspace: { ...mockWorkspaceResult[0], ownerId: session.user.id }, role: "owner" };
  };
  const logWorkspaceActivity = async () => {};
  return { getAuthorizedWorkspace, getAuthorizedWorkspaceById, logWorkspaceActivity };
});

mock.module("@/lib/permissions", () => ({
  PERMISSIONS: {
    CONTENT_READ: "content:read",
    SESSIONS_READ: "sessions:read",
    SESSIONS_SCAN: "sessions:scan",
    WORKSPACE_SETTINGS: "workspace:settings",
  },
  ROLES: { OWNER: "owner" },
  hasPermission: () => true,
}));

// Provide lightweight stand-ins for drizzle-orm query builder helpers.
// The mock db never inspects the condition objects they produce.
mock.module("drizzle-orm/sql", () => ({
  eq: (...args: unknown[]) => ({ op: "eq", args }),
  desc: (col: unknown) => ({ op: "desc", col }),
  asc: (col: unknown) => ({ op: "asc", col }),
  gte: (...args: unknown[]) => ({ op: "gte", args }),
  lte: (...args: unknown[]) => ({ op: "lte", args }),
  and: (...args: unknown[]) => ({ op: "and", args }),
  isNotNull: (col: unknown) => ({ op: "isNotNull", col }),
  isNull: (col: unknown) => ({ op: "isNull", col }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ op: "sql", strings, values }),
}));

// ---------------------------------------------------------------------------
// Fake db with a chainable query-builder interface
//
// The route issues three db.select() calls per request:
//   idx 0  – workspace lookup:  select().from().where().limit(1)
//   idx 1  – rows query:        select().from().where().orderBy().limit().offset()
//   idx 2  – count query:       select().from().where()   (directly awaited)
// ---------------------------------------------------------------------------

const mockDb = {
  select(_selection?: unknown) {
    const idx = dbSelectCallIndex++;
    return {
      from(_table: unknown) {
        return {
          where(_condition: unknown) {
            return {
              // Workspace query (idx === 0) terminates with .limit(1)
              limit(_n: number) {
                if (idx === 0) return Promise.resolve(mockWorkspaceResult);
                return Promise.resolve([]);
              },
              // Rows query terminates with .orderBy().limit().offset()
              orderBy(_col: unknown) {
                return {
                  limit(_n: number) {
                    return {
                      offset(_n: number) {
                        return Promise.resolve(mockSessionRows);
                      },
                    };
                  },
                };
              },
              // Count query is directly awaited via Promise.all – make it thenable
              then(
                onFulfilled: (value: unknown) => unknown,
                onRejected?: (reason: unknown) => unknown
              ) {
                return Promise.resolve([{ count: mockSessionCount }]).then(
                  onFulfilled,
                  onRejected
                );
              },
              catch(onRejected: (reason: unknown) => unknown) {
                return Promise.resolve([{ count: mockSessionCount }]).catch(onRejected);
              },
            };
          },
        };
      },
    };
  },
};

mock.module("@/lib/db", () => ({ db: mockDb }));

// Provide a minimal NextResponse.json implementation that exposes _status and
// _body so tests can inspect the response without making real HTTP calls.
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

// Dynamic import AFTER all mocks are registered.
let GET: (req: Parameters<typeof import("../sessions/route")["GET"]>[0]) => Promise<Response>;

beforeAll(async () => {
  const mod = await import("../sessions/route");
  GET = mod.GET;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type MockResponse = { _status: number; _body: unknown };

/**
 * Builds a minimal request-like object whose only required property is
 * `nextUrl`, which is the only part of NextRequest that the route handler
 * reads directly.  Includes `workspace=test-workspace` by default.
 */
function makeRequest(params: Record<string, string> = {}): Request {
  const url = new URL("http://localhost/api/sessions");
  // Always include workspace unless explicitly overridden via params
  if (!("workspace" in params)) {
    url.searchParams.set("workspace", "test-workspace");
  }
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return { url: url.toString() } as unknown as Request;
}

/**
 * Builds a request WITHOUT the workspace query param (for testing the 400 path).
 */
function makeRequestWithoutWorkspace(): Request {
  const url = new URL("http://localhost/api/sessions");
  return { url: url.toString() } as unknown as Request;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("GET /api/sessions", () => {
  beforeEach(() => {
    mockAuthSession = { user: { id: "user-1" } };
    mockWorkspaceResult = [{ id: "ws-1" }];
    mockSessionRows = [];
    mockSessionCount = 0;
    dbSelectCallIndex = 0;
  });

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  describe("authentication", () => {
    it("returns 401 when no session exists", async () => {
      mockAuthSession = null;
      const res = (await GET(makeRequest())) as unknown as MockResponse;
      expect(res._status).toBe(401);
    });

    it("returns Unauthorized error body when not authenticated", async () => {
      mockAuthSession = null;
      const res = (await GET(makeRequest())) as unknown as MockResponse;
      expect((res._body as Record<string, string>).error).toBe("Unauthorized");
    });

    it("does not return 401 when a valid session exists", async () => {
      const res = (await GET(makeRequest())) as unknown as MockResponse;
      expect(res._status).not.toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // Workspace lookup
  // -------------------------------------------------------------------------

  describe("workspace lookup", () => {
    it("returns 400 when the workspace query param is missing", async () => {
      const res = (await GET(makeRequestWithoutWorkspace())) as unknown as MockResponse;
      expect(res._status).toBe(400);
    });

    it("returns 'workspace query param required' error body when param is missing", async () => {
      const res = (await GET(makeRequestWithoutWorkspace())) as unknown as MockResponse;
      expect((res._body as Record<string, string>).error).toBe("workspace query param required");
    });

    it("returns 404 when the workspace is not found", async () => {
      mockWorkspaceResult = [];
      const res = (await GET(makeRequest())) as unknown as MockResponse;
      expect(res._status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // Successful response shape
  // -------------------------------------------------------------------------

  describe("response structure", () => {
    it("returns 200 on a successful request", async () => {
      const res = (await GET(makeRequest())) as unknown as MockResponse;
      expect(res._status).toBe(200);
    });

    it("response body contains a sessions array", async () => {
      const res = (await GET(makeRequest())) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).sessions).toBeDefined();
    });

    it("response body contains a total count", async () => {
      const res = (await GET(makeRequest())) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).total).toBeDefined();
    });

    it("response body contains a limit field", async () => {
      const res = (await GET(makeRequest())) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).limit).toBeDefined();
    });

    it("response body contains an offset field", async () => {
      const res = (await GET(makeRequest())) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).offset).toBeDefined();
    });

    it("sessions array contains the session rows returned by the database", async () => {
      mockSessionRows = [
        { id: 1, sessionId: "abc", projectName: "project-a" },
        { id: 2, sessionId: "def", projectName: "project-b" },
      ];
      const res = (await GET(makeRequest())) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).sessions).toEqual(mockSessionRows);
    });

    it("sessions array is empty when no sessions are found", async () => {
      mockSessionRows = [];
      const res = (await GET(makeRequest())) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).sessions).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Pagination parameters
  // -------------------------------------------------------------------------

  describe("pagination", () => {
    it("uses a default limit of 20 when the limit parameter is absent", async () => {
      const res = (await GET(makeRequest())) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).limit).toBe(20);
    });

    it("uses a default offset of 0 when the offset parameter is absent", async () => {
      const res = (await GET(makeRequest())) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).offset).toBe(0);
    });

    it("reflects a custom limit in the response", async () => {
      const res = (await GET(makeRequest({ limit: "10" }))) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).limit).toBe(10);
    });

    it("reflects a custom offset in the response", async () => {
      const res = (await GET(makeRequest({ offset: "40" }))) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).offset).toBe(40);
    });

    it("caps the limit at 100 when a value greater than 100 is requested", async () => {
      const res = (await GET(makeRequest({ limit: "500" }))) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).limit).toBe(100);
    });

    it("accepts limit of exactly 100 without capping", async () => {
      const res = (await GET(makeRequest({ limit: "100" }))) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).limit).toBe(100);
    });

    it("reflects offset 0 explicitly when offset=0 is provided", async () => {
      const res = (await GET(makeRequest({ offset: "0" }))) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).offset).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Total count
  // -------------------------------------------------------------------------

  describe("total count", () => {
    it("returns 0 total when the database count is zero", async () => {
      mockSessionCount = 0;
      const res = (await GET(makeRequest())) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).total).toBe(0);
    });

    it("returns the correct total from the count query", async () => {
      mockSessionCount = 42;
      const res = (await GET(makeRequest())) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).total).toBe(42);
    });

    it("total is a number type", async () => {
      mockSessionCount = 7;
      const res = (await GET(makeRequest())) as unknown as MockResponse;
      const total = (res._body as Record<string, unknown>).total;
      expect(typeof total).toBe("number");
    });
  });

  // -------------------------------------------------------------------------
  // Sort and order parameters
  // -------------------------------------------------------------------------

  describe("sort and order parameters", () => {
    it("returns 200 when sort=startedAt is specified", async () => {
      const res = (await GET(makeRequest({ sort: "startedAt" }))) as unknown as MockResponse;
      expect(res._status).toBe(200);
    });

    it("returns 200 when sort=messageCount is specified", async () => {
      const res = (await GET(makeRequest({ sort: "messageCount" }))) as unknown as MockResponse;
      expect(res._status).toBe(200);
    });

    it("returns 200 when sort=costUsd is specified", async () => {
      const res = (await GET(makeRequest({ sort: "costUsd" }))) as unknown as MockResponse;
      expect(res._status).toBe(200);
    });

    it("returns 200 when sort=durationSeconds is specified", async () => {
      const res = (
        await GET(makeRequest({ sort: "durationSeconds" }))
      ) as unknown as MockResponse;
      expect(res._status).toBe(200);
    });

    it("returns 200 when an unknown sort column is requested (falls back to default)", async () => {
      const res = (await GET(makeRequest({ sort: "unknown" }))) as unknown as MockResponse;
      expect(res._status).toBe(200);
    });

    it("returns 200 when order=asc is specified", async () => {
      const res = (await GET(makeRequest({ order: "asc" }))) as unknown as MockResponse;
      expect(res._status).toBe(200);
    });

    it("returns 200 when order=desc is specified", async () => {
      const res = (await GET(makeRequest({ order: "desc" }))) as unknown as MockResponse;
      expect(res._status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // Filter parameters
  // -------------------------------------------------------------------------

  describe("filter parameters", () => {
    it("returns 200 when a project filter is applied", async () => {
      const res = (
        await GET(makeRequest({ project: "my-project" }))
      ) as unknown as MockResponse;
      expect(res._status).toBe(200);
    });

    it("returns 200 when a minMessages filter is applied", async () => {
      const res = (await GET(makeRequest({ minMessages: "5" }))) as unknown as MockResponse;
      expect(res._status).toBe(200);
    });

    it("returns 200 when both project and minMessages filters are combined", async () => {
      const res = (
        await GET(makeRequest({ project: "my-project", minMessages: "10" }))
      ) as unknown as MockResponse;
      expect(res._status).toBe(200);
    });
  });
});
