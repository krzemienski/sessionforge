/**
 * Unit tests for the /api/automation/triggers route handlers.
 *
 * Covers:
 *   GET  /api/automation/triggers  – list triggers for a workspace
 *   POST /api/automation/triggers  – create a new trigger (manual, scheduled, file_watch)
 *
 * All external dependencies (auth, db, Next.js server utilities, QStash) are
 * replaced with controllable in-memory fakes so that tests run without a real
 * database connection or Next.js runtime.
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

/** Controls the triggers returned by db.query.contentTriggers.findMany(). */
let mockTriggerRows: Record<string, unknown>[] = [];

/** Controls the trigger row returned by db.insert().returning(). */
let mockInsertedTrigger: Record<string, unknown> = {
  id: "trigger-1",
  workspaceId: "ws-1",
  name: "My Trigger",
  triggerType: "manual",
  contentType: "linkedin_post",
  lookbackWindow: "last_7_days",
  cronExpression: null,
  debounceMinutes: 30,
  qstashScheduleId: null,
  watchStatus: null,
};

/** Controls the trigger row returned by db.update().returning(). */
let mockUpdatedTrigger: Record<string, unknown> = {
  id: "trigger-1",
  workspaceId: "ws-1",
  name: "My Trigger",
  triggerType: "scheduled",
  contentType: "linkedin_post",
  lookbackWindow: "last_7_days",
  cronExpression: "0 9 * * 1",
  debounceMinutes: 30,
  qstashScheduleId: "sch-abc",
  watchStatus: null,
};

/** When truthy, createTriggerSchedule() rejects with this error. */
let mockCreateTriggerScheduleError: Error | null = null;

/** When truthy, createFileWatchSchedule() rejects with this error. */
let mockCreateFileWatchScheduleError: Error | null = null;

/** Stores the schedule ID returned by createTriggerSchedule(). */
let mockTriggerScheduleId = "sch-abc";

/** Stores the schedule ID returned by createFileWatchSchedule(). */
let mockFileWatchScheduleId = "sch-fw-1";

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

// Comprehensive shared @sessionforge/db mock — ensures cross-file compatibility
import { SHARED_SCHEMA_MOCK } from "@/__test-utils__/shared-schema-mock";

mock.module("@sessionforge/db", () => ({
  ...SHARED_SCHEMA_MOCK,
  contentTriggers: {
    ...SHARED_SCHEMA_MOCK.contentTriggers,
    id: "ct_id",
    workspaceId: "ct_workspaceId",
    name: "ct_name",
    triggerType: "ct_triggerType",
    contentType: "ct_contentType",
    lookbackWindow: "ct_lookbackWindow",
    cronExpression: "ct_cronExpression",
    debounceMinutes: "ct_debounceMinutes",
    qstashScheduleId: "ct_qstashScheduleId",
    watchStatus: "ct_watchStatus",
  },
}));

// Lightweight stand-ins for drizzle-orm/sql query builder helpers.
mock.module("drizzle-orm/sql", () => ({
  eq: (...args: unknown[]) => ({ op: "eq", args }),
}));

// Fake db with query-style interface and chainable insert/update builders.
const mockDb = {
  query: {
    workspaces: {
      findFirst: (_opts?: unknown) => Promise.resolve(mockWorkspaceResult),
    },
    contentTriggers: {
      findMany: (_opts?: unknown) => Promise.resolve(mockTriggerRows),
    },
  },
  insert(_table: unknown) {
    return {
      values(_values: unknown) {
        return {
          returning: () => Promise.resolve([mockInsertedTrigger]),
        };
      },
    };
  },
  update(_table: unknown) {
    return {
      set(_values: unknown) {
        return {
          where(_condition: unknown) {
            return {
              returning: () => Promise.resolve([mockUpdatedTrigger]),
            };
          },
        };
      },
    };
  },
};

mock.module("@/lib/db", () => ({ db: mockDb }));

// Mock QStash schedule creation utilities.
mock.module("@/lib/qstash", () => ({
  createTriggerSchedule: (_triggerId: string, _cron: string) => {
    if (mockCreateTriggerScheduleError) return Promise.reject(mockCreateTriggerScheduleError);
    return Promise.resolve(mockTriggerScheduleId);
  },
  createFileWatchSchedule: (_triggerId: string) => {
    if (mockCreateFileWatchScheduleError) return Promise.reject(mockCreateFileWatchScheduleError);
    return Promise.resolve(mockFileWatchScheduleId);
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

// Dynamic imports AFTER all mocks are registered.
let GET: (req: Request) => Promise<Response>;
let POST: (req: Request) => Promise<Response>;

beforeAll(async () => {
  const mod = await import("../automation/triggers/route");
  GET = mod.GET;
  POST = mod.POST;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type MockResponse = { _status: number; _body: unknown };

/**
 * Builds a minimal Request-like object for GET requests whose `.url` is the
 * only part the handler reads.
 */
function makeGetRequest(params: Record<string, string> = {}): Request {
  const url = new URL("http://localhost/api/automation/triggers");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return { url: url.toString() } as unknown as Request;
}

/**
 * Builds a minimal Request-like object for POST requests whose `.json()` method
 * resolves to the given body.
 */
function makePostRequest(body: Record<string, unknown>): Request {
  return {
    json: () => Promise.resolve(body),
  } as unknown as Request;
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("GET /api/automation/triggers", () => {
  beforeEach(() => {
    mockAuthSession = { user: { id: "user-1" } };
    mockWorkspaceResult = { id: "ws-1", slug: "my-workspace", ownerId: "user-1" };
    mockTriggerRows = [];
  });

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  describe("authentication", () => {
    it("returns 401 when no session exists", async () => {
      mockAuthSession = null;
      const res = (await GET(makeGetRequest({ workspace: "my-workspace" }))) as unknown as MockResponse;
      expect(res._status).toBe(401);
    });

    it("returns Unauthorized error body when not authenticated", async () => {
      mockAuthSession = null;
      const res = (await GET(makeGetRequest({ workspace: "my-workspace" }))) as unknown as MockResponse;
      expect((res._body as Record<string, string>).error).toBe("Unauthorized");
    });

    it("does not return 401 when a valid session exists", async () => {
      const res = (await GET(makeGetRequest({ workspace: "my-workspace" }))) as unknown as MockResponse;
      expect(res._status).not.toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // Required query parameter
  // -------------------------------------------------------------------------

  describe("workspace query param", () => {
    it("returns 400 when the workspace param is absent", async () => {
      const res = (await GET(makeGetRequest())) as unknown as MockResponse;
      expect(res._status).toBe(400);
    });

    it("returns the correct error body when workspace param is absent", async () => {
      const res = (await GET(makeGetRequest())) as unknown as MockResponse;
      expect((res._body as Record<string, string>).error).toBe("workspace query param required");
    });

    it("proceeds when the workspace param is provided", async () => {
      const res = (await GET(makeGetRequest({ workspace: "my-workspace" }))) as unknown as MockResponse;
      expect(res._status).not.toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // Workspace lookup
  // -------------------------------------------------------------------------

  describe("workspace lookup", () => {
    it("returns 404 when workspace is not found", async () => {
      mockWorkspaceResult = undefined;
      const res = (await GET(makeGetRequest({ workspace: "missing" }))) as unknown as MockResponse;
      expect(res._status).toBe(404);
    });

    it("returns 404 when workspace belongs to a different user", async () => {
      mockWorkspaceResult = { id: "ws-1", slug: "other-ws", ownerId: "other-user" };
      const res = (await GET(makeGetRequest({ workspace: "other-ws" }))) as unknown as MockResponse;
      expect(res._status).toBe(404);
    });

    it("returns Workspace not found error body when workspace is missing", async () => {
      mockWorkspaceResult = undefined;
      const res = (await GET(makeGetRequest({ workspace: "missing" }))) as unknown as MockResponse;
      expect((res._body as Record<string, string>).error).toBe("Workspace not found");
    });

    it("proceeds past workspace lookup when workspace exists and belongs to the user", async () => {
      const res = (await GET(makeGetRequest({ workspace: "my-workspace" }))) as unknown as MockResponse;
      expect(res._status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // Successful response shape
  // -------------------------------------------------------------------------

  describe("response structure", () => {
    it("returns 200 on a successful request", async () => {
      const res = (await GET(makeGetRequest({ workspace: "my-workspace" }))) as unknown as MockResponse;
      expect(res._status).toBe(200);
    });

    it("response body contains a triggers array", async () => {
      const res = (await GET(makeGetRequest({ workspace: "my-workspace" }))) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).triggers).toBeDefined();
    });

    it("triggers array contains the rows returned by the database", async () => {
      mockTriggerRows = [
        { id: "t-1", name: "Trigger Alpha", triggerType: "scheduled" },
        { id: "t-2", name: "Trigger Beta", triggerType: "file_watch" },
      ];
      const res = (await GET(makeGetRequest({ workspace: "my-workspace" }))) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).triggers).toEqual(mockTriggerRows);
    });

    it("triggers array is empty when no triggers are found", async () => {
      mockTriggerRows = [];
      const res = (await GET(makeGetRequest({ workspace: "my-workspace" }))) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).triggers).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/automation/triggers", () => {
  beforeEach(() => {
    mockAuthSession = { user: { id: "user-1" } };
    mockWorkspaceResult = { id: "ws-1", slug: "my-workspace", ownerId: "user-1" };
    mockInsertedTrigger = {
      id: "trigger-1",
      workspaceId: "ws-1",
      name: "My Trigger",
      triggerType: "manual",
      contentType: "linkedin_post",
      lookbackWindow: "last_7_days",
      cronExpression: null,
      debounceMinutes: 30,
      qstashScheduleId: null,
      watchStatus: null,
    };
    mockUpdatedTrigger = {
      id: "trigger-1",
      workspaceId: "ws-1",
      name: "My Trigger",
      triggerType: "scheduled",
      contentType: "linkedin_post",
      lookbackWindow: "last_7_days",
      cronExpression: "0 9 * * 1",
      debounceMinutes: 30,
      qstashScheduleId: "sch-abc",
      watchStatus: null,
    };
    mockTriggerScheduleId = "sch-abc";
    mockFileWatchScheduleId = "sch-fw-1";
    mockCreateTriggerScheduleError = null;
    mockCreateFileWatchScheduleError = null;
  });

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  describe("authentication", () => {
    it("returns 401 when no session exists", async () => {
      mockAuthSession = null;
      const res = (await POST(
        makePostRequest({ workspaceSlug: "my-workspace", triggerType: "manual", contentType: "linkedin_post" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(401);
    });

    it("returns Unauthorized error body when not authenticated", async () => {
      mockAuthSession = null;
      const res = (await POST(
        makePostRequest({ workspaceSlug: "my-workspace", triggerType: "manual", contentType: "linkedin_post" })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, string>).error).toBe("Unauthorized");
    });
  });

  // -------------------------------------------------------------------------
  // Input validation
  // -------------------------------------------------------------------------

  describe("input validation", () => {
    it("returns 400 when workspaceSlug is missing", async () => {
      const res = (await POST(
        makePostRequest({ triggerType: "manual", contentType: "linkedin_post" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(400);
    });

    it("returns 400 when triggerType is missing", async () => {
      const res = (await POST(
        makePostRequest({ workspaceSlug: "my-workspace", contentType: "linkedin_post" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(400);
    });

    it("returns 400 when contentType is missing", async () => {
      const res = (await POST(
        makePostRequest({ workspaceSlug: "my-workspace", triggerType: "manual" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(400);
    });

    it("returns 400 when all required fields are missing", async () => {
      const res = (await POST(makePostRequest({}))) as unknown as MockResponse;
      expect(res._status).toBe(400);
    });

    it("returns an error body when required fields are absent", async () => {
      const res = (await POST(makePostRequest({}))) as unknown as MockResponse;
      // Route uses parseBody/zod which returns a generic validation error
      expect(typeof (res._body as Record<string, string>).error).toBe("string");
    });
  });

  // -------------------------------------------------------------------------
  // Workspace lookup
  // -------------------------------------------------------------------------

  describe("workspace lookup", () => {
    it("returns 404 when workspace is not found", async () => {
      mockWorkspaceResult = undefined;
      const res = (await POST(
        makePostRequest({ workspaceSlug: "missing", triggerType: "manual", contentType: "linkedin_post" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(404);
    });

    it("returns 404 when workspace belongs to a different user", async () => {
      mockWorkspaceResult = { id: "ws-1", slug: "other-ws", ownerId: "other-user" };
      const res = (await POST(
        makePostRequest({ workspaceSlug: "other-ws", triggerType: "manual", contentType: "linkedin_post" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(404);
    });

    it("returns Workspace not found error body when workspace is missing", async () => {
      mockWorkspaceResult = undefined;
      const res = (await POST(
        makePostRequest({ workspaceSlug: "missing", triggerType: "manual", contentType: "linkedin_post" })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, string>).error).toBe("Workspace not found");
    });
  });

  // -------------------------------------------------------------------------
  // Manual trigger creation
  // -------------------------------------------------------------------------

  describe("manual trigger creation", () => {
    it("returns 201 on successful trigger creation", async () => {
      const res = (await POST(
        makePostRequest({ workspaceSlug: "my-workspace", triggerType: "manual", contentType: "linkedin_post" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(201);
    });

    it("returns the created trigger in the response body", async () => {
      mockInsertedTrigger = {
        id: "trigger-99",
        workspaceId: "ws-1",
        name: "Untitled Schedule",
        triggerType: "manual",
        contentType: "linkedin_post",
        lookbackWindow: "last_7_days",
        cronExpression: null,
        debounceMinutes: 30,
        qstashScheduleId: null,
        watchStatus: null,
      };
      const res = (await POST(
        makePostRequest({ workspaceSlug: "my-workspace", triggerType: "manual", contentType: "linkedin_post" })
      )) as unknown as MockResponse;
      expect(res._body).toEqual(mockInsertedTrigger);
    });

    it("returns 201 when optional name is provided", async () => {
      const res = (await POST(
        makePostRequest({
          workspaceSlug: "my-workspace",
          triggerType: "manual",
          contentType: "twitter_thread",
          name: "My Custom Trigger",
        })
      )) as unknown as MockResponse;
      expect(res._status).toBe(201);
    });

    it("returns 201 when optional lookbackWindow is provided", async () => {
      const res = (await POST(
        makePostRequest({
          workspaceSlug: "my-workspace",
          triggerType: "manual",
          contentType: "linkedin_post",
          lookbackWindow: "last_30_days",
        })
      )) as unknown as MockResponse;
      expect(res._status).toBe(201);
    });

    it("returns 201 when optional debounceMinutes is provided", async () => {
      const res = (await POST(
        makePostRequest({
          workspaceSlug: "my-workspace",
          triggerType: "manual",
          contentType: "linkedin_post",
          debounceMinutes: 60,
        })
      )) as unknown as MockResponse;
      expect(res._status).toBe(201);
    });
  });

  // -------------------------------------------------------------------------
  // Scheduled trigger creation
  // -------------------------------------------------------------------------

  describe("scheduled trigger creation", () => {
    it("returns 201 when a scheduled trigger is created with a cron expression", async () => {
      const res = (await POST(
        makePostRequest({
          workspaceSlug: "my-workspace",
          triggerType: "scheduled",
          contentType: "linkedin_post",
          cronExpression: "0 9 * * 1",
        })
      )) as unknown as MockResponse;
      expect(res._status).toBe(201);
    });

    it("returns the updated trigger with qstashScheduleId after schedule creation", async () => {
      mockUpdatedTrigger = {
        id: "trigger-1",
        workspaceId: "ws-1",
        name: "My Trigger",
        triggerType: "scheduled",
        contentType: "linkedin_post",
        lookbackWindow: "last_7_days",
        cronExpression: "0 9 * * 1",
        debounceMinutes: 30,
        qstashScheduleId: "sch-abc",
        watchStatus: null,
      };
      const res = (await POST(
        makePostRequest({
          workspaceSlug: "my-workspace",
          triggerType: "scheduled",
          contentType: "linkedin_post",
          cronExpression: "0 9 * * 1",
        })
      )) as unknown as MockResponse;
      expect(res._body).toEqual(mockUpdatedTrigger);
    });

    it("returns 201 when scheduled trigger is created without a cron expression", async () => {
      const res = (await POST(
        makePostRequest({
          workspaceSlug: "my-workspace",
          triggerType: "scheduled",
          contentType: "linkedin_post",
        })
      )) as unknown as MockResponse;
      expect(res._status).toBe(201);
    });

    it("returns 201 even when createTriggerSchedule throws (graceful fallback)", async () => {
      mockCreateTriggerScheduleError = new Error("QStash unavailable");
      const res = (await POST(
        makePostRequest({
          workspaceSlug: "my-workspace",
          triggerType: "scheduled",
          contentType: "linkedin_post",
          cronExpression: "0 9 * * 1",
        })
      )) as unknown as MockResponse;
      expect(res._status).toBe(201);
    });

    it("returns the original trigger when createTriggerSchedule fails", async () => {
      mockCreateTriggerScheduleError = new Error("QStash unavailable");
      const res = (await POST(
        makePostRequest({
          workspaceSlug: "my-workspace",
          triggerType: "scheduled",
          contentType: "linkedin_post",
          cronExpression: "0 9 * * 1",
        })
      )) as unknown as MockResponse;
      expect(res._body).toEqual(mockInsertedTrigger);
    });
  });

  // -------------------------------------------------------------------------
  // File watch trigger creation
  // -------------------------------------------------------------------------

  describe("file_watch trigger creation", () => {
    it("returns 201 when a file_watch trigger is created", async () => {
      mockUpdatedTrigger = {
        id: "trigger-1",
        workspaceId: "ws-1",
        name: "File Watcher",
        triggerType: "file_watch",
        contentType: "linkedin_post",
        lookbackWindow: "last_7_days",
        cronExpression: null,
        debounceMinutes: 30,
        qstashScheduleId: "sch-fw-1",
        watchStatus: "watching",
      };
      const res = (await POST(
        makePostRequest({
          workspaceSlug: "my-workspace",
          triggerType: "file_watch",
          contentType: "linkedin_post",
        })
      )) as unknown as MockResponse;
      expect(res._status).toBe(201);
    });

    it("returns the updated trigger with watchStatus watching after file watch creation", async () => {
      mockUpdatedTrigger = {
        id: "trigger-1",
        workspaceId: "ws-1",
        name: "File Watcher",
        triggerType: "file_watch",
        contentType: "linkedin_post",
        lookbackWindow: "last_7_days",
        cronExpression: null,
        debounceMinutes: 30,
        qstashScheduleId: "sch-fw-1",
        watchStatus: "watching",
      };
      const res = (await POST(
        makePostRequest({
          workspaceSlug: "my-workspace",
          triggerType: "file_watch",
          contentType: "linkedin_post",
        })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).watchStatus).toBe("watching");
    });

    it("returns 201 even when createFileWatchSchedule throws (graceful fallback)", async () => {
      mockCreateFileWatchScheduleError = new Error("QStash unavailable");
      const res = (await POST(
        makePostRequest({
          workspaceSlug: "my-workspace",
          triggerType: "file_watch",
          contentType: "linkedin_post",
        })
      )) as unknown as MockResponse;
      expect(res._status).toBe(201);
    });

    it("returns the original trigger when createFileWatchSchedule fails", async () => {
      mockCreateFileWatchScheduleError = new Error("QStash unavailable");
      const res = (await POST(
        makePostRequest({
          workspaceSlug: "my-workspace",
          triggerType: "file_watch",
          contentType: "linkedin_post",
        })
      )) as unknown as MockResponse;
      expect(res._body).toEqual(mockInsertedTrigger);
    });
  });
});
