/**
 * Integration tests for citation extraction and storage in the content generation pipeline.
 *
 * Verifies that:
 *   1. Citations are extracted from markdown content when posts are created
 *   2. Citation metadata is properly persisted to the database
 *   3. The post-manager tool correctly integrates with the citation extractor
 *
 * Unlike unit tests, these tests exercise the real post-manager tool functions
 * integrated with database mocks to verify end-to-end citation flow.
 */

import { describe, it, expect, mock, beforeEach } from "bun:test";

// ---------------------------------------------------------------------------
// Mock database state
// ---------------------------------------------------------------------------

const mockInsightData = {
  id: "insight-001",
  workspaceId: "ws-content",
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
};

let capturedPostData: any = null;

// Mock database functions
const mockFindFirstInsight = mock(async () => mockInsightData);

// insert chain: db.insert().values().returning()
const mockInsertReturning = mock(async (values: any[]) => {
  // Capture the inserted data for assertions
  capturedPostData = values[0];
  return [capturedPostData];
});

const mockInsertValues = mock((values: any) => {
  return { returning: () => mockInsertReturning([values]) };
});

const mockDbInsert = mock(() => ({ values: mockInsertValues }));

// ---------------------------------------------------------------------------
// Register module mocks BEFORE any imports
// ---------------------------------------------------------------------------

mock.module("@/lib/db", () => ({
  db: {
    query: {
      insights: {
        findFirst: mockFindFirstInsight,
      },
    },
    insert: mockDbInsert,
  },
}));

mock.module("@sessionforge/db", () => ({
  posts: {},
  insights: {},
  insightCategoryEnum: {
    enumValues: ["tool_discovery"],
  },
  contentTypeEnum: {
    enumValues: ["blog_post"],
  },
  postStatusEnum: {
    enumValues: ["draft"],
  },
  toneProfileEnum: {
    enumValues: ["technical"],
  },
}));

mock.module("drizzle-orm", () => ({
  eq: mock(() => null),
  and: mock(() => null),
  or: mock(() => null),
  desc: mock(() => null),
  asc: mock(() => null),
}));

// ---------------------------------------------------------------------------
// Import modules under test (after mocks are registered)
// ---------------------------------------------------------------------------

const { createPost } = await import("../../src/lib/ai/tools/post-manager");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Citations Generation Integration", () => {
  beforeEach(() => {
    // Reset captured data and mock call counts
    capturedPostData = null;
    mockFindFirstInsight.mockClear();
    mockInsertReturning.mockClear();
    mockInsertValues.mockClear();
    mockDbInsert.mockClear();
  });

  it("should extract and store citations when creating a post", async () => {
    const result = await createPost({
      workspaceId: "ws-content",
      title: "The Read-Glob Pipeline Pattern",
      markdown:
        "# The Read-Glob Pipeline Pattern\n\nWe discovered an efficient pattern[@session-xyz-001:3] for file operations. This approach[@session-xyz-001:5] significantly improved performance.",
      contentType: "blog_post",
      insightId: "insight-001",
    });

    // Verify post was created successfully
    expect(result).toBeDefined();

    // Verify database insert was called
    expect(mockDbInsert).toHaveBeenCalled();

    // Verify citations were extracted and stored
    expect(capturedPostData).toBeDefined();
    expect(capturedPostData.citations).toBeDefined();
    expect(Array.isArray(capturedPostData.citations)).toBe(true);
    expect(capturedPostData.citations.length).toBe(2);

    // Verify first citation structure
    const citation1 = capturedPostData.citations[0];
    expect(citation1).toHaveProperty("sessionId");
    expect(citation1).toHaveProperty("messageIndex");
    expect(citation1).toHaveProperty("text");
    expect(citation1).toHaveProperty("type");
    expect(citation1.sessionId).toBe("session-xyz-001");
    expect(citation1.messageIndex).toBe(3);
    expect(citation1.type).toBe("evidence");
    expect(citation1.text).toContain("efficient pattern");

    // Verify second citation
    const citation2 = capturedPostData.citations[1];
    expect(citation2.sessionId).toBe("session-xyz-001");
    expect(citation2.messageIndex).toBe(5);
    expect(citation2.type).toBe("evidence");
    expect(citation2.text).toContain("approach");
  });

  it("should handle posts without citations gracefully", async () => {
    const result = await createPost({
      workspaceId: "ws-content",
      title: "Simple Post",
      markdown: "# Simple Post\n\nThis is a post without any citations.",
      contentType: "blog_post",
      insightId: "insight-001",
    });

    expect(result).toBeDefined();
    expect(capturedPostData.citations).toBeDefined();
    expect(capturedPostData.citations.length).toBe(0);
  });

  it("should extract citations from different sessions", async () => {
    const result = await createPost({
      workspaceId: "ws-content",
      title: "Multi-Session Post",
      markdown:
        "First insight[@session1:5] from session 1. Second insight[@session2:10] from session 2.",
      contentType: "blog_post",
      insightId: "insight-001",
    });

    expect(result).toBeDefined();
    expect(capturedPostData.citations.length).toBe(2);
    expect(capturedPostData.citations[0].sessionId).toBe("session1");
    expect(capturedPostData.citations[0].messageIndex).toBe(5);
    expect(capturedPostData.citations[1].sessionId).toBe("session2");
    expect(capturedPostData.citations[1].messageIndex).toBe(10);
  });

  it("should ignore citations in code blocks", async () => {
    const result = await createPost({
      workspaceId: "ws-content",
      title: "Code Example",
      markdown:
        "# Code Example\n\n```markdown\nThis is a citation[@session:5] in a code block\n```\n\nBut this one[@session-xyz-001:20] is real.",
      contentType: "blog_post",
      insightId: "insight-001",
    });

    expect(result).toBeDefined();
    expect(capturedPostData.citations.length).toBe(1);
    expect(capturedPostData.citations[0].messageIndex).toBe(20);
  });

  it("should preserve citation context text", async () => {
    const result = await createPost({
      workspaceId: "ws-content",
      title: "Context Test",
      markdown:
        "We implemented user authentication[@session1:10] using bcrypt for password hashing.",
      contentType: "blog_post",
      insightId: "insight-001",
    });

    expect(result).toBeDefined();
    expect(capturedPostData.citations.length).toBe(1);
    const citation = capturedPostData.citations[0];
    expect(citation.text).toContain("user authentication");
    expect(citation.text).toContain("bcrypt");
  });

  it("should work with different content types", async () => {
    const result = await createPost({
      workspaceId: "ws-content",
      title: "LinkedIn Tip",
      markdown:
        "Quick tip: Combine Read and Glob[@session-xyz-001:5] for faster file ops!",
      contentType: "linkedin_post",
      insightId: "insight-001",
    });

    expect(result).toBeDefined();
    expect(capturedPostData.citations.length).toBe(1);
    expect(capturedPostData.citations[0].sessionId).toBe("session-xyz-001");
    expect(capturedPostData.citations[0].messageIndex).toBe(5);
    expect(capturedPostData.contentType).toBe("linkedin_post");
  });
});
