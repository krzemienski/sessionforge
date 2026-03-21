/**
 * Unit tests for POST /api/content/bulk-repurpose
 *
 * Verifies that the bulk repurpose endpoint:
 * - Enforces authentication
 * - Validates required request fields
 * - Enforces max 20 post IDs
 * - Rejects unknown target formats
 * - Correctly processes 3-5 posts × 2 formats (twitter_thread + linkedin_post)
 * - Returns results with correct structure: { results: PostResult[] }
 * - Each PostResult.formats array has one entry per requested format
 * - totalSuccess = N posts × M formats on full success
 * - Gracefully handles missing posts (reports error per post, continues)
 * - Enforces quota and returns 402 when exceeded
 */

import { describe, it, expect, mock, beforeAll, beforeEach } from "bun:test";

// ---------------------------------------------------------------------------
// Mutable mock state
// ---------------------------------------------------------------------------

let mockAuthSession: { user: { id: string } } | null = { user: { id: "user-bulk-1" } };

let mockWorkspaceResult:
  | { id: string; slug: string; ownerId: string }
  | undefined = {
  id: "ws-bulk-1",
  slug: "test-workspace",
  ownerId: "user-bulk-1",
};

// Posts available in the DB keyed by id
let mockPostsById: Record<
  string,
  { id: string; title: string; workspaceId: string; parentPostId?: string | null; createdAt: Date }
> = {};

// Tracks calls to runAgent
const runAgentCalls: { agentType: string; userMessage: string; systemPrompt: string }[] = [];

// Controls whether runAgent throws
let mockRunAgentError: Error | null = null;

// Created posts returned by db.query.posts.findFirst when looking up the new child
let mockCreatedPostId = "child-post-generated";

// Quota state
let mockQuotaAllowed = true;

// ---------------------------------------------------------------------------
// Module mocks (declared before dynamic import)
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

mock.module("@sessionforge/db", () => ({
  workspaces: { id: "ws_id", slug: "ws_slug", ownerId: "ws_ownerId" },
  posts: {
    id: "p_id",
    workspaceId: "p_workspaceId",
    parentPostId: "p_parentPostId",
    createdAt: "p_createdAt",
  },
}));

mock.module("drizzle-orm/sql", () => ({
  eq: (...args: unknown[]) => ({ op: "eq", args }),
  desc: (col: unknown) => ({ op: "desc", col }),
}));

const mockDb = {
  query: {
    workspaces: {
      findFirst: (_opts?: unknown) => Promise.resolve(mockWorkspaceResult),
    },
    posts: {
      findFirst: (opts?: unknown) => {
        // The route calls findFirst twice:
        //   1. eq(posts.id, postId)          → where.args[0] === "p_id"   → source post lookup
        //   2. eq(posts.parentPostId, postId) → where.args[0] === "p_parentPostId" → child lookup
        //
        // The eq mock returns { op: "eq", args: [lhs, rhs] }
        // posts.id === "p_id", posts.parentPostId === "p_parentPostId"
        const where = (opts as any)?.where;
        const lhs = where?.args?.[0]; // column placeholder
        const rhs = where?.args?.[1]; // value (the post ID)

        if (lhs === "p_id") {
          // Source post lookup — return from seeded set or undefined
          return Promise.resolve(rhs ? mockPostsById[rhs] : undefined);
        }

        // Child post lookup (eq(posts.parentPostId, postId)) — return generated child
        return Promise.resolve({
          id: mockCreatedPostId,
          title: "Generated Post",
          workspaceId: "ws-bulk-1",
          parentPostId: rhs ?? "parent-id",
          createdAt: new Date(),
        });
      },
    },
  },
};

mock.module("@/lib/db", () => ({ db: mockDb }));

mock.module("@/lib/ai/agent-runner", () => ({
  runAgent: async (opts: {
    agentType: string;
    workspaceId: string;
    systemPrompt: string;
    userMessage: string;
    mcpServer: unknown;
    trackRun: boolean;
  }) => {
    if (mockRunAgentError) throw mockRunAgentError;
    runAgentCalls.push({
      agentType: opts.agentType,
      userMessage: opts.userMessage,
      systemPrompt: opts.systemPrompt,
    });
    return { success: true };
  },
}));

mock.module("@/lib/ai/mcp-server-factory", () => ({
  createAgentMcpServer: (_type: string, _ws: string) => ({ name: "mock-mcp" }),
}));

mock.module("@/lib/billing/usage", () => ({
  checkQuota: (_userId: string, _metric: string) =>
    Promise.resolve({
      allowed: mockQuotaAllowed,
      limit: 100,
      remaining: mockQuotaAllowed ? 50 : 0,
      percentUsed: mockQuotaAllowed ? 50 : 100,
    }),
  recordUsage: (_userId: string, _wsId: string, _metric: string, _amount: number) =>
    Promise.resolve(),
}));

mock.module("next/server", () => {
  const NextResponse = {
    json(data: unknown, init?: { status?: number }) {
      const status = init?.status ?? 200;
      return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    },
  };
  return { NextResponse };
});

// Prompt module mocks (just need to exist with any string content)
mock.module("@/lib/ai/prompts/social/twitter-thread", () => ({
  TWITTER_THREAD_PROMPT: "MOCK_TWITTER_PROMPT with 5-10 tweets ≤280 chars, hook, CTA",
}));
mock.module("@/lib/ai/prompts/social/linkedin-post", () => ({
  LINKEDIN_PROMPT: "MOCK_LINKEDIN_PROMPT 1000-1500 characters professional narrative hook hashtags",
}));
mock.module("@/lib/ai/prompts/repurpose/changelog-from-post", () => ({
  CHANGELOG_FROM_POST_PROMPT: "MOCK_CHANGELOG_PROMPT",
}));
mock.module("@/lib/ai/prompts/repurpose/tldr", () => ({
  TLDR_PROMPT: "MOCK_TLDR_PROMPT",
}));
mock.module("@/lib/ai/prompts/repurpose/newsletter-section-from-post", () => ({
  NEWSLETTER_SECTION_FROM_POST_PROMPT: "MOCK_NEWSLETTER_PROMPT Key Takeaways",
}));
mock.module("@/lib/ai/prompts/repurpose/doc-page-from-post", () => ({
  DOC_PAGE_FROM_POST_PROMPT: "MOCK_DOC_PAGE_PROMPT Overview Prerequisites Usage Related",
}));

// ---------------------------------------------------------------------------
// Dynamic import after mocks
// ---------------------------------------------------------------------------

let POST: (req: Request) => Promise<Response>;

beforeAll(async () => {
  const mod = await import("../content/bulk-repurpose/route");
  POST = mod.POST;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBulkRequest(body: Record<string, unknown>): Request {
  return {
    method: "POST",
    url: "http://localhost/api/content/bulk-repurpose",
    json: () => Promise.resolve(body),
  } as unknown as Request;
}

async function callBulkRepurpose(body: Record<string, unknown>) {
  const req = makeBulkRequest(body);
  const res = await POST(req);
  const data = await res.json();
  return { status: res.status, data };
}

// Seed posts in mockPostsById for the test
function seedPosts(count: number, workspaceId = "ws-bulk-1") {
  mockPostsById = {};
  const ids: string[] = [];
  for (let i = 1; i <= count; i++) {
    const id = `post-${i}`;
    mockPostsById[id] = {
      id,
      title: `Blog Post ${i}`,
      workspaceId,
      parentPostId: null,
      createdAt: new Date(),
    };
    ids.push(id);
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockAuthSession = { user: { id: "user-bulk-1" } };
  mockWorkspaceResult = { id: "ws-bulk-1", slug: "test-workspace", ownerId: "user-bulk-1" };
  mockRunAgentError = null;
  mockQuotaAllowed = true;
  mockCreatedPostId = "child-post-generated";
  runAgentCalls.length = 0;
  mockPostsById = {};
});

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

describe("authentication", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuthSession = null;
    const { status } = await callBulkRepurpose({
      workspaceSlug: "test-workspace",
      postIds: ["post-1"],
      targetFormats: ["twitter_thread"],
    });
    expect(status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe("request validation", () => {
  it("returns 400 when workspaceSlug is missing", async () => {
    const { status, data } = await callBulkRepurpose({
      postIds: ["post-1"],
      targetFormats: ["twitter_thread"],
    });
    expect(status).toBe(400);
    expect(data.error).toBeTruthy();
  });

  it("returns 400 when postIds is missing", async () => {
    const { status } = await callBulkRepurpose({
      workspaceSlug: "test-workspace",
      targetFormats: ["twitter_thread"],
    });
    expect(status).toBe(400);
  });

  it("returns 400 when targetFormats is missing", async () => {
    const { status } = await callBulkRepurpose({
      workspaceSlug: "test-workspace",
      postIds: ["post-1"],
    });
    expect(status).toBe(400);
  });

  it("returns 400 when postIds is empty array", async () => {
    const { status } = await callBulkRepurpose({
      workspaceSlug: "test-workspace",
      postIds: [],
      targetFormats: ["twitter_thread"],
    });
    expect(status).toBe(400);
  });

  it("returns 400 when targetFormats is empty array", async () => {
    const { status } = await callBulkRepurpose({
      workspaceSlug: "test-workspace",
      postIds: ["post-1"],
      targetFormats: [],
    });
    expect(status).toBe(400);
  });

  it("returns 400 when an invalid format is provided", async () => {
    const { status, data } = await callBulkRepurpose({
      workspaceSlug: "test-workspace",
      postIds: ["post-1"],
      targetFormats: ["invalid_format"],
    });
    expect(status).toBe(400);
    expect(data.error).toContain("Invalid format");
  });
});

// ---------------------------------------------------------------------------
// Max posts enforcement
// ---------------------------------------------------------------------------

describe("max 20 posts enforcement", () => {
  it("returns 400 when more than 20 postIds are provided", async () => {
    const twentyOneIds = Array.from({ length: 21 }, (_, i) => `post-${i + 1}`);
    const { status, data } = await callBulkRepurpose({
      workspaceSlug: "test-workspace",
      postIds: twentyOneIds,
      targetFormats: ["twitter_thread"],
    });
    expect(status).toBe(400);
    expect(data.error).toContain("20");
  });

  it("accepts exactly 20 postIds", async () => {
    const twentyIds = seedPosts(20);
    const { status } = await callBulkRepurpose({
      workspaceSlug: "test-workspace",
      postIds: twentyIds,
      targetFormats: ["twitter_thread"],
    });
    // Should not return 400 for count validation (may fail for other reasons in test env)
    expect(status).not.toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Workspace ownership
// ---------------------------------------------------------------------------

describe("workspace authorization", () => {
  it("returns 404 when workspace does not exist", async () => {
    mockWorkspaceResult = undefined;
    const { status } = await callBulkRepurpose({
      workspaceSlug: "nonexistent",
      postIds: ["post-1"],
      targetFormats: ["twitter_thread"],
    });
    expect(status).toBe(404);
  });

  it("returns 404 when workspace belongs to a different user", async () => {
    mockWorkspaceResult = { id: "ws-other", slug: "other-ws", ownerId: "other-user" };
    const { status } = await callBulkRepurpose({
      workspaceSlug: "other-ws",
      postIds: ["post-1"],
      targetFormats: ["twitter_thread"],
    });
    expect(status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Quota enforcement
// ---------------------------------------------------------------------------

describe("quota enforcement", () => {
  it("returns 402 when quota is exceeded", async () => {
    mockQuotaAllowed = false;
    const { status, data } = await callBulkRepurpose({
      workspaceSlug: "test-workspace",
      postIds: ["post-1"],
      targetFormats: ["twitter_thread"],
    });
    expect(status).toBe(402);
    expect(data.error).toContain("quota");
  });
});

// ---------------------------------------------------------------------------
// Core bulk repurpose: 3-5 posts × twitter_thread + linkedin_post
// ---------------------------------------------------------------------------

describe("bulk repurpose 3-5 posts with twitter_thread + linkedin_post", () => {
  it("processes 3 posts × 2 formats, returning 3 PostResult entries", async () => {
    const postIds = seedPosts(3);
    const { status, data } = await callBulkRepurpose({
      workspaceSlug: "test-workspace",
      postIds,
      targetFormats: ["twitter_thread", "linkedin_post"],
    });
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.results).toHaveLength(3);
  });

  it("each PostResult has 2 format entries (one per format)", async () => {
    const postIds = seedPosts(3);
    const { data } = await callBulkRepurpose({
      workspaceSlug: "test-workspace",
      postIds,
      targetFormats: ["twitter_thread", "linkedin_post"],
    });
    for (const result of data.results) {
      expect(result.formats).toHaveLength(2);
    }
  });

  it("each format result has success=true when agent succeeds", async () => {
    const postIds = seedPosts(3);
    const { data } = await callBulkRepurpose({
      workspaceSlug: "test-workspace",
      postIds,
      targetFormats: ["twitter_thread", "linkedin_post"],
    });
    for (const result of data.results) {
      for (const fmt of result.formats) {
        expect(fmt.success).toBe(true);
      }
    }
  });

  it("totalSuccess = 3 posts × 2 formats = 6 on full success", async () => {
    const postIds = seedPosts(3);
    const { data } = await callBulkRepurpose({
      workspaceSlug: "test-workspace",
      postIds,
      targetFormats: ["twitter_thread", "linkedin_post"],
    });
    const totalSuccess = data.results.reduce(
      (acc: number, r: { formats: { success: boolean }[] }) =>
        acc + r.formats.filter((f) => f.success).length,
      0
    );
    expect(totalSuccess).toBe(6);
  });

  it("runs runAgent 3 × 2 = 6 times", async () => {
    const postIds = seedPosts(3);
    await callBulkRepurpose({
      workspaceSlug: "test-workspace",
      postIds,
      targetFormats: ["twitter_thread", "linkedin_post"],
    });
    expect(runAgentCalls.length).toBe(6);
  });

  it("processes 5 posts × 2 formats, totalSuccess = 10", async () => {
    const postIds = seedPosts(5);
    const { data } = await callBulkRepurpose({
      workspaceSlug: "test-workspace",
      postIds,
      targetFormats: ["twitter_thread", "linkedin_post"],
    });
    expect(data.results).toHaveLength(5);
    const totalSuccess = data.results.reduce(
      (acc: number, r: { formats: { success: boolean }[] }) =>
        acc + r.formats.filter((f) => f.success).length,
      0
    );
    expect(totalSuccess).toBe(10);
  });

  it("format results include both twitter_thread and linkedin_post format names", async () => {
    const postIds = seedPosts(3);
    const { data } = await callBulkRepurpose({
      workspaceSlug: "test-workspace",
      postIds,
      targetFormats: ["twitter_thread", "linkedin_post"],
    });
    const formatsInFirstResult = data.results[0].formats.map(
      (f: { format: string }) => f.format
    );
    expect(formatsInFirstResult).toContain("twitter_thread");
    expect(formatsInFirstResult).toContain("linkedin_post");
  });

  it("each format result includes a postId for the generated content", async () => {
    const postIds = seedPosts(3);
    const { data } = await callBulkRepurpose({
      workspaceSlug: "test-workspace",
      postIds,
      targetFormats: ["twitter_thread", "linkedin_post"],
    });
    for (const result of data.results) {
      for (const fmt of result.formats) {
        expect(fmt.postId).toBeTruthy();
      }
    }
  });

  it("PostResult.postId matches the source post ID", async () => {
    const postIds = seedPosts(3);
    const { data } = await callBulkRepurpose({
      workspaceSlug: "test-workspace",
      postIds,
      targetFormats: ["twitter_thread", "linkedin_post"],
    });
    const returnedPostIds = data.results.map((r: { postId: string }) => r.postId);
    for (const id of postIds) {
      expect(returnedPostIds).toContain(id);
    }
  });

  it("user messages include parentPostId for each post", async () => {
    const postIds = seedPosts(3);
    await callBulkRepurpose({
      workspaceSlug: "test-workspace",
      postIds,
      targetFormats: ["twitter_thread", "linkedin_post"],
    });
    for (const call of runAgentCalls) {
      expect(call.userMessage).toContain("parentPostId");
    }
  });

  it("user messages include generatedBy: repurpose_writer", async () => {
    const postIds = seedPosts(3);
    await callBulkRepurpose({
      workspaceSlug: "test-workspace",
      postIds,
      targetFormats: ["twitter_thread", "linkedin_post"],
    });
    for (const call of runAgentCalls) {
      expect(call.userMessage).toContain("repurpose_writer");
    }
  });
});

// ---------------------------------------------------------------------------
// Missing post handling
// ---------------------------------------------------------------------------

describe("missing post handling", () => {
  it("reports error for missing post but continues processing remaining posts", async () => {
    const validPostId = "post-valid-1";
    mockPostsById[validPostId] = {
      id: validPostId,
      title: "Valid Post",
      workspaceId: "ws-bulk-1",
      parentPostId: null,
      createdAt: new Date(),
    };

    const { status, data } = await callBulkRepurpose({
      workspaceSlug: "test-workspace",
      postIds: ["nonexistent-post", validPostId],
      targetFormats: ["twitter_thread"],
    });

    expect(status).toBe(200);
    // Should have 2 results: one error, one success
    expect(data.results).toHaveLength(2);

    const errorResult = data.results.find(
      (r: { postId: string }) => r.postId === "nonexistent-post"
    );
    expect(errorResult).toBeTruthy();
    expect(errorResult.formats[0].success).toBe(false);
    expect(errorResult.formats[0].error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Agent failure handling
// ---------------------------------------------------------------------------

describe("agent failure handling", () => {
  it("marks format as failed when runAgent throws, but continues other posts", async () => {
    const postIds = seedPosts(2);
    mockRunAgentError = new Error("Agent quota exceeded");

    const { status, data } = await callBulkRepurpose({
      workspaceSlug: "test-workspace",
      postIds,
      targetFormats: ["twitter_thread"],
    });

    expect(status).toBe(200);
    // Both posts processed
    expect(data.results).toHaveLength(2);
    // Each format result should have success=false with the error message
    for (const result of data.results) {
      expect(result.formats[0].success).toBe(false);
      expect(result.formats[0].error).toContain("Agent quota exceeded");
    }
  });
});

// ---------------------------------------------------------------------------
// Response structure
// ---------------------------------------------------------------------------

describe("response structure", () => {
  it("returns { success: true, results: [...] } on success", async () => {
    const postIds = seedPosts(1);
    const { status, data } = await callBulkRepurpose({
      workspaceSlug: "test-workspace",
      postIds,
      targetFormats: ["twitter_thread"],
    });
    expect(status).toBe(200);
    expect(data).toHaveProperty("success", true);
    expect(data).toHaveProperty("results");
    expect(Array.isArray(data.results)).toBe(true);
  });

  it("each PostResult has postId and formats array", async () => {
    const postIds = seedPosts(1);
    const { data } = await callBulkRepurpose({
      workspaceSlug: "test-workspace",
      postIds,
      targetFormats: ["twitter_thread"],
    });
    const result = data.results[0];
    expect(result).toHaveProperty("postId");
    expect(result).toHaveProperty("formats");
    expect(Array.isArray(result.formats)).toBe(true);
  });

  it("each format entry has { format, success } at minimum", async () => {
    const postIds = seedPosts(1);
    const { data } = await callBulkRepurpose({
      workspaceSlug: "test-workspace",
      postIds,
      targetFormats: ["twitter_thread"],
    });
    const fmt = data.results[0].formats[0];
    expect(fmt).toHaveProperty("format");
    expect(fmt).toHaveProperty("success");
  });
});

// ---------------------------------------------------------------------------
// Summary count verification (N posts × M formats)
// ---------------------------------------------------------------------------

describe("summary count correctness", () => {
  const scenarios: [number, number][] = [
    [3, 2],
    [4, 2],
    [5, 2],
    [3, 1],
    [5, 4],
  ];

  const allFormats = [
    "twitter_thread",
    "linkedin_post",
    "changelog",
    "tldr",
  ] as const;

  for (const [numPosts, numFormats] of scenarios) {
    it(`${numPosts} posts × ${numFormats} formats = ${numPosts * numFormats} total successes`, async () => {
      const postIds = seedPosts(numPosts);
      const formats = allFormats.slice(0, numFormats);

      const { data } = await callBulkRepurpose({
        workspaceSlug: "test-workspace",
        postIds,
        targetFormats: formats,
      });

      const totalSuccess = data.results.reduce(
        (acc: number, r: { formats: { success: boolean }[] }) =>
          acc + r.formats.filter((f) => f.success).length,
        0
      );
      expect(totalSuccess).toBe(numPosts * numFormats);
    });
  }
});
