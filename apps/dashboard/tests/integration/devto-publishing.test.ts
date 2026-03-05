/**
 * Integration tests for the Dev.to publishing workflow.
 *
 * Exercises the GET, POST, and PUT handlers of the Dev.to publish route,
 * mocking auth, database, and the Dev.to API client at their boundaries.
 * Validates that the route correctly orchestrates auth checks, DB queries,
 * external API calls, and DB writes across the full publish/update lifecycle.
 */

import { describe, it, expect, mock, beforeEach } from "bun:test";

// ---------------------------------------------------------------------------
// Shared mock state — reset and re-wired per test in beforeEach
// ---------------------------------------------------------------------------

const mockSession = {
  user: { id: "user-001", email: "user@example.com", name: "Test User" },
};

const mockPost = {
  id: "post-001",
  workspaceId: "ws-001",
  title: "My Dev.to Post",
  markdown: "# Hello\n\nThis is my post.",
  status: "draft",
  workspace: {
    id: "ws-001",
    slug: "my-workspace",
    ownerId: "user-001",
  },
};

const mockIntegration = {
  id: "integration-001",
  workspaceId: "ws-001",
  apiKey: "devto-api-key-abc",
  enabled: true,
};

const mockPublication = {
  id: "pub-001",
  workspaceId: "ws-001",
  postId: "post-001",
  integrationId: "integration-001",
  devtoArticleId: 99999,
  devtoUrl: "https://dev.to/user/my-post",
  publishedAsDraft: true,
  syncedAt: new Date("2024-06-01T10:00:00Z"),
  integration: {
    id: "integration-001",
    apiKey: "devto-api-key-abc",
    enabled: true,
  },
};

// ---------------------------------------------------------------------------
// Mock functions
// ---------------------------------------------------------------------------

const mockGetSession = mock(async () => mockSession);
const mockHeaders = mock(async () => new Headers());

const mockFindFirstPost = mock(async () => mockPost);
const mockFindFirstIntegration = mock(async () => mockIntegration);
const mockFindFirstPublication = mock(async () => null);

const mockDbInsert = mock(() => ({ values: mockDbInsertValues }));
const mockDbInsertValues = mock(async () => undefined);
const mockDbUpdateSet = mock(() => ({ where: mockDbUpdateWhere }));
const mockDbUpdateWhere = mock(async () => undefined);
const mockDbUpdate = mock(() => ({ set: mockDbUpdateSet }));

const mockPublishToDevto = mock(async () => ({
  id: 12345,
  url: "https://dev.to/user/new-post",
  published: false,
}));
const mockUpdateDevtoArticle = mock(async () => ({
  id: 99999,
  url: "https://dev.to/user/my-post-updated",
  published: true,
}));

// ---------------------------------------------------------------------------
// Register module mocks BEFORE any dynamic imports
// ---------------------------------------------------------------------------

mock.module("@/lib/auth", () => ({
  auth: {
    api: { getSession: mockGetSession },
  },
}));

mock.module("next/headers", () => ({
  headers: mockHeaders,
}));

mock.module("@/lib/db", () => ({
  db: {
    query: {
      posts: { findFirst: mockFindFirstPost },
      devtoIntegrations: { findFirst: mockFindFirstIntegration },
      devtoPublications: { findFirst: mockFindFirstPublication },
    },
    insert: mockDbInsert,
    update: mockDbUpdate,
  },
}));

mock.module("@sessionforge/db", () => ({
  posts: {},
  devtoIntegrations: {},
  devtoPublications: {},
}));

mock.module("drizzle-orm", () => ({
  eq: mock(() => null),
  and: mock(() => null),
}));

mock.module("@/lib/integrations/devto", () => ({
  publishToDevto: mockPublishToDevto,
  updateDevtoArticle: mockUpdateDevtoArticle,
  DevtoApiError: class DevtoApiError extends Error {
    constructor(
      message: string,
      public readonly status: number,
      public readonly code: string
    ) {
      super(message);
      this.name = "DevtoApiError";
    }
  },
}));

// ---------------------------------------------------------------------------
// Dynamic import of route handlers (after mocks are registered)
// ---------------------------------------------------------------------------

let GET: (req: Request) => Promise<Response>;
let POST: (req: Request) => Promise<Response>;
let PUT: (req: Request) => Promise<Response>;

let DevtoApiError: new (message: string, status: number, code: string) => Error & {
  status: number;
  code: string;
};

// Import route handlers and DevtoApiError after mocks are set up
const routeModule = await import(
  "../../src/app/api/integrations/devto/publish/route"
);
GET = routeModule.GET;
POST = routeModule.POST;
PUT = routeModule.PUT;

const devtoModule = await import("@/lib/integrations/devto");
DevtoApiError = devtoModule.DevtoApiError as typeof DevtoApiError;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGetRequest(postId?: string): Request {
  const url = postId
    ? `http://localhost/api/integrations/devto/publish?postId=${postId}`
    : `http://localhost/api/integrations/devto/publish`;
  return new Request(url, { method: "GET" });
}

function makePostRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/integrations/devto/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makePutRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/integrations/devto/publish", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function parseJson(res: Response): Promise<unknown> {
  return res.json();
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("Dev.to publishing workflow integration", () => {
  beforeEach(() => {
    // Reset all mocks between tests
    mockGetSession.mockReset();
    mockFindFirstPost.mockReset();
    mockFindFirstIntegration.mockReset();
    mockFindFirstPublication.mockReset();
    mockDbInsert.mockReset();
    mockDbInsertValues.mockReset();
    mockDbUpdate.mockReset();
    mockDbUpdateSet.mockReset();
    mockDbUpdateWhere.mockReset();
    mockPublishToDevto.mockReset();
    mockUpdateDevtoArticle.mockReset();

    // Restore default implementations
    mockGetSession.mockImplementation(async () => mockSession);
    mockFindFirstPost.mockImplementation(async () => mockPost);
    mockFindFirstIntegration.mockImplementation(async () => mockIntegration);
    mockFindFirstPublication.mockImplementation(async () => null);
    mockDbInsertValues.mockImplementation(async () => undefined);
    mockDbInsert.mockImplementation(() => ({ values: mockDbInsertValues }));
    mockDbUpdateWhere.mockImplementation(async () => undefined);
    mockDbUpdateSet.mockImplementation(() => ({ where: mockDbUpdateWhere }));
    mockDbUpdate.mockImplementation(() => ({ set: mockDbUpdateSet }));
    mockPublishToDevto.mockImplementation(async () => ({
      id: 12345,
      url: "https://dev.to/user/new-post",
      published: false,
    }));
    mockUpdateDevtoArticle.mockImplementation(async () => ({
      id: 99999,
      url: "https://dev.to/user/my-post-updated",
      published: true,
    }));
  });

  // -------------------------------------------------------------------------
  // GET: check publication status
  // -------------------------------------------------------------------------

  describe("GET /api/integrations/devto/publish", () => {
    it("returns published: false when no publication record exists", async () => {
      mockFindFirstPublication.mockImplementation(async () => null);

      const res = await GET(makeGetRequest("post-001"));
      const body = await parseJson(res) as Record<string, unknown>;

      expect(res.status).toBe(200);
      expect(body.published).toBe(false);
    });

    it("returns full publication details when post is published", async () => {
      mockFindFirstPublication.mockImplementation(async () => mockPublication);

      const res = await GET(makeGetRequest("post-001"));
      const body = await parseJson(res) as Record<string, unknown>;

      expect(res.status).toBe(200);
      expect(body.published).toBe(true);
      expect(body.devtoArticleId).toBe(mockPublication.devtoArticleId);
      expect(body.devtoUrl).toBe(mockPublication.devtoUrl);
      expect(body.publishedAsDraft).toBe(mockPublication.publishedAsDraft);
    });

    it("returns 401 when no session exists", async () => {
      mockGetSession.mockImplementation(async () => null);

      const res = await GET(makeGetRequest("post-001"));
      const body = await parseJson(res) as Record<string, unknown>;

      expect(res.status).toBe(401);
      expect(body.error).toBe("Unauthorized");
    });

    it("returns 400 when postId query param is missing", async () => {
      const res = await GET(makeGetRequest());
      const body = await parseJson(res) as Record<string, unknown>;

      expect(res.status).toBe(400);
      expect(body.error).toBe("postId query param required");
    });

    it("returns 404 when post does not exist", async () => {
      mockFindFirstPost.mockImplementation(async () => null);

      const res = await GET(makeGetRequest("nonexistent-post"));
      const body = await parseJson(res) as Record<string, unknown>;

      expect(res.status).toBe(404);
      expect(body.error).toBe("Post not found");
    });

    it("returns 403 when post belongs to a different user", async () => {
      mockFindFirstPost.mockImplementation(async () => ({
        ...mockPost,
        workspace: { ...mockPost.workspace, ownerId: "other-user-999" },
      }));

      const res = await GET(makeGetRequest("post-001"));
      const body = await parseJson(res) as Record<string, unknown>;

      expect(res.status).toBe(403);
      expect(body.error).toBe("Forbidden");
    });
  });

  // -------------------------------------------------------------------------
  // POST: publish new article to Dev.to
  // -------------------------------------------------------------------------

  describe("POST /api/integrations/devto/publish", () => {
    const validBody = {
      postId: "post-001",
      workspaceSlug: "my-workspace",
      published: false,
      tags: ["typescript", "webdev"],
    };

    it("successfully publishes post as a draft and creates publication record", async () => {
      const res = await POST(makePostRequest(validBody));
      const body = await parseJson(res) as Record<string, unknown>;

      expect(res.status).toBe(201);
      expect(body.devtoArticleId).toBe(12345);
      expect(body.devtoUrl).toBe("https://dev.to/user/new-post");
      expect(body.published).toBe(false);
      expect(mockPublishToDevto).toHaveBeenCalledTimes(1);
      expect(mockDbInsert).toHaveBeenCalledTimes(1);
    });

    it("updates post status to published when Dev.to returns published: true", async () => {
      mockPublishToDevto.mockImplementation(async () => ({
        id: 12345,
        url: "https://dev.to/user/new-post",
        published: true,
      }));

      const res = await POST(makePostRequest({ ...validBody, published: true }));
      const body = await parseJson(res) as Record<string, unknown>;

      expect(res.status).toBe(201);
      expect(body.published).toBe(true);
      // Should update post status and insert publication
      expect(mockDbInsert).toHaveBeenCalledTimes(1);
      expect(mockDbUpdate).toHaveBeenCalledTimes(1);
    });

    it("returns 401 when no session exists", async () => {
      mockGetSession.mockImplementation(async () => null);

      const res = await POST(makePostRequest(validBody));
      const body = await parseJson(res) as Record<string, unknown>;

      expect(res.status).toBe(401);
      expect(body.error).toBe("Unauthorized");
    });

    it("returns 400 when postId is missing", async () => {
      const res = await POST(makePostRequest({ workspaceSlug: "my-workspace" }));
      const body = await parseJson(res) as Record<string, unknown>;

      expect(res.status).toBe(400);
      expect(body.error).toBe("postId and workspaceSlug are required");
    });

    it("returns 400 when workspaceSlug is missing", async () => {
      const res = await POST(makePostRequest({ postId: "post-001" }));
      const body = await parseJson(res) as Record<string, unknown>;

      expect(res.status).toBe(400);
      expect(body.error).toBe("postId and workspaceSlug are required");
    });

    it("returns 404 when post does not exist", async () => {
      mockFindFirstPost.mockImplementation(async () => null);

      const res = await POST(makePostRequest(validBody));
      const body = await parseJson(res) as Record<string, unknown>;

      expect(res.status).toBe(404);
      expect(body.error).toBe("Post not found");
    });

    it("returns 403 when workspace slug does not match", async () => {
      const res = await POST(makePostRequest({ ...validBody, workspaceSlug: "wrong-workspace" }));
      const body = await parseJson(res) as Record<string, unknown>;

      expect(res.status).toBe(403);
      expect(body.error).toBe("Forbidden");
    });

    it("returns 403 when post belongs to a different user", async () => {
      mockFindFirstPost.mockImplementation(async () => ({
        ...mockPost,
        workspace: { ...mockPost.workspace, ownerId: "other-user-999" },
      }));

      const res = await POST(makePostRequest(validBody));
      const body = await parseJson(res) as Record<string, unknown>;

      expect(res.status).toBe(403);
      expect(body.error).toBe("Forbidden");
    });

    it("returns 400 when Dev.to integration is not configured", async () => {
      mockFindFirstIntegration.mockImplementation(async () => null);

      const res = await POST(makePostRequest(validBody));
      const body = await parseJson(res) as Record<string, unknown>;

      expect(res.status).toBe(400);
      expect(body.error).toBe("Dev.to integration not configured or disabled");
    });

    it("returns 409 when post is already published to Dev.to", async () => {
      mockFindFirstPublication.mockImplementation(async () => mockPublication);

      const res = await POST(makePostRequest(validBody));
      const body = await parseJson(res) as Record<string, unknown>;

      expect(res.status).toBe(409);
      expect(body.error).toContain("already published");
    });

    it("returns 400 when Dev.to API responds with 401 invalid key error", async () => {
      mockPublishToDevto.mockImplementation(async () => {
        throw new DevtoApiError(
          "Invalid Dev.to API key. Please check your API key and try again.",
          401,
          "invalid_api_key"
        );
      });

      const res = await POST(makePostRequest(validBody));
      const body = await parseJson(res) as Record<string, unknown>;

      expect(res.status).toBe(400);
      expect(body.error).toContain("Invalid Dev.to API key");
      expect(body.code).toBe("invalid_api_key");
    });

    it("returns the Dev.to status for non-401 DevtoApiError responses", async () => {
      mockPublishToDevto.mockImplementation(async () => {
        throw new DevtoApiError(
          "Dev.to rate limit exceeded. Please wait a moment and try again.",
          429,
          "rate_limited"
        );
      });

      const res = await POST(makePostRequest(validBody));
      const body = await parseJson(res) as Record<string, unknown>;

      expect(res.status).toBe(429);
      expect(body.code).toBe("rate_limited");
    });

    it("returns 500 on unexpected errors during publish", async () => {
      mockPublishToDevto.mockImplementation(async () => {
        throw new Error("Network timeout");
      });

      const res = await POST(makePostRequest(validBody));
      const body = await parseJson(res) as Record<string, unknown>;

      expect(res.status).toBe(500);
      expect(body.error).toBe("Network timeout");
    });

    it("passes tags and canonicalUrl to the Dev.to API", async () => {
      const bodyWithExtras = {
        ...validBody,
        tags: ["react", "nextjs"],
        canonicalUrl: "https://myblog.com/my-post",
        series: "My Series",
      };

      await POST(makePostRequest(bodyWithExtras));

      expect(mockPublishToDevto).toHaveBeenCalledWith(
        mockIntegration.apiKey,
        expect.objectContaining({
          title: mockPost.title,
          body_markdown: mockPost.markdown,
          published: false,
          tags: ["react", "nextjs"],
          canonical_url: "https://myblog.com/my-post",
          series: "My Series",
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // PUT: update existing Dev.to article
  // -------------------------------------------------------------------------

  describe("PUT /api/integrations/devto/publish", () => {
    const validBody = {
      postId: "post-001",
      workspaceSlug: "my-workspace",
      published: true,
      tags: ["typescript"],
    };

    beforeEach(() => {
      // PUT requires an existing publication record
      mockFindFirstPublication.mockImplementation(async () => mockPublication);
    });

    it("successfully updates an existing Dev.to article", async () => {
      const res = await PUT(makePutRequest(validBody));
      const body = await parseJson(res) as Record<string, unknown>;

      expect(res.status).toBe(200);
      expect(body.devtoArticleId).toBe(99999);
      expect(body.devtoUrl).toBe("https://dev.to/user/my-post-updated");
      expect(body.published).toBe(true);
      expect(mockUpdateDevtoArticle).toHaveBeenCalledTimes(1);
    });

    it("updates post status to published when Dev.to article is published", async () => {
      mockUpdateDevtoArticle.mockImplementation(async () => ({
        id: 99999,
        url: "https://dev.to/user/my-post-updated",
        published: true,
      }));

      await PUT(makePutRequest(validBody));

      expect(mockDbUpdate).toHaveBeenCalledTimes(2); // devtoPublications + posts
    });

    it("does not update post status when article remains a draft", async () => {
      mockUpdateDevtoArticle.mockImplementation(async () => ({
        id: 99999,
        url: "https://dev.to/user/my-post-updated",
        published: false,
      }));

      await PUT(makePutRequest({ ...validBody, published: false }));

      expect(mockDbUpdate).toHaveBeenCalledTimes(1); // only devtoPublications
    });

    it("returns 401 when no session exists", async () => {
      mockGetSession.mockImplementation(async () => null);

      const res = await PUT(makePutRequest(validBody));
      const body = await parseJson(res) as Record<string, unknown>;

      expect(res.status).toBe(401);
      expect(body.error).toBe("Unauthorized");
    });

    it("returns 400 when postId is missing", async () => {
      const res = await PUT(makePutRequest({ workspaceSlug: "my-workspace" }));
      const body = await parseJson(res) as Record<string, unknown>;

      expect(res.status).toBe(400);
      expect(body.error).toBe("postId and workspaceSlug are required");
    });

    it("returns 400 when workspaceSlug is missing", async () => {
      const res = await PUT(makePutRequest({ postId: "post-001" }));
      const body = await parseJson(res) as Record<string, unknown>;

      expect(res.status).toBe(400);
      expect(body.error).toBe("postId and workspaceSlug are required");
    });

    it("returns 404 when post does not exist", async () => {
      mockFindFirstPost.mockImplementation(async () => null);

      const res = await PUT(makePutRequest(validBody));
      const body = await parseJson(res) as Record<string, unknown>;

      expect(res.status).toBe(404);
      expect(body.error).toBe("Post not found");
    });

    it("returns 403 when workspace slug does not match", async () => {
      const res = await PUT(makePutRequest({ ...validBody, workspaceSlug: "wrong-slug" }));
      const body = await parseJson(res) as Record<string, unknown>;

      expect(res.status).toBe(403);
      expect(body.error).toBe("Forbidden");
    });

    it("returns 403 when post belongs to a different user", async () => {
      mockFindFirstPost.mockImplementation(async () => ({
        ...mockPost,
        workspace: { ...mockPost.workspace, ownerId: "attacker-user" },
      }));

      const res = await PUT(makePutRequest(validBody));
      const body = await parseJson(res) as Record<string, unknown>;

      expect(res.status).toBe(403);
      expect(body.error).toBe("Forbidden");
    });

    it("returns 404 when no publication record exists yet", async () => {
      mockFindFirstPublication.mockImplementation(async () => null);

      const res = await PUT(makePutRequest(validBody));
      const body = await parseJson(res) as Record<string, unknown>;

      expect(res.status).toBe(404);
      expect(body.error).toContain("not published to Dev.to yet");
    });

    it("returns 400 when the Dev.to integration is disabled", async () => {
      mockFindFirstPublication.mockImplementation(async () => ({
        ...mockPublication,
        integration: { ...mockPublication.integration, enabled: false },
      }));

      const res = await PUT(makePutRequest(validBody));
      const body = await parseJson(res) as Record<string, unknown>;

      expect(res.status).toBe(400);
      expect(body.error).toBe("Dev.to integration is disabled");
    });

    it("returns 400 when Dev.to API responds with 401 invalid key error", async () => {
      mockUpdateDevtoArticle.mockImplementation(async () => {
        throw new DevtoApiError(
          "Invalid Dev.to API key. Please check your API key and try again.",
          401,
          "invalid_api_key"
        );
      });

      const res = await PUT(makePutRequest(validBody));
      const body = await parseJson(res) as Record<string, unknown>;

      expect(res.status).toBe(400);
      expect(body.code).toBe("invalid_api_key");
    });

    it("returns the Dev.to status for non-401 DevtoApiError responses", async () => {
      mockUpdateDevtoArticle.mockImplementation(async () => {
        throw new DevtoApiError(
          "Dev.to validation error. Check your article content and tags.",
          422,
          "validation_error"
        );
      });

      const res = await PUT(makePutRequest(validBody));
      const body = await parseJson(res) as Record<string, unknown>;

      expect(res.status).toBe(422);
      expect(body.code).toBe("validation_error");
    });

    it("returns 500 on unexpected errors during update", async () => {
      mockUpdateDevtoArticle.mockImplementation(async () => {
        throw new Error("Service unavailable");
      });

      const res = await PUT(makePutRequest(validBody));
      const body = await parseJson(res) as Record<string, unknown>;

      expect(res.status).toBe(500);
      expect(body.error).toBe("Service unavailable");
    });

    it("passes article data to the Dev.to API with correct article ID", async () => {
      const bodyWithExtras = {
        ...validBody,
        canonicalUrl: "https://myblog.com/updated-post",
        series: "Part 2",
      };

      await PUT(makePutRequest(bodyWithExtras));

      expect(mockUpdateDevtoArticle).toHaveBeenCalledWith(
        mockPublication.integration.apiKey,
        mockPublication.devtoArticleId,
        expect.objectContaining({
          title: mockPost.title,
          body_markdown: mockPost.markdown,
          published: true,
          canonical_url: "https://myblog.com/updated-post",
          series: "Part 2",
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // Cross-cutting: authentication checks prevent data leakage
  // -------------------------------------------------------------------------

  describe("authentication and authorization boundaries", () => {
    it("never calls the Dev.to API for unauthenticated POST requests", async () => {
      mockGetSession.mockImplementation(async () => null);

      await POST(makePostRequest({ postId: "post-001", workspaceSlug: "my-workspace" }));

      expect(mockPublishToDevto).not.toHaveBeenCalled();
    });

    it("never calls the Dev.to API for unauthenticated PUT requests", async () => {
      mockGetSession.mockImplementation(async () => null);

      await PUT(makePutRequest({ postId: "post-001", workspaceSlug: "my-workspace" }));

      expect(mockUpdateDevtoArticle).not.toHaveBeenCalled();
    });

    it("never calls the Dev.to API for forbidden POST requests", async () => {
      mockFindFirstPost.mockImplementation(async () => ({
        ...mockPost,
        workspace: { ...mockPost.workspace, ownerId: "other-user" },
      }));

      await POST(
        makePostRequest({ postId: "post-001", workspaceSlug: "my-workspace" })
      );

      expect(mockPublishToDevto).not.toHaveBeenCalled();
    });

    it("never inserts publication records if Dev.to API call fails", async () => {
      mockPublishToDevto.mockImplementation(async () => {
        throw new Error("Dev.to unreachable");
      });

      await POST(makePostRequest({ postId: "post-001", workspaceSlug: "my-workspace" }));

      expect(mockDbInsert).not.toHaveBeenCalled();
    });
  });
});
