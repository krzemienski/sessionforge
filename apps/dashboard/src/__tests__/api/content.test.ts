import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      workspaces: { findFirst: vi.fn() },
      posts: { findMany: vi.fn() },
    },
  },
}));

vi.mock("@sessionforge/db", () => ({
  workspaces: {},
  posts: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  desc: vi.fn(),
  and: vi.fn(),
}));

vi.mock("@/lib/ai/tools/post-manager", () => ({
  createPost: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createPost } from "@/lib/ai/tools/post-manager";
import { GET, POST } from "@/app/api/content/route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_SESSION = {
  user: { id: "user-123", name: "Test User", email: "test@example.com" },
  session: { id: "session-abc" },
};

const MOCK_WORKSPACE = {
  id: "ws-456",
  ownerId: "user-123",
  slug: "my-workspace",
};

const MOCK_POSTS = [
  {
    id: "post-1",
    workspaceId: "ws-456",
    title: "First Post",
    markdown: "# Hello World",
    contentType: "blog_post",
    status: "draft",
    createdAt: "2024-01-15T10:00:00.000Z",
  },
  {
    id: "post-2",
    workspaceId: "ws-456",
    title: "Second Post",
    markdown: "## Another post",
    contentType: "social",
    status: "published",
    createdAt: "2024-01-14T09:00:00.000Z",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGetRequest(params: Record<string, string> = {}): Request {
  const url = new URL("http://localhost/api/content");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url.toString());
}

function makePostRequest(body?: unknown): NextRequest {
  const bodyStr = body !== undefined ? JSON.stringify(body) : undefined;
  return new NextRequest("http://localhost/api/content", {
    method: "POST",
    body: bodyStr,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Tests: GET /api/content
// ---------------------------------------------------------------------------

describe("GET /api/content", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("authentication", () => {
    it("returns 401 when no session exists", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const res = await GET(makeGetRequest({ workspace: "my-workspace" }));

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: "Unauthorized" });
    });

    it("does not query the database when unauthenticated", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      await GET(makeGetRequest({ workspace: "my-workspace" }));

      expect(db.query.workspaces.findFirst).not.toHaveBeenCalled();
    });
  });

  describe("request validation", () => {
    it("returns 400 when workspace query param is missing", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(MOCK_SESSION as any);

      const res = await GET(makeGetRequest());

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: "workspace query param required" });
    });
  });

  describe("workspace lookup", () => {
    it("returns 404 when workspace does not exist", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(MOCK_SESSION as any);
      vi.mocked(db.query.workspaces.findFirst).mockResolvedValue(undefined);

      const res = await GET(makeGetRequest({ workspace: "nonexistent" }));

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toEqual({ error: "Workspace not found" });
    });

    it("returns 404 when workspace belongs to a different user", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(MOCK_SESSION as any);
      vi.mocked(db.query.workspaces.findFirst).mockResolvedValue({
        ...MOCK_WORKSPACE,
        ownerId: "other-user-999",
      } as any);

      const res = await GET(makeGetRequest({ workspace: "my-workspace" }));

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toEqual({ error: "Workspace not found" });
    });

    it("does not query posts when workspace is not found", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(MOCK_SESSION as any);
      vi.mocked(db.query.workspaces.findFirst).mockResolvedValue(undefined);

      await GET(makeGetRequest({ workspace: "nonexistent" }));

      expect(db.query.posts.findMany).not.toHaveBeenCalled();
    });
  });

  describe("successful fetch", () => {
    beforeEach(() => {
      vi.mocked(auth.api.getSession).mockResolvedValue(MOCK_SESSION as any);
      vi.mocked(db.query.workspaces.findFirst).mockResolvedValue(MOCK_WORKSPACE as any);
      vi.mocked(db.query.posts.findMany).mockResolvedValue(MOCK_POSTS as any);
    });

    it("returns 200 with posts array and pagination info", async () => {
      const res = await GET(makeGetRequest({ workspace: "my-workspace" }));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        posts: MOCK_POSTS,
        limit: 20,
        offset: 0,
      });
    });

    it("uses default limit of 20 and offset of 0", async () => {
      const res = await GET(makeGetRequest({ workspace: "my-workspace" }));
      const body = await res.json();

      expect(body.limit).toBe(20);
      expect(body.offset).toBe(0);
    });

    it("respects custom limit param", async () => {
      const res = await GET(makeGetRequest({ workspace: "my-workspace", limit: "5" }));
      const body = await res.json();

      expect(body.limit).toBe(5);
    });

    it("respects custom offset param", async () => {
      const res = await GET(makeGetRequest({ workspace: "my-workspace", offset: "10" }));
      const body = await res.json();

      expect(body.offset).toBe(10);
    });

    it("queries posts for the correct workspace", async () => {
      await GET(makeGetRequest({ workspace: "my-workspace" }));

      expect(db.query.posts.findMany).toHaveBeenCalledTimes(1);
    });

    it("filters by contentType when type param is provided", async () => {
      await GET(makeGetRequest({ workspace: "my-workspace", type: "blog_post" }));

      expect(db.query.posts.findMany).toHaveBeenCalledTimes(1);
    });

    it("filters by status when status param is provided", async () => {
      await GET(makeGetRequest({ workspace: "my-workspace", status: "draft" }));

      expect(db.query.posts.findMany).toHaveBeenCalledTimes(1);
    });

    it("returns empty posts array when no posts exist", async () => {
      vi.mocked(db.query.posts.findMany).mockResolvedValue([]);

      const res = await GET(makeGetRequest({ workspace: "my-workspace" }));
      const body = await res.json();

      expect(body.posts).toEqual([]);
    });

    it("returns posts with pagination metadata", async () => {
      const res = await GET(
        makeGetRequest({ workspace: "my-workspace", limit: "2", offset: "4" })
      );
      const body = await res.json();

      expect(body.limit).toBe(2);
      expect(body.offset).toBe(4);
      expect(Array.isArray(body.posts)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: POST /api/content
// ---------------------------------------------------------------------------

describe("POST /api/content", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("authentication", () => {
    it("returns 401 when no session exists", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const res = await POST(
        makePostRequest({
          workspaceSlug: "my-workspace",
          title: "My Post",
          markdown: "# Hello",
          contentType: "blog_post",
        })
      );

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: "Unauthorized" });
    });

    it("does not query the database when unauthenticated", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      await POST(
        makePostRequest({
          workspaceSlug: "my-workspace",
          title: "My Post",
          markdown: "# Hello",
          contentType: "blog_post",
        })
      );

      expect(db.query.workspaces.findFirst).not.toHaveBeenCalled();
    });
  });

  describe("request validation", () => {
    beforeEach(() => {
      vi.mocked(auth.api.getSession).mockResolvedValue(MOCK_SESSION as any);
    });

    it("returns 400 when workspaceSlug is missing", async () => {
      const res = await POST(
        makePostRequest({ title: "My Post", markdown: "# Hello", contentType: "blog_post" })
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({
        error: "workspaceSlug, title, markdown, and contentType are required",
      });
    });

    it("returns 400 when title is missing", async () => {
      const res = await POST(
        makePostRequest({ workspaceSlug: "my-workspace", markdown: "# Hello", contentType: "blog_post" })
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({
        error: "workspaceSlug, title, markdown, and contentType are required",
      });
    });

    it("returns 400 when markdown is missing", async () => {
      const res = await POST(
        makePostRequest({ workspaceSlug: "my-workspace", title: "My Post", contentType: "blog_post" })
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({
        error: "workspaceSlug, title, markdown, and contentType are required",
      });
    });

    it("returns 400 when contentType is missing", async () => {
      const res = await POST(
        makePostRequest({ workspaceSlug: "my-workspace", title: "My Post", markdown: "# Hello" })
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({
        error: "workspaceSlug, title, markdown, and contentType are required",
      });
    });
  });

  describe("workspace lookup", () => {
    beforeEach(() => {
      vi.mocked(auth.api.getSession).mockResolvedValue(MOCK_SESSION as any);
    });

    it("returns 404 when workspace does not exist", async () => {
      vi.mocked(db.query.workspaces.findFirst).mockResolvedValue(undefined);

      const res = await POST(
        makePostRequest({
          workspaceSlug: "nonexistent",
          title: "My Post",
          markdown: "# Hello",
          contentType: "blog_post",
        })
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toEqual({ error: "Workspace not found" });
    });

    it("returns 404 when workspace belongs to a different user", async () => {
      vi.mocked(db.query.workspaces.findFirst).mockResolvedValue({
        ...MOCK_WORKSPACE,
        ownerId: "other-user-999",
      } as any);

      const res = await POST(
        makePostRequest({
          workspaceSlug: "my-workspace",
          title: "My Post",
          markdown: "# Hello",
          contentType: "blog_post",
        })
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toEqual({ error: "Workspace not found" });
    });

    it("does not call createPost when workspace is not found", async () => {
      vi.mocked(db.query.workspaces.findFirst).mockResolvedValue(undefined);

      await POST(
        makePostRequest({
          workspaceSlug: "nonexistent",
          title: "My Post",
          markdown: "# Hello",
          contentType: "blog_post",
        })
      );

      expect(createPost).not.toHaveBeenCalled();
    });
  });

  describe("successful creation", () => {
    const CREATED_POST = {
      id: "post-new",
      workspaceId: "ws-456",
      title: "My Post",
      markdown: "# Hello",
      contentType: "blog_post",
      status: "draft",
      createdAt: new Date("2024-01-15T10:00:00Z"),
    };

    beforeEach(() => {
      vi.mocked(auth.api.getSession).mockResolvedValue(MOCK_SESSION as any);
      vi.mocked(db.query.workspaces.findFirst).mockResolvedValue(MOCK_WORKSPACE as any);
    });

    it("returns 201 with created post", async () => {
      vi.mocked(createPost).mockResolvedValue(CREATED_POST as any);

      const res = await POST(
        makePostRequest({
          workspaceSlug: "my-workspace",
          title: "My Post",
          markdown: "# Hello",
          contentType: "blog_post",
        })
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body).toMatchObject({ id: CREATED_POST.id, title: CREATED_POST.title });
    });

    it("calls createPost with correct workspaceId and post data", async () => {
      vi.mocked(createPost).mockResolvedValue(CREATED_POST as any);

      await POST(
        makePostRequest({
          workspaceSlug: "my-workspace",
          title: "My Post",
          markdown: "# Hello",
          contentType: "blog_post",
        })
      );

      expect(createPost).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: MOCK_WORKSPACE.id,
          title: "My Post",
          markdown: "# Hello",
          contentType: "blog_post",
          sourceMetadata: {
            sessionIds: [],
            insightIds: [],
            generatedBy: "manual",
          },
        })
      );
    });

    it("passes insightId and includes it in insightIds when provided", async () => {
      vi.mocked(createPost).mockResolvedValue(CREATED_POST as any);

      await POST(
        makePostRequest({
          workspaceSlug: "my-workspace",
          title: "My Post",
          markdown: "# Hello",
          contentType: "blog_post",
          insightId: "ins-99",
        })
      );

      expect(createPost).toHaveBeenCalledWith(
        expect.objectContaining({
          insightId: "ins-99",
          sourceMetadata: {
            sessionIds: [],
            insightIds: ["ins-99"],
            generatedBy: "manual",
          },
        })
      );
    });

    it("returns 500 with error message when createPost throws an Error", async () => {
      vi.mocked(createPost).mockRejectedValue(new Error("Database write failed"));

      const res = await POST(
        makePostRequest({
          workspaceSlug: "my-workspace",
          title: "My Post",
          markdown: "# Hello",
          contentType: "blog_post",
        })
      );

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ error: "Database write failed" });
    });

    it("returns 500 with fallback message when createPost throws a non-Error", async () => {
      vi.mocked(createPost).mockRejectedValue("unexpected failure");

      const res = await POST(
        makePostRequest({
          workspaceSlug: "my-workspace",
          title: "My Post",
          markdown: "# Hello",
          contentType: "blog_post",
        })
      );

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ error: "Failed to create post" });
    });
  });
});
