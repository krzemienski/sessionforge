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
      insights: { findMany: vi.fn() },
    },
  },
}));

vi.mock("@sessionforge/db", () => ({
  workspaces: {},
  insights: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  desc: vi.fn(),
  and: vi.fn(),
  gte: vi.fn(),
}));

vi.mock("@/lib/ai/agents/insight-extractor", () => ({
  extractInsight: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { extractInsight } from "@/lib/ai/agents/insight-extractor";
import { GET } from "@/app/api/insights/route";
import { POST } from "@/app/api/insights/extract/route";

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

const MOCK_INSIGHTS = [
  {
    id: "ins-1",
    workspaceId: "ws-456",
    compositeScore: 0.9,
    content: "High value insight",
  },
  {
    id: "ins-2",
    workspaceId: "ws-456",
    compositeScore: 0.7,
    content: "Medium value insight",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGetRequest(params: Record<string, string> = {}): Request {
  const url = new URL("http://localhost/api/insights");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url.toString());
}

function makePostRequest(body?: unknown): NextRequest {
  const bodyStr = body !== undefined ? JSON.stringify(body) : undefined;
  return new NextRequest("http://localhost/api/insights/extract", {
    method: "POST",
    body: bodyStr,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Tests: GET /api/insights
// ---------------------------------------------------------------------------

describe("GET /api/insights", () => {
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

    it("does not query insights when workspace is not found", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(MOCK_SESSION as any);
      vi.mocked(db.query.workspaces.findFirst).mockResolvedValue(undefined);

      await GET(makeGetRequest({ workspace: "nonexistent" }));

      expect(db.query.insights.findMany).not.toHaveBeenCalled();
    });
  });

  describe("successful fetch", () => {
    beforeEach(() => {
      vi.mocked(auth.api.getSession).mockResolvedValue(MOCK_SESSION as any);
      vi.mocked(db.query.workspaces.findFirst).mockResolvedValue(MOCK_WORKSPACE as any);
      vi.mocked(db.query.insights.findMany).mockResolvedValue(MOCK_INSIGHTS as any);
    });

    it("returns 200 with insights array and pagination info", async () => {
      const res = await GET(makeGetRequest({ workspace: "my-workspace" }));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        insights: MOCK_INSIGHTS,
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

    it("queries insights for the correct workspace", async () => {
      await GET(makeGetRequest({ workspace: "my-workspace" }));

      expect(db.query.insights.findMany).toHaveBeenCalledTimes(1);
    });

    it("queries insights with score filter when minScore is greater than 0", async () => {
      await GET(makeGetRequest({ workspace: "my-workspace", minScore: "0.5" }));

      expect(db.query.insights.findMany).toHaveBeenCalledTimes(1);
    });

    it("returns empty insights array when no insights exist", async () => {
      vi.mocked(db.query.insights.findMany).mockResolvedValue([]);

      const res = await GET(makeGetRequest({ workspace: "my-workspace" }));
      const body = await res.json();

      expect(body.insights).toEqual([]);
    });

    it("returns insights sorted with pagination metadata", async () => {
      const res = await GET(
        makeGetRequest({ workspace: "my-workspace", limit: "2", offset: "4" })
      );
      const body = await res.json();

      expect(body.limit).toBe(2);
      expect(body.offset).toBe(4);
      expect(Array.isArray(body.insights)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: POST /api/insights/extract
// ---------------------------------------------------------------------------

describe("POST /api/insights/extract", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("authentication", () => {
    it("returns 401 when no session exists", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const res = await POST(
        makePostRequest({ sessionId: "sess-1", workspaceSlug: "my-workspace" })
      );

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: "Unauthorized" });
    });

    it("does not query the database when unauthenticated", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      await POST(makePostRequest({ sessionId: "sess-1", workspaceSlug: "my-workspace" }));

      expect(db.query.workspaces.findFirst).not.toHaveBeenCalled();
    });
  });

  describe("request validation", () => {
    it("returns 400 when sessionId is missing", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(MOCK_SESSION as any);

      const res = await POST(makePostRequest({ workspaceSlug: "my-workspace" }));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: "sessionId and workspaceSlug are required" });
    });

    it("returns 400 when workspaceSlug is missing", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(MOCK_SESSION as any);

      const res = await POST(makePostRequest({ sessionId: "sess-1" }));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: "sessionId and workspaceSlug are required" });
    });

    it("returns 400 when both sessionId and workspaceSlug are missing", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(MOCK_SESSION as any);

      const res = await POST(makePostRequest({}));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: "sessionId and workspaceSlug are required" });
    });
  });

  describe("workspace lookup", () => {
    it("returns 404 when workspace does not exist", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(MOCK_SESSION as any);
      vi.mocked(db.query.workspaces.findFirst).mockResolvedValue(undefined);

      const res = await POST(
        makePostRequest({ sessionId: "sess-1", workspaceSlug: "nonexistent" })
      );

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

      const res = await POST(
        makePostRequest({ sessionId: "sess-1", workspaceSlug: "my-workspace" })
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toEqual({ error: "Workspace not found" });
    });

    it("does not call extractInsight when workspace is not found", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(MOCK_SESSION as any);
      vi.mocked(db.query.workspaces.findFirst).mockResolvedValue(undefined);

      await POST(makePostRequest({ sessionId: "sess-1", workspaceSlug: "nonexistent" }));

      expect(extractInsight).not.toHaveBeenCalled();
    });
  });

  describe("successful extraction", () => {
    beforeEach(() => {
      vi.mocked(auth.api.getSession).mockResolvedValue(MOCK_SESSION as any);
      vi.mocked(db.query.workspaces.findFirst).mockResolvedValue(MOCK_WORKSPACE as any);
    });

    it("returns 200 with extraction result", async () => {
      const extractionResult = { id: "ins-new", compositeScore: 0.85, content: "New insight" };
      vi.mocked(extractInsight).mockResolvedValue(extractionResult as any);

      const res = await POST(
        makePostRequest({ sessionId: "sess-1", workspaceSlug: "my-workspace" })
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual(extractionResult);
    });

    it("calls extractInsight with workspaceId and sessionId", async () => {
      vi.mocked(extractInsight).mockResolvedValue({} as any);

      await POST(makePostRequest({ sessionId: "sess-1", workspaceSlug: "my-workspace" }));

      expect(extractInsight).toHaveBeenCalledWith({
        workspaceId: MOCK_WORKSPACE.id,
        sessionId: "sess-1",
      });
    });

    it("returns 500 with error message when extraction throws an Error", async () => {
      vi.mocked(extractInsight).mockRejectedValue(new Error("AI service unavailable"));

      const res = await POST(
        makePostRequest({ sessionId: "sess-1", workspaceSlug: "my-workspace" })
      );

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ error: "AI service unavailable" });
    });

    it("returns 500 with fallback message when extraction throws a non-Error", async () => {
      vi.mocked(extractInsight).mockRejectedValue("unexpected failure");

      const res = await POST(
        makePostRequest({ sessionId: "sess-1", workspaceSlug: "my-workspace" })
      );

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ error: "Extraction failed" });
    });
  });
});
