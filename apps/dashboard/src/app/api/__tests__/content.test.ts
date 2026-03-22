/**
 * Unit tests for the /api/content route handlers.
 *
 * Covers:
 *   GET  /api/content        – list posts with filtering & pagination
 *   POST /api/content        – create a new post
 *   GET  /api/content/export – export posts as a ZIP archive
 *
 * All external dependencies (auth, db, Next.js server utilities, AI tools, export)
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

/** Controls the rows returned by db.query.posts.findMany(). */
let mockPostRows: Record<string, unknown>[] = [];

/** Controls the result returned by createPost(). */
let mockCreatePostResult: Record<string, unknown> = {
  id: "post-1",
  title: "Test Post",
  markdown: "# Hello",
  contentType: "linkedin_post",
};

/** When truthy, createPost() throws this error. */
let mockCreatePostError: Error | null = null;

/** Controls the buffer returned by buildExportZip(). */
let mockZipBuffer: Buffer = Buffer.from("fake-zip-content");

/** When truthy, buildExportZip() throws this error. */
let mockExportError: Error | null = null;

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
// when bun:test's process-wide mock.module() picks another file's factory first.
import { SHARED_SCHEMA_MOCK } from "@/__test-utils__/shared-schema-mock";

mock.module("@sessionforge/db", () => ({
  ...SHARED_SCHEMA_MOCK,
  posts: {
    ...SHARED_SCHEMA_MOCK.posts,
    contentType: {
      enumValues: ["linkedin_post", "twitter_thread", "newsletter"],
    },
    status: {
      enumValues: ["draft", "published", "archived"],
    },
  },
}));

// Lightweight stand-ins for drizzle-orm/sql query builder helpers.
mock.module("drizzle-orm/sql", () => ({
  eq: (...args: unknown[]) => ({ op: "eq", args }),
  desc: (col: unknown) => ({ op: "desc", col }),
  and: (...args: unknown[]) => ({ op: "and", args }),
  gte: (...args: unknown[]) => ({ op: "gte", args }),
  lte: (...args: unknown[]) => ({ op: "lte", args }),
  ilike: (...args: unknown[]) => ({ op: "ilike", args }),
}));

// Fake db with query-style interface.
const mockDb = {
  query: {
    workspaces: {
      findFirst: (_opts?: unknown) => Promise.resolve(mockWorkspaceResult),
    },
    posts: {
      findMany: (_opts?: unknown) => Promise.resolve(mockPostRows),
    },
  },
};

mock.module("@/lib/db", () => ({ db: mockDb }));

// Mock the post creation tool used by the POST handler.
mock.module("@/lib/ai/tools/post-manager", () => ({
  createPost: (_opts: unknown) => {
    if (mockCreatePostError) return Promise.reject(mockCreatePostError);
    return Promise.resolve(mockCreatePostResult);
  },
}));

// Mock the export utility used by the export endpoint.
mock.module("@/lib/export/markdown-export", () => ({
  buildExportZip: (_posts: unknown) => {
    if (mockExportError) return Promise.reject(mockExportError);
    return Promise.resolve(mockZipBuffer);
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
let getContent: (req: Request) => Promise<Response>;
let postContent: (req: Request) => Promise<Response>;
let getExport: (req: Request) => Promise<Response>;

beforeAll(async () => {
  const contentMod = await import("../content/route");
  getContent = contentMod.GET;
  postContent = contentMod.POST;
  const exportMod = await import("../content/export/route");
  getExport = exportMod.GET;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type MockResponse = { _status: number; _body: unknown };

/**
 * Builds a minimal Request-like object whose `.url` property is the only part
 * the GET /api/content handler reads.
 */
function makeListRequest(params: Record<string, string> = {}): Request {
  const url = new URL("http://localhost/api/content");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return { url: url.toString() } as unknown as Request;
}

/**
 * Builds a minimal Request-like object whose `.url` property is set for
 * the GET /api/content/export handler.
 */
function makeExportRequest(params: Record<string, string> = {}): Request {
  const url = new URL("http://localhost/api/content/export");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return { url: url.toString() } as unknown as Request;
}

/**
 * Builds a minimal Request-like object whose `.json()` method resolves to the
 * given body – used for the POST /api/content handler.
 */
function makePostRequest(body: Record<string, unknown>): Request {
  return {
    json: () => Promise.resolve(body),
  } as unknown as Request;
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("GET /api/content", () => {
  beforeEach(() => {
    mockAuthSession = { user: { id: "user-1" } };
    mockWorkspaceResult = { id: "ws-1", slug: "my-workspace", ownerId: "user-1" };
    mockPostRows = [];
  });

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  describe("authentication", () => {
    it("returns 401 when no session exists", async () => {
      mockAuthSession = null;
      const res = (await getContent(
        makeListRequest({ workspace: "my-workspace" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(401);
    });

    it("returns Unauthorized error body when not authenticated", async () => {
      mockAuthSession = null;
      const res = (await getContent(
        makeListRequest({ workspace: "my-workspace" })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, string>).error).toBe("Unauthorized");
    });

    it("does not return 401 when a valid session exists", async () => {
      const res = (await getContent(
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
      const res = (await getContent(makeListRequest())) as unknown as MockResponse;
      expect(res._status).toBe(400);
    });

    it("returns the correct error body when workspace param is absent", async () => {
      const res = (await getContent(makeListRequest())) as unknown as MockResponse;
      expect((res._body as Record<string, string>).error).toBe(
        "workspace query param required"
      );
    });

    it("proceeds when the workspace param is provided", async () => {
      const res = (await getContent(
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
      const res = (await getContent(
        makeListRequest({ workspace: "missing" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(404);
    });

    it("returns 404 when workspace belongs to a different user", async () => {
      mockWorkspaceResult = { id: "ws-1", slug: "other-ws", ownerId: "other-user" };
      const res = (await getContent(
        makeListRequest({ workspace: "other-ws" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(404);
    });

    it("returns Workspace not found error body when workspace is missing", async () => {
      mockWorkspaceResult = undefined;
      const res = (await getContent(
        makeListRequest({ workspace: "missing" })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, string>).error).toBe("Workspace not found");
    });

    it("proceeds past workspace lookup when workspace exists and belongs to the user", async () => {
      const res = (await getContent(
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
      const res = (await getContent(
        makeListRequest({ workspace: "my-workspace" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(200);
    });

    it("response body contains a posts array", async () => {
      const res = (await getContent(
        makeListRequest({ workspace: "my-workspace" })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).posts).toBeDefined();
    });

    it("response body contains a limit field", async () => {
      const res = (await getContent(
        makeListRequest({ workspace: "my-workspace" })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).limit).toBeDefined();
    });

    it("response body contains an offset field", async () => {
      const res = (await getContent(
        makeListRequest({ workspace: "my-workspace" })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).offset).toBeDefined();
    });

    it("posts array contains the rows returned by the database", async () => {
      mockPostRows = [
        { id: "p-1", title: "Post Alpha", contentType: "linkedin_post" },
        { id: "p-2", title: "Post Beta", contentType: "twitter_thread" },
      ];
      const res = (await getContent(
        makeListRequest({ workspace: "my-workspace" })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).posts).toEqual(mockPostRows);
    });

    it("posts array is empty when no posts are found", async () => {
      mockPostRows = [];
      const res = (await getContent(
        makeListRequest({ workspace: "my-workspace" })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).posts).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Pagination parameters
  // -------------------------------------------------------------------------

  describe("pagination", () => {
    it("uses a default limit of 20 when the limit parameter is absent", async () => {
      const res = (await getContent(
        makeListRequest({ workspace: "my-workspace" })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).limit).toBe(20);
    });

    it("uses a default offset of 0 when the offset parameter is absent", async () => {
      const res = (await getContent(
        makeListRequest({ workspace: "my-workspace" })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).offset).toBe(0);
    });

    it("reflects a custom limit in the response", async () => {
      const res = (await getContent(
        makeListRequest({ workspace: "my-workspace", limit: "10" })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).limit).toBe(10);
    });

    it("reflects a custom offset in the response", async () => {
      const res = (await getContent(
        makeListRequest({ workspace: "my-workspace", offset: "40" })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, unknown>).offset).toBe(40);
    });
  });

  // -------------------------------------------------------------------------
  // Optional filters
  // -------------------------------------------------------------------------

  describe("optional filters", () => {
    it("returns 200 when type filter is provided", async () => {
      const res = (await getContent(
        makeListRequest({ workspace: "my-workspace", type: "linkedin_post" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(200);
    });

    it("returns 200 when status filter is provided", async () => {
      const res = (await getContent(
        makeListRequest({ workspace: "my-workspace", status: "draft" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(200);
    });

    it("returns 200 when both type and status filters are provided", async () => {
      const res = (await getContent(
        makeListRequest({ workspace: "my-workspace", type: "newsletter", status: "published" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(200);
    });
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/content", () => {
  beforeEach(() => {
    mockAuthSession = { user: { id: "user-1" } };
    mockWorkspaceResult = { id: "ws-1", slug: "my-workspace", ownerId: "user-1" };
    mockCreatePostResult = {
      id: "post-1",
      title: "Test Post",
      markdown: "# Hello",
      contentType: "linkedin_post",
    };
    mockCreatePostError = null;
  });

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  describe("authentication", () => {
    it("returns 401 when no session exists", async () => {
      mockAuthSession = null;
      const res = (await postContent(
        makePostRequest({
          workspaceSlug: "my-workspace",
          title: "Test",
          markdown: "# Test",
          contentType: "linkedin_post",
        })
      )) as unknown as MockResponse;
      expect(res._status).toBe(401);
    });

    it("returns Unauthorized error body when not authenticated", async () => {
      mockAuthSession = null;
      const res = (await postContent(
        makePostRequest({
          workspaceSlug: "my-workspace",
          title: "Test",
          markdown: "# Test",
          contentType: "linkedin_post",
        })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, string>).error).toBe("Unauthorized");
    });
  });

  // -------------------------------------------------------------------------
  // Input validation
  // -------------------------------------------------------------------------

  describe("input validation", () => {
    it("returns 400 when workspaceSlug is missing", async () => {
      const res = (await postContent(
        makePostRequest({ title: "Test", markdown: "# Test", contentType: "linkedin_post" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(400);
    });

    it("returns 400 when title is missing", async () => {
      const res = (await postContent(
        makePostRequest({ workspaceSlug: "my-workspace", markdown: "# Test", contentType: "linkedin_post" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(400);
    });

    it("returns 400 when markdown is missing", async () => {
      const res = (await postContent(
        makePostRequest({ workspaceSlug: "my-workspace", title: "Test", contentType: "linkedin_post" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(400);
    });

    it("returns 400 when contentType is missing", async () => {
      const res = (await postContent(
        makePostRequest({ workspaceSlug: "my-workspace", title: "Test", markdown: "# Test" })
      )) as unknown as MockResponse;
      expect(res._status).toBe(400);
    });

    it("returns the correct error body when required fields are absent", async () => {
      const res = (await postContent(makePostRequest({}))) as unknown as MockResponse;
      expect(typeof (res._body as Record<string, string>).error).toBe("string");
    });

    it("returns 400 when all required fields are missing", async () => {
      const res = (await postContent(makePostRequest({}))) as unknown as MockResponse;
      expect(res._status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // Workspace lookup
  // -------------------------------------------------------------------------

  describe("workspace lookup", () => {
    it("returns 404 when workspace is not found", async () => {
      mockWorkspaceResult = undefined;
      const res = (await postContent(
        makePostRequest({
          workspaceSlug: "missing",
          title: "Test",
          markdown: "# Test",
          contentType: "linkedin_post",
        })
      )) as unknown as MockResponse;
      expect(res._status).toBe(404);
    });

    it("returns 404 when workspace belongs to a different user", async () => {
      mockWorkspaceResult = { id: "ws-1", slug: "other-ws", ownerId: "other-user" };
      const res = (await postContent(
        makePostRequest({
          workspaceSlug: "other-ws",
          title: "Test",
          markdown: "# Test",
          contentType: "linkedin_post",
        })
      )) as unknown as MockResponse;
      expect(res._status).toBe(404);
    });

    it("returns Workspace not found error body", async () => {
      mockWorkspaceResult = undefined;
      const res = (await postContent(
        makePostRequest({
          workspaceSlug: "missing",
          title: "Test",
          markdown: "# Test",
          contentType: "linkedin_post",
        })
      )) as unknown as MockResponse;
      expect((res._body as Record<string, string>).error).toBe("Workspace not found");
    });
  });

  // -------------------------------------------------------------------------
  // Successful creation
  // -------------------------------------------------------------------------

  describe("successful creation", () => {
    it("returns 201 on successful post creation", async () => {
      const res = (await postContent(
        makePostRequest({
          workspaceSlug: "my-workspace",
          title: "Test Post",
          markdown: "# Hello World",
          contentType: "linkedin_post",
        })
      )) as unknown as MockResponse;
      expect(res._status).toBe(201);
    });

    it("returns the created post in the response body", async () => {
      mockCreatePostResult = {
        id: "post-99",
        title: "My LinkedIn Post",
        markdown: "# Hello",
        contentType: "linkedin_post",
      };
      const res = (await postContent(
        makePostRequest({
          workspaceSlug: "my-workspace",
          title: "My LinkedIn Post",
          markdown: "# Hello",
          contentType: "linkedin_post",
        })
      )) as unknown as MockResponse;
      expect(res._body).toEqual(mockCreatePostResult);
    });

    it("returns 201 when optional toneUsed is provided", async () => {
      const res = (await postContent(
        makePostRequest({
          workspaceSlug: "my-workspace",
          title: "Test",
          markdown: "# Test",
          contentType: "twitter_thread",
          toneUsed: "professional",
        })
      )) as unknown as MockResponse;
      expect(res._status).toBe(201);
    });

    it("returns 201 when optional insightId is provided", async () => {
      const res = (await postContent(
        makePostRequest({
          workspaceSlug: "my-workspace",
          title: "Test",
          markdown: "# Test",
          contentType: "newsletter",
          insightId: "insight-42",
        })
      )) as unknown as MockResponse;
      expect(res._status).toBe(201);
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe("error handling", () => {
    it("returns 500 when createPost throws an Error", async () => {
      mockCreatePostError = new Error("AI service unavailable");
      const res = (await postContent(
        makePostRequest({
          workspaceSlug: "my-workspace",
          title: "Test",
          markdown: "# Test",
          contentType: "linkedin_post",
        })
      )) as unknown as MockResponse;
      expect(res._status).toBe(500);
    });

    it("returns the error message when createPost throws an Error", async () => {
      mockCreatePostError = new Error("Database write failed");
      const res = (await postContent(
        makePostRequest({
          workspaceSlug: "my-workspace",
          title: "Test",
          markdown: "# Test",
          contentType: "linkedin_post",
        })
      )) as unknown as MockResponse;
      expect(typeof (res._body as Record<string, string>).error).toBe("string");
    });

    it("returns a generic error message when createPost throws a non-Error value", async () => {
      mockCreatePostError = "string error" as unknown as Error;
      const res = (await postContent(
        makePostRequest({
          workspaceSlug: "my-workspace",
          title: "Test",
          markdown: "# Test",
          contentType: "linkedin_post",
        })
      )) as unknown as MockResponse;
      expect(typeof (res._body as Record<string, string>).error).toBe("string");
    });
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/content/export", () => {
  beforeEach(() => {
    mockAuthSession = { user: { id: "user-1" } };
    mockWorkspaceResult = { id: "ws-1", slug: "my-workspace", ownerId: "user-1" };
    mockPostRows = [];
    mockZipBuffer = Buffer.from("fake-zip-content");
    mockExportError = null;
  });

  // -------------------------------------------------------------------------
  // The export handler returns NextResponse.json (mock) for error paths and a
  // native Response for the success path. The helpers below normalise access.
  // -------------------------------------------------------------------------

  /** Returns the HTTP status from either a mock or a native response. */
  function statusOf(res: unknown): number {
    if (res && typeof res === "object") {
      if ("_status" in (res as Record<string, unknown>)) {
        return (res as MockResponse)._status;
      }
      if ("status" in (res as Record<string, unknown>)) {
        return (res as Response).status;
      }
    }
    throw new Error("Unknown response shape");
  }

  /** Returns the JSON body from either a mock or a native response. */
  async function bodyOf(res: unknown): Promise<Record<string, unknown>> {
    if (res && typeof res === "object") {
      if ("_body" in (res as Record<string, unknown>)) {
        return (res as MockResponse)._body as Record<string, unknown>;
      }
      return (res as Response).json();
    }
    throw new Error("Unknown response shape");
  }

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  describe("authentication", () => {
    it("returns 401 when no session exists", async () => {
      mockAuthSession = null;
      const res = await getExport(makeExportRequest({ workspace: "my-workspace" }));
      expect(statusOf(res)).toBe(401);
    });

    it("returns Unauthorized error body when not authenticated", async () => {
      mockAuthSession = null;
      const res = await getExport(makeExportRequest({ workspace: "my-workspace" }));
      const body = await bodyOf(res);
      expect(body.error).toBe("Unauthorized");
    });

    it("does not return 401 when a valid session exists", async () => {
      const res = await getExport(makeExportRequest({ workspace: "my-workspace" }));
      expect(statusOf(res)).not.toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // Required query parameter
  // -------------------------------------------------------------------------

  describe("workspace query param", () => {
    it("returns 400 when the workspace param is absent", async () => {
      const res = await getExport(makeExportRequest());
      expect(statusOf(res)).toBe(400);
    });

    it("returns the correct error body when workspace param is absent", async () => {
      const res = await getExport(makeExportRequest());
      const body = await bodyOf(res);
      expect(body.error).toBe("workspace query param required");
    });

    it("proceeds when the workspace param is provided", async () => {
      const res = await getExport(makeExportRequest({ workspace: "my-workspace" }));
      expect(statusOf(res)).not.toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // Workspace lookup
  // -------------------------------------------------------------------------

  describe("workspace lookup", () => {
    it("returns 404 when workspace is not found", async () => {
      mockWorkspaceResult = undefined;
      const res = await getExport(makeExportRequest({ workspace: "missing" }));
      expect(statusOf(res)).toBe(404);
    });

    it("returns 404 when workspace belongs to a different user", async () => {
      mockWorkspaceResult = { id: "ws-1", slug: "other-ws", ownerId: "other-user" };
      const res = await getExport(makeExportRequest({ workspace: "other-ws" }));
      expect(statusOf(res)).toBe(404);
    });

    it("returns Workspace not found error body when workspace is missing", async () => {
      mockWorkspaceResult = undefined;
      const res = await getExport(makeExportRequest({ workspace: "missing" }));
      const body = await bodyOf(res);
      expect(body.error).toBe("Workspace not found");
    });
  });

  // -------------------------------------------------------------------------
  // Successful export response
  // -------------------------------------------------------------------------

  describe("successful export", () => {
    it("returns 200 on a successful export request", async () => {
      const res = await getExport(makeExportRequest({ workspace: "my-workspace" }));
      expect(statusOf(res)).toBe(200);
    });

    it("returns application/zip content type", async () => {
      const res = (await getExport(makeExportRequest({ workspace: "my-workspace" }))) as Response;
      expect(res.headers.get("Content-Type")).toBe("application/zip");
    });

    it("returns Content-Disposition header with attachment and filename", async () => {
      const res = (await getExport(makeExportRequest({ workspace: "my-workspace" }))) as Response;
      const disposition = res.headers.get("Content-Disposition");
      expect(disposition).toContain("attachment");
      expect(disposition).toContain("filename=");
    });

    it("returns Content-Disposition header with .zip filename", async () => {
      const res = (await getExport(makeExportRequest({ workspace: "my-workspace" }))) as Response;
      const disposition = res.headers.get("Content-Disposition");
      expect(disposition).toContain(".zip");
    });

    it("returns X-Export-Count header reflecting the number of posts", async () => {
      mockPostRows = [
        { id: "p-1", title: "Post A" },
        { id: "p-2", title: "Post B" },
      ];
      const res = (await getExport(makeExportRequest({ workspace: "my-workspace" }))) as Response;
      expect(res.headers.get("X-Export-Count")).toBe("2");
    });

    it("returns X-Export-Count of 0 when there are no posts", async () => {
      mockPostRows = [];
      const res = (await getExport(makeExportRequest({ workspace: "my-workspace" }))) as Response;
      expect(res.headers.get("X-Export-Count")).toBe("0");
    });
  });

  // -------------------------------------------------------------------------
  // Optional filters
  // -------------------------------------------------------------------------

  describe("optional filters", () => {
    it("returns 200 when type filter is provided", async () => {
      const res = await getExport(
        makeExportRequest({ workspace: "my-workspace", type: "linkedin_post" })
      );
      expect(statusOf(res)).toBe(200);
    });

    it("returns 200 when status filter is provided", async () => {
      const res = await getExport(
        makeExportRequest({ workspace: "my-workspace", status: "published" })
      );
      expect(statusOf(res)).toBe(200);
    });

    it("returns 200 when dateFrom filter is provided", async () => {
      const res = await getExport(
        makeExportRequest({ workspace: "my-workspace", dateFrom: "2024-01-01" })
      );
      expect(statusOf(res)).toBe(200);
    });

    it("returns 200 when dateTo filter is provided", async () => {
      const res = await getExport(
        makeExportRequest({ workspace: "my-workspace", dateTo: "2024-12-31" })
      );
      expect(statusOf(res)).toBe(200);
    });

    it("returns 200 when all optional filters are combined", async () => {
      const res = await getExport(
        makeExportRequest({
          workspace: "my-workspace",
          type: "newsletter",
          status: "draft",
          dateFrom: "2024-01-01",
          dateTo: "2024-12-31",
        })
      );
      expect(statusOf(res)).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe("error handling", () => {
    it("returns 500 when buildExportZip throws an Error", async () => {
      mockExportError = new Error("Zip generation failed");
      const res = await getExport(makeExportRequest({ workspace: "my-workspace" }));
      expect(statusOf(res)).toBe(500);
    });

    it("returns the error message when buildExportZip throws an Error", async () => {
      mockExportError = new Error("Out of memory");
      const res = await getExport(makeExportRequest({ workspace: "my-workspace" }));
      const body = await bodyOf(res);
      expect(typeof body.error).toBe("string");
    });

    it("returns a generic error message when buildExportZip throws a non-Error value", async () => {
      mockExportError = "string error" as unknown as Error;
      const res = await getExport(makeExportRequest({ workspace: "my-workspace" }));
      const body = await bodyOf(res);
      expect(typeof body.error).toBe("string");
    });
  });
});
