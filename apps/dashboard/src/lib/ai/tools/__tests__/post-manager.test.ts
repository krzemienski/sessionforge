/**
 * Post-manager citation extraction tests
 *
 * Tests that the post-manager correctly extracts and stores citations from markdown
 * when creating and updating posts. Uses vitest mocks for database isolation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock state tracking
// ---------------------------------------------------------------------------

let capturedPostData: any = null;
let storedPosts: Map<string, any> = new Map();
let postIdCounter = 0;

const mockFindFirstInsight = vi.fn(async () => ({
  id: "insight-001",
  workspaceId: "test-workspace-citation-extraction",
  sessionId: "session-xyz-001",
  category: "tool_discovery",
  title: "Read-Glob pipeline pattern",
  description: "Combining Read and Glob reduces API round-trips",
  codeSnippets: [],
  terminalOutput: [],
  compositeScore: 42,
  noveltyScore: 4,
  toolPatternScore: 4,
  transformationScore: 3,
  failureRecoveryScore: 3,
  reproducibilityScore: 2,
  scaleScore: 1,
  createdAt: new Date("2024-06-01T11:00:00Z"),
}));

const mockFindFirstPost = vi.fn(async (opts: any) => {
  // Return the last created post for simplicity
  const posts = Array.from(storedPosts.values());
  return posts.length > 0 ? posts[posts.length - 1] : null;
});

// insert chain: db.insert().values().returning()
const mockInsertReturning = vi.fn(async (values: any[]) => {
  capturedPostData = values[0];
  const id = capturedPostData.id || `post-${++postIdCounter}`;
  const post = { ...capturedPostData, id };
  storedPosts.set(id, post);
  return [post];
});

const mockInsertValues = vi.fn((values: any) => {
  return { returning: () => mockInsertReturning([values]) };
});

const mockDbInsert = vi.fn(() => ({ values: mockInsertValues }));

// update chain: db.update().set().where().returning()
const mockUpdateReturning = vi.fn(async () => {
  const posts = Array.from(storedPosts.values());
  const lastPost = posts[posts.length - 1];
  return [lastPost];
});

const mockUpdateWhere = vi.fn(() => ({ returning: mockUpdateReturning }));
const mockUpdateSet = vi.fn((updates: any) => {
  // Apply updates to the last stored post
  const posts = Array.from(storedPosts.values());
  if (posts.length > 0) {
    const lastPost = posts[posts.length - 1];
    const updated = { ...lastPost, ...updates };
    storedPosts.set(lastPost.id, updated);
  }
  return { where: mockUpdateWhere };
});

const mockDbUpdate = vi.fn(() => ({ set: mockUpdateSet }));

// ---------------------------------------------------------------------------
// Register module mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      insights: {
        findFirst: (...args: any[]) => mockFindFirstInsight(...args),
      },
      posts: {
        findFirst: (...args: any[]) => mockFindFirstPost(...args),
      },
    },
    insert: (...args: any[]) => mockDbInsert(...args),
    update: (...args: any[]) => mockDbUpdate(...args),
    delete: vi.fn(() => ({ where: vi.fn() })),
  },
}));

vi.mock("@sessionforge/db", () => ({
  posts: { workspaceId: "workspaceId", id: "id" },
  insights: {},
  workspaces: {},
  postRevisions: {},
  insightCategoryEnum: {
    enumValues: ["tool_discovery"],
  },
  contentTypeEnum: {
    enumValues: ["blog_post", "linkedin_post"],
  },
  postStatusEnum: {
    enumValues: ["draft"],
  },
  toneProfileEnum: {
    enumValues: ["technical"],
  },
  editTypeEnum: {
    enumValues: ["ai_generated", "manual", "auto_save"],
  },
  versionTypeEnum: {
    enumValues: ["major", "minor", "patch"],
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: any[]) => args),
  and: vi.fn((...args: any[]) => args),
  or: vi.fn(() => null),
  desc: vi.fn(() => null),
  asc: vi.fn(() => null),
  inArray: vi.fn(() => null),
}));

vi.mock("diff", () => ({
  diffLines: vi.fn(() => []),
}));

// ---------------------------------------------------------------------------
// Import modules under test (after mocks are registered)
// ---------------------------------------------------------------------------

const { createPost, updatePost } = await import(
  "@/lib/ai/tools/post-manager"
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("post-manager citation extraction", () => {
  beforeEach(() => {
    capturedPostData = null;
    storedPosts.clear();
    postIdCounter = 0;
    mockFindFirstInsight.mockClear();
    mockFindFirstPost.mockClear();
    mockInsertReturning.mockClear();
    mockInsertValues.mockClear();
    mockDbInsert.mockClear();
    mockUpdateReturning.mockClear();
    mockUpdateWhere.mockClear();
    mockUpdateSet.mockClear();
    mockDbUpdate.mockClear();
  });

  describe("createPost", () => {
    it("should extract and store citations from markdown", async () => {
      const markdown = `# Technical Deep Dive

We refactored the authentication module[@550e8400-e29b-41d4-a716-446655440000:10] to use JWT tokens instead of sessions.

The new approach[@550e8400-e29b-41d4-a716-446655440000:15] significantly improved performance.`;

      const post = await createPost({
        workspaceId: "test-workspace-citation-extraction",
        title: "Test Post with Citations",
        markdown,
        contentType: "blog_post",
      });

      expect(capturedPostData).toBeDefined();
      expect(capturedPostData.citations).toBeDefined();
      expect(capturedPostData.citations).toHaveLength(2);

      // Verify first citation
      expect(capturedPostData.citations[0].sessionId).toBe(
        "550e8400-e29b-41d4-a716-446655440000"
      );
      expect(capturedPostData.citations[0].messageIndex).toBe(10);
      expect(capturedPostData.citations[0].type).toBe("evidence");
      expect(capturedPostData.citations[0].text).toContain(
        "authentication module"
      );

      // Verify second citation
      expect(capturedPostData.citations[1].sessionId).toBe(
        "550e8400-e29b-41d4-a716-446655440000"
      );
      expect(capturedPostData.citations[1].messageIndex).toBe(15);
      expect(capturedPostData.citations[1].type).toBe("evidence");
      expect(capturedPostData.citations[1].text).toContain("new approach");
    });

    it("should handle markdown without citations", async () => {
      const markdown = `# Simple Post

This is a post without any citations.`;

      const post = await createPost({
        workspaceId: "test-workspace-citation-extraction",
        title: "Post Without Citations",
        markdown,
        contentType: "blog_post",
      });

      expect(capturedPostData).toBeDefined();
      expect(capturedPostData.citations).toBeDefined();
      expect(capturedPostData.citations).toHaveLength(0);
    });

    it("should ignore citations in code blocks", async () => {
      const markdown = `# Code Example

Here's how to use citations:

\`\`\`markdown
This is a citation[@session:5] in a code block
\`\`\`

But this one[@550e8400-e29b-41d4-a716-446655440000:20] is real.`;

      const post = await createPost({
        workspaceId: "test-workspace-citation-extraction",
        title: "Post With Code Block",
        markdown,
        contentType: "blog_post",
      });

      expect(capturedPostData).toBeDefined();
      expect(capturedPostData.citations).toBeDefined();
      expect(capturedPostData.citations).toHaveLength(1);
      expect(capturedPostData.citations[0].messageIndex).toBe(20);
    });

    it("should handle multiple citations from different sessions", async () => {
      const markdown = `# Multi-Session Post

First insight[@session1:5] from session 1.
Second insight[@session2:10] from session 2.
Third insight[@session1:15] back to session 1.`;

      const post = await createPost({
        workspaceId: "test-workspace-citation-extraction",
        title: "Multi-Session Citations",
        markdown,
        contentType: "blog_post",
      });

      expect(capturedPostData).toBeDefined();
      expect(capturedPostData.citations).toBeDefined();
      expect(capturedPostData.citations).toHaveLength(3);
      expect(capturedPostData.citations[0].sessionId).toBe("session1");
      expect(capturedPostData.citations[1].sessionId).toBe("session2");
      expect(capturedPostData.citations[2].sessionId).toBe("session1");
    });
  });
});
