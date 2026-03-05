/**
 * Unit tests for the automation pipeline.
 *
 * Uses dynamic imports so that mock.module() calls are registered before the
 * module under test (and its dependencies) are loaded.
 */

import { describe, it, expect, mock, beforeAll, beforeEach } from "bun:test";

// ---------------------------------------------------------------------------
// Mock factory functions (stable references, reassigned per test)
// ---------------------------------------------------------------------------

const mockCreate = mock(async () => ({}));
const mockGetModelForAgent = mock(() => "claude-opus-4-6");
const mockGetToolsForAgent = mock(() => [] as unknown[]);
const mockHandleSessionReaderTool = mock(async () => ({ data: "session-data" }));
const mockHandleInsightTool = mock(async () => ({ id: "insight-123" }));
const mockHandlePostManagerTool = mock(async () => ({ postId: "post-456" }));
const mockHandleSkillLoaderTool = mock(async () => ({ skills: [] }));
const mockScanSessionFiles = mock(async () => [] as unknown[]);
const mockParseSessionFile = mock(async () => ({ messages: [] }));
const mockNormalizeSession = mock(() => ({}));
const mockIndexSessions = mock(async () => ({ scanned: 0, indexed: 0, new: 0, updated: 0, errors: [] }));

// ---------------------------------------------------------------------------
// Shared db mock state
// ---------------------------------------------------------------------------

let mockWorkspace: Record<string, unknown> | null = null;
let mockInsights: { id: string }[] = [];
let mockDbThrow = false;

const mockDb = {
  query: {
    workspaces: {
      findFirst: mock(async () => {
        if (mockDbThrow) throw new Error("DB error");
        return mockWorkspace;
      }),
    },
    insights: {
      findMany: mock(async () => {
        if (mockDbThrow) throw new Error("DB error");
        return mockInsights;
      }),
    },
  },
};

// ---------------------------------------------------------------------------
// Register module mocks BEFORE any dynamic import of the module under test
// ---------------------------------------------------------------------------

mock.module("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

mock.module("@/lib/db", () => ({ db: mockDb }));

mock.module("@sessionforge/db", () => ({
  workspaces: { id: "workspaces.id" },
  insights: {
    workspaceId: "insights.workspaceId",
    usedInContent: "insights.usedInContent",
    compositeScore: "insights.compositeScore",
  },
  contentTypeEnum: {
    enumValues: [
      "blog_post",
      "twitter_thread",
      "linkedin_post",
      "devto_post",
      "changelog",
      "newsletter",
    ] as const,
  },
  lookbackWindowEnum: {
    enumValues: [
      "current_day",
      "yesterday",
      "last_7_days",
      "last_14_days",
      "last_30_days",
      "custom",
    ] as const,
  },
}));

mock.module("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ col, val, op: "eq" }),
  desc: (col: unknown) => ({ col, dir: "desc" }),
  and: (...args: unknown[]) => ({ args, op: "and" }),
}));

mock.module("@/lib/ai/orchestration/model-selector", () => ({
  getModelForAgent: mockGetModelForAgent,
}));

mock.module("@/lib/ai/orchestration/tool-registry", () => ({
  getToolsForAgent: mockGetToolsForAgent,
}));

mock.module("@/lib/ai/tools/session-reader", () => ({
  handleSessionReaderTool: mockHandleSessionReaderTool,
}));

mock.module("@/lib/ai/tools/insight-tools", () => ({
  handleInsightTool: mockHandleInsightTool,
}));

mock.module("@/lib/ai/tools/post-manager", () => ({
  handlePostManagerTool: mockHandlePostManagerTool,
}));

mock.module("@/lib/ai/tools/skill-loader", () => ({
  handleSkillLoaderTool: mockHandleSkillLoaderTool,
}));

mock.module("@/lib/sessions/scanner", () => ({
  scanSessionFiles: mockScanSessionFiles,
}));

mock.module("@/lib/sessions/parser", () => ({
  parseSessionFile: mockParseSessionFile,
}));

mock.module("@/lib/sessions/normalizer", () => ({
  normalizeSession: mockNormalizeSession,
}));

mock.module("@/lib/sessions/indexer", () => ({
  indexSessions: mockIndexSessions,
}));

mock.module("@/lib/ai/prompts/blog/technical", () => ({
  BLOG_TECHNICAL_PROMPT: "You are a technical blog writer.",
}));

mock.module("@/lib/ai/prompts/blog/tutorial", () => ({
  BLOG_TUTORIAL_PROMPT: "You are a tutorial blog writer.",
}));

mock.module("@/lib/ai/prompts/blog/conversational", () => ({
  BLOG_CONVERSATIONAL_PROMPT: "You are a conversational blog writer.",
}));

mock.module("@/lib/ai/prompts/social/twitter-thread", () => ({
  TWITTER_THREAD_PROMPT: "You are a twitter thread writer.",
}));

mock.module("@/lib/ai/prompts/social/linkedin-post", () => ({
  LINKEDIN_PROMPT: "You are a linkedin writer.",
}));

mock.module("@/lib/ai/prompts/changelog", () => ({
  CHANGELOG_PROMPT: "You are a changelog writer.",
}));

mock.module("@/lib/ai/prompts/newsletter", () => ({
  NEWSLETTER_PROMPT: "You are a newsletter writer.",
}));

// ---------------------------------------------------------------------------
// Dynamic import of module under test
// ---------------------------------------------------------------------------

let runAutomationPipeline: (input: {
  workspaceId: string;
  contentType: string;
  lookbackWindow: string;
  triggerId: string;
}) => Promise<{ postsGenerated: number; sessionsScanned: number; errors: string[] }>;

beforeAll(async () => {
  const mod = await import("../pipeline");
  runAutomationPipeline = mod.runAutomationPipeline as typeof runAutomationPipeline;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTextResponse(
  text: string,
  usage = { input_tokens: 10, output_tokens: 20 }
) {
  return {
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    usage,
  };
}

function makeToolUseResponse(
  tools: Array<{ id: string; name: string; input: Record<string, unknown> }>,
  usage = { input_tokens: 15, output_tokens: 30 }
) {
  return {
    content: tools.map((t) => ({
      type: "tool_use",
      id: t.id,
      name: t.name,
      input: t.input,
    })),
    stop_reason: "tool_use",
    usage,
  };
}

const DEFAULT_WORKSPACE = {
  id: "ws-001",
  sessionBasePath: "/home/user/.claude",
};

function makeInput(overrides: Partial<{
  workspaceId: string;
  contentType: string;
  lookbackWindow: string;
  triggerId: string;
}> = {}) {
  return {
    workspaceId: "ws-001",
    contentType: "changelog",
    lookbackWindow: "last_7_days",
    triggerId: "trigger-001",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runAutomationPipeline", () => {
  beforeEach(() => {
    // Reset state variables first so implementations read fresh values
    mockWorkspace = { ...DEFAULT_WORKSPACE };
    mockInsights = [];
    mockDbThrow = false;

    // mockReset() clears call history AND the mockImplementationOnce queue.
    // We then re-set the default implementation immediately after.
    mockCreate.mockReset();
    mockGetModelForAgent.mockReset();
    mockGetToolsForAgent.mockReset();
    mockHandleSessionReaderTool.mockReset();
    mockHandleInsightTool.mockReset();
    mockHandlePostManagerTool.mockReset();
    mockHandleSkillLoaderTool.mockReset();
    mockScanSessionFiles.mockReset();
    mockParseSessionFile.mockReset();
    mockNormalizeSession.mockReset();
    mockIndexSessions.mockReset();

    // Re-set default implementations after reset
    mockCreate.mockImplementation(async () => makeTextResponse("Done."));
    mockGetModelForAgent.mockImplementation(() => "claude-opus-4-6");
    mockGetToolsForAgent.mockImplementation(() => []);
    mockHandleSessionReaderTool.mockImplementation(async () => ({ data: "session-data" }));
    mockHandleInsightTool.mockImplementation(async () => ({ id: "insight-123" }));
    mockHandlePostManagerTool.mockImplementation(async () => ({ postId: "post-456" }));
    mockHandleSkillLoaderTool.mockImplementation(async () => ({ skills: [] }));
    mockScanSessionFiles.mockImplementation(async () => []);
    mockParseSessionFile.mockImplementation(async () => ({ messages: [] }));
    mockNormalizeSession.mockImplementation(() => ({}));
    mockIndexSessions.mockImplementation(async () => ({
      scanned: 0,
      indexed: 0,
      new: 0,
      updated: 0,
      errors: [],
    }));

    // Reset db mock implementations (re-establish closures over state variables)
    mockDb.query.workspaces.findFirst.mockReset();
    mockDb.query.workspaces.findFirst.mockImplementation(async () => {
      if (mockDbThrow) throw new Error("DB error");
      return mockWorkspace;
    });

    mockDb.query.insights.findMany.mockReset();
    mockDb.query.insights.findMany.mockImplementation(async () => {
      if (mockDbThrow) throw new Error("DB error");
      return mockInsights;
    });
  });

  // -------------------------------------------------------------------------
  // Workspace lookup
  // -------------------------------------------------------------------------

  describe("workspace validation", () => {
    it("throws when workspace is not found", async () => {
      mockWorkspace = null;

      await expect(runAutomationPipeline(makeInput())).rejects.toThrow(
        "Workspace ws-001 not found"
      );
    });

    it("throws with the correct workspaceId in the error message", async () => {
      mockWorkspace = null;

      await expect(
        runAutomationPipeline(makeInput({ workspaceId: "missing-ws-999" }))
      ).rejects.toThrow("missing-ws-999");
    });

    it("proceeds normally when workspace exists", async () => {
      mockWorkspace = DEFAULT_WORKSPACE;

      const result = await runAutomationPipeline(makeInput());
      expect(result).toHaveProperty("postsGenerated");
    });

    it("uses ~/.claude as basePath when sessionBasePath is null", async () => {
      mockWorkspace = { id: "ws-001", sessionBasePath: null };
      mockScanSessionFiles.mockImplementation(async (days: unknown, path: unknown) => {
        expect(path).toBe("~/.claude");
        return [];
      });

      await runAutomationPipeline(makeInput());

      expect(mockScanSessionFiles).toHaveBeenCalledWith(
        expect.any(Number),
        "~/.claude"
      );
    });

    it("uses workspace.sessionBasePath when provided", async () => {
      mockWorkspace = { id: "ws-001", sessionBasePath: "/custom/path" };

      await runAutomationPipeline(makeInput());

      expect(mockScanSessionFiles).toHaveBeenCalledWith(
        expect.any(Number),
        "/custom/path"
      );
    });
  });

  // -------------------------------------------------------------------------
  // Session scanning
  // -------------------------------------------------------------------------

  describe("session scanning", () => {
    it("returns sessionsScanned equal to the indexSessions scanned count", async () => {
      mockScanSessionFiles.mockImplementation(async () => [
        { filePath: "/path/to/session1.jsonl" },
      ]);
      mockParseSessionFile.mockImplementation(async () => ({ messages: [] }));
      mockNormalizeSession.mockImplementation(() => ({}));
      mockIndexSessions.mockImplementation(async () => ({
        scanned: 1,
        indexed: 1,
        new: 1,
        updated: 0,
        errors: [],
      }));

      const result = await runAutomationPipeline(makeInput());

      expect(result.sessionsScanned).toBe(1);
    });

    it("returns sessionsScanned of 0 when no files are found", async () => {
      mockScanSessionFiles.mockImplementation(async () => []);
      mockIndexSessions.mockImplementation(async () => ({
        scanned: 0,
        indexed: 0,
        new: 0,
        updated: 0,
        errors: [],
      }));

      const result = await runAutomationPipeline(makeInput());

      expect(result.sessionsScanned).toBe(0);
    });

    it("adds a session scan error when scanSessionFiles throws", async () => {
      mockScanSessionFiles.mockImplementation(async () => {
        throw new Error("Filesystem unavailable");
      });

      const result = await runAutomationPipeline(makeInput());

      expect(result.errors.some((e) => e.includes("Session scan failed"))).toBe(true);
      expect(result.errors.some((e) => e.includes("Filesystem unavailable"))).toBe(true);
    });

    it("does not throw when session scan fails — continues to content generation", async () => {
      mockScanSessionFiles.mockImplementation(async () => {
        throw new Error("disk error");
      });

      const result = await runAutomationPipeline(makeInput({ contentType: "changelog" }));

      expect(result).toHaveProperty("postsGenerated");
    });

    it("calls parseSessionFile for each scanned file", async () => {
      mockScanSessionFiles.mockImplementation(async () => [
        { filePath: "/path/a.jsonl" },
        { filePath: "/path/b.jsonl" },
      ]);
      mockParseSessionFile.mockImplementation(async () => ({ messages: [] }));
      mockNormalizeSession.mockImplementation(() => ({}));

      await runAutomationPipeline(makeInput());

      expect(mockParseSessionFile).toHaveBeenCalledTimes(2);
    });

    it("calls normalizeSession for each parsed file", async () => {
      mockScanSessionFiles.mockImplementation(async () => [
        { filePath: "/path/a.jsonl" },
      ]);
      mockParseSessionFile.mockImplementation(async () => ({ messages: [] }));
      mockNormalizeSession.mockImplementation(() => ({}));

      await runAutomationPipeline(makeInput());

      expect(mockNormalizeSession).toHaveBeenCalledTimes(1);
    });

    it("passes workspaceId to indexSessions", async () => {
      mockScanSessionFiles.mockImplementation(async () => [
        { filePath: "/path/a.jsonl" },
      ]);
      mockNormalizeSession.mockImplementation(() => ({}));

      await runAutomationPipeline(makeInput({ workspaceId: "test-workspace" }));

      expect(mockIndexSessions).toHaveBeenCalledWith(
        "test-workspace",
        expect.any(Array)
      );
    });
  });

  // -------------------------------------------------------------------------
  // Lookback window → days mapping
  // -------------------------------------------------------------------------

  describe("lookback window to days mapping", () => {
    const cases: Array<{ window: string; expectedDays: number }> = [
      { window: "current_day", expectedDays: 1 },
      { window: "yesterday", expectedDays: 1 },
      { window: "last_7_days", expectedDays: 7 },
      { window: "last_14_days", expectedDays: 14 },
      { window: "last_30_days", expectedDays: 30 },
      { window: "custom", expectedDays: 7 },
    ];

    for (const { window, expectedDays } of cases) {
      it(`maps ${window} to ${expectedDays} days`, async () => {
        await runAutomationPipeline(
          makeInput({ lookbackWindow: window, contentType: "changelog" })
        );

        expect(mockScanSessionFiles).toHaveBeenCalledWith(
          expectedDays,
          expect.any(String)
        );
      });
    }
  });

  // -------------------------------------------------------------------------
  // Changelog content type
  // -------------------------------------------------------------------------

  describe("contentType: changelog", () => {
    it("calls the API for changelog generation", async () => {
      mockCreate.mockImplementation(async () => makeTextResponse("Changelog done."));

      await runAutomationPipeline(makeInput({ contentType: "changelog" }));

      expect(mockCreate).toHaveBeenCalled();
    });

    it("uses the changelog-writer agent type", async () => {
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      await runAutomationPipeline(makeInput({ contentType: "changelog" }));

      expect(mockGetModelForAgent).toHaveBeenCalledWith("changelog-writer");
      expect(mockGetToolsForAgent).toHaveBeenCalledWith("changelog-writer");
    });

    it("uses the CHANGELOG_PROMPT as system prompt", async () => {
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      await runAutomationPipeline(makeInput({ contentType: "changelog" }));

      expect(
        (mockCreate.mock.calls[0][0] as { system: string }).system
      ).toBe("You are a changelog writer.");
    });

    it("includes the lookback days in the user message", async () => {
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      await runAutomationPipeline(
        makeInput({ contentType: "changelog", lookbackWindow: "last_14_days" })
      );

      const userMsg = (
        mockCreate.mock.calls[0][0] as { messages: Array<{ role: string; content: string }> }
      ).messages[0];
      expect(userMsg.content).toContain("14");
    });

    it("adds a changelog error when the agent loop throws", async () => {
      mockCreate.mockImplementation(async () => {
        throw new Error("LLM unavailable");
      });

      const result = await runAutomationPipeline(makeInput({ contentType: "changelog" }));

      expect(result.errors.some((e) => e.includes("Changelog generation failed"))).toBe(true);
      expect(result.errors.some((e) => e.includes("LLM unavailable"))).toBe(true);
    });

    it("returns postsGenerated = 1 when create_post is called once", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-1", name: "create_post", input: { title: "Changelog" } },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"));

      const result = await runAutomationPipeline(makeInput({ contentType: "changelog" }));

      expect(result.postsGenerated).toBe(1);
    });

    it("does not fetch insights for changelog content type", async () => {
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      await runAutomationPipeline(makeInput({ contentType: "changelog" }));

      expect(mockDb.query.insights.findMany).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Newsletter content type
  // -------------------------------------------------------------------------

  describe("contentType: newsletter", () => {
    it("uses the newsletter-writer agent type", async () => {
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      await runAutomationPipeline(makeInput({ contentType: "newsletter" }));

      expect(mockGetModelForAgent).toHaveBeenCalledWith("newsletter-writer");
      expect(mockGetToolsForAgent).toHaveBeenCalledWith("newsletter-writer");
    });

    it("uses the NEWSLETTER_PROMPT as system prompt", async () => {
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      await runAutomationPipeline(makeInput({ contentType: "newsletter" }));

      expect(
        (mockCreate.mock.calls[0][0] as { system: string }).system
      ).toBe("You are a newsletter writer.");
    });

    it("includes the lookback days in the newsletter user message", async () => {
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      await runAutomationPipeline(
        makeInput({ contentType: "newsletter", lookbackWindow: "last_30_days" })
      );

      const userMsg = (
        mockCreate.mock.calls[0][0] as { messages: Array<{ role: string; content: string }> }
      ).messages[0];
      expect(userMsg.content).toContain("30");
    });

    it("adds a newsletter error when the agent loop throws", async () => {
      mockCreate.mockImplementation(async () => {
        throw new Error("Newsletter LLM error");
      });

      const result = await runAutomationPipeline(makeInput({ contentType: "newsletter" }));

      expect(result.errors.some((e) => e.includes("Newsletter generation failed"))).toBe(true);
    });

    it("does not fetch insights for newsletter content type", async () => {
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      await runAutomationPipeline(makeInput({ contentType: "newsletter" }));

      expect(mockDb.query.insights.findMany).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Insight-based content types
  // -------------------------------------------------------------------------

  describe("insight-based content types (twitter_thread, linkedin_post, devto_post, blog_post)", () => {
    it("adds 'No unused insights found' error when insights array is empty", async () => {
      mockInsights = [];

      const result = await runAutomationPipeline(
        makeInput({ contentType: "twitter_thread" })
      );

      expect(
        result.errors.some((e) => e.includes("No unused insights found"))
      ).toBe(true);
    });

    it("does not call the API when no insights are found", async () => {
      mockInsights = [];

      await runAutomationPipeline(makeInput({ contentType: "twitter_thread" }));

      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("calls the API once per insight when there are 2 insights", async () => {
      mockInsights = [{ id: "insight-a" }, { id: "insight-b" }];
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      await runAutomationPipeline(makeInput({ contentType: "twitter_thread" }));

      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it("returns postsGenerated = 2 when create_post is called once per insight", async () => {
      mockInsights = [{ id: "insight-a" }, { id: "insight-b" }];
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-1", name: "create_post", input: { title: "Post 1" } },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"))
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-2", name: "create_post", input: { title: "Post 2" } },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"));

      const result = await runAutomationPipeline(
        makeInput({ contentType: "twitter_thread" })
      );

      expect(result.postsGenerated).toBe(2);
    });

    it("adds a per-insight error and continues with remaining insights on failure", async () => {
      mockInsights = [{ id: "insight-fail" }, { id: "insight-ok" }];
      mockCreate
        .mockImplementationOnce(async () => {
          throw new Error("LLM error for first insight");
        })
        .mockImplementationOnce(async () => makeTextResponse("done"));

      const result = await runAutomationPipeline(
        makeInput({ contentType: "twitter_thread" })
      );

      expect(result.errors.some((e) => e.includes("insight-fail"))).toBe(true);
      expect(result.postsGenerated).toBe(0);
    });

    it("adds insight fetch error when insights query throws", async () => {
      mockDb.query.insights.findMany.mockImplementation(async () => {
        throw new Error("DB query failed");
      });

      const result = await runAutomationPipeline(
        makeInput({ contentType: "twitter_thread" })
      );

      expect(result.errors.some((e) => e.includes("Insight fetch failed"))).toBe(true);
      expect(result.errors.some((e) => e.includes("DB query failed"))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Twitter thread
  // -------------------------------------------------------------------------

  describe("contentType: twitter_thread", () => {
    it("uses the social-writer agent type", async () => {
      mockInsights = [{ id: "insight-x" }];
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      await runAutomationPipeline(makeInput({ contentType: "twitter_thread" }));

      expect(mockGetModelForAgent).toHaveBeenCalledWith("social-writer");
      expect(mockGetToolsForAgent).toHaveBeenCalledWith("social-writer");
    });

    it("uses the TWITTER_THREAD_PROMPT as system prompt", async () => {
      mockInsights = [{ id: "insight-x" }];
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      await runAutomationPipeline(makeInput({ contentType: "twitter_thread" }));

      expect(
        (mockCreate.mock.calls[0][0] as { system: string }).system
      ).toBe("You are a twitter thread writer.");
    });

    it("includes the insight id in the user message", async () => {
      mockInsights = [{ id: "special-insight-id" }];
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      await runAutomationPipeline(makeInput({ contentType: "twitter_thread" }));

      const userMsg = (
        mockCreate.mock.calls[0][0] as { messages: Array<{ role: string; content: string }> }
      ).messages[0];
      expect(userMsg.content).toContain("special-insight-id");
    });
  });

  // -------------------------------------------------------------------------
  // LinkedIn post
  // -------------------------------------------------------------------------

  describe("contentType: linkedin_post", () => {
    it("uses the social-writer agent type", async () => {
      mockInsights = [{ id: "insight-y" }];
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      await runAutomationPipeline(makeInput({ contentType: "linkedin_post" }));

      expect(mockGetModelForAgent).toHaveBeenCalledWith("social-writer");
    });

    it("uses the LINKEDIN_PROMPT as system prompt", async () => {
      mockInsights = [{ id: "insight-y" }];
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      await runAutomationPipeline(makeInput({ contentType: "linkedin_post" }));

      expect(
        (mockCreate.mock.calls[0][0] as { system: string }).system
      ).toBe("You are a linkedin writer.");
    });

    it("includes the insight id in the linkedin user message", async () => {
      mockInsights = [{ id: "linkedin-insight-id" }];
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      await runAutomationPipeline(makeInput({ contentType: "linkedin_post" }));

      const userMsg = (
        mockCreate.mock.calls[0][0] as { messages: Array<{ role: string; content: string }> }
      ).messages[0];
      expect(userMsg.content).toContain("linkedin-insight-id");
    });
  });

  // -------------------------------------------------------------------------
  // Dev.to post
  // -------------------------------------------------------------------------

  describe("contentType: devto_post", () => {
    it("uses the blog-writer agent type", async () => {
      mockInsights = [{ id: "insight-z" }];
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      await runAutomationPipeline(makeInput({ contentType: "devto_post" }));

      expect(mockGetModelForAgent).toHaveBeenCalledWith("blog-writer");
    });

    it("uses the BLOG_TUTORIAL_PROMPT as system prompt", async () => {
      mockInsights = [{ id: "insight-z" }];
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      await runAutomationPipeline(makeInput({ contentType: "devto_post" }));

      expect(
        (mockCreate.mock.calls[0][0] as { system: string }).system
      ).toBe("You are a tutorial blog writer.");
    });
  });

  // -------------------------------------------------------------------------
  // Blog post (default / custom)
  // -------------------------------------------------------------------------

  describe("contentType: blog_post", () => {
    it("uses the blog-writer agent type", async () => {
      mockInsights = [{ id: "insight-w" }];
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      await runAutomationPipeline(makeInput({ contentType: "blog_post" }));

      expect(mockGetModelForAgent).toHaveBeenCalledWith("blog-writer");
    });

    it("uses the BLOG_TECHNICAL_PROMPT as system prompt", async () => {
      mockInsights = [{ id: "insight-w" }];
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      await runAutomationPipeline(makeInput({ contentType: "blog_post" }));

      expect(
        (mockCreate.mock.calls[0][0] as { system: string }).system
      ).toBe("You are a technical blog writer.");
    });

    it("includes the insight id in the blog post user message", async () => {
      mockInsights = [{ id: "blog-insight-id" }];
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      await runAutomationPipeline(makeInput({ contentType: "blog_post" }));

      const userMsg = (
        mockCreate.mock.calls[0][0] as { messages: Array<{ role: string; content: string }> }
      ).messages[0];
      expect(userMsg.content).toContain("blog-insight-id");
    });
  });

  // -------------------------------------------------------------------------
  // Agent loop tool dispatch
  // -------------------------------------------------------------------------

  describe("tool dispatch in agent loop", () => {
    it("routes get_session_* tools to handleSessionReaderTool", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-1", name: "get_session_summary", input: { sessionId: "s1" } },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"));

      await runAutomationPipeline(makeInput({ contentType: "changelog" }));

      expect(mockHandleSessionReaderTool).toHaveBeenCalledWith(
        "ws-001",
        "get_session_summary",
        expect.any(Object)
      );
    });

    it("routes list_sessions_by_timeframe to handleSessionReaderTool", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-1", name: "list_sessions_by_timeframe", input: { lookbackDays: 7 } },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"));

      await runAutomationPipeline(makeInput({ contentType: "changelog" }));

      expect(mockHandleSessionReaderTool).toHaveBeenCalledWith(
        "ws-001",
        "list_sessions_by_timeframe",
        expect.any(Object)
      );
    });

    it("routes get_insight_* tools to handleInsightTool", async () => {
      mockInsights = [{ id: "insight-1" }];
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-1", name: "get_insight_by_id", input: { insightId: "insight-1" } },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"));

      await runAutomationPipeline(makeInput({ contentType: "twitter_thread" }));

      expect(mockHandleInsightTool).toHaveBeenCalledWith(
        "ws-001",
        "get_insight_by_id",
        expect.any(Object)
      );
    });

    it("routes create_post to handlePostManagerTool", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-1", name: "create_post", input: { title: "Post" } },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"));

      await runAutomationPipeline(makeInput({ contentType: "changelog" }));

      expect(mockHandlePostManagerTool).toHaveBeenCalledWith(
        "ws-001",
        "create_post",
        expect.any(Object)
      );
    });

    it("routes list_available_skills to handleSkillLoaderTool", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-1", name: "list_available_skills", input: {} },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"));

      await runAutomationPipeline(makeInput({ contentType: "changelog" }));

      expect(mockHandleSkillLoaderTool).toHaveBeenCalledWith(
        "list_available_skills",
        expect.any(Object)
      );
    });

    it("returns an error tool_result for unknown tools without crashing", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-unknown", name: "totally_unknown_tool", input: {} },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"));

      // Should not throw
      await runAutomationPipeline(makeInput({ contentType: "changelog" }));

      // The second call should carry an is_error tool result
      const secondCallMessages = (
        mockCreate.mock.calls[1][0] as { messages: unknown[] }
      ).messages;
      const toolResultMessage = secondCallMessages[2] as {
        role: string;
        content: unknown[];
      };
      const errorResult = toolResultMessage.content[0] as {
        is_error: boolean;
        content: string;
      };
      expect(errorResult.is_error).toBe(true);
      expect(errorResult.content).toContain("Unknown tool: totally_unknown_tool");
    });

    it("handles multiple tool calls in a single response (parallel dispatch)", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-1", name: "list_sessions_by_timeframe", input: { lookbackDays: 7 } },
            { id: "tu-2", name: "get_insight_by_id", input: { insightId: "i1" } },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"));

      await runAutomationPipeline(makeInput({ contentType: "changelog" }));

      expect(mockHandleSessionReaderTool).toHaveBeenCalledTimes(1);
      expect(mockHandleInsightTool).toHaveBeenCalledTimes(1);
    });

    it("handles multiple sequential rounds of tool_use before end_turn", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-1", name: "list_sessions_by_timeframe", input: { lookbackDays: 7 } },
          ])
        )
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-2", name: "create_post", input: { title: "Changelog" } },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"));

      const result = await runAutomationPipeline(makeInput({ contentType: "changelog" }));

      expect(mockCreate).toHaveBeenCalledTimes(3);
      expect(result.postsGenerated).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // API call parameters
  // -------------------------------------------------------------------------

  describe("API call parameters", () => {
    it("passes max_tokens of 8192 to every API call", async () => {
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      await runAutomationPipeline(makeInput({ contentType: "changelog" }));

      expect(
        (mockCreate.mock.calls[0][0] as { max_tokens: number }).max_tokens
      ).toBe(8192);
    });

    it("passes the model returned by getModelForAgent", async () => {
      mockGetModelForAgent.mockImplementation(() => "claude-custom-model");
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      await runAutomationPipeline(makeInput({ contentType: "changelog" }));

      expect(
        (mockCreate.mock.calls[0][0] as { model: string }).model
      ).toBe("claude-custom-model");
    });

    it("passes tools returned by getToolsForAgent", async () => {
      const fakeTool = {
        name: "fake_tool",
        description: "A fake tool",
        input_schema: { type: "object" as const, properties: {} },
      };
      mockGetToolsForAgent.mockImplementation(() => [fakeTool]);
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      await runAutomationPipeline(makeInput({ contentType: "changelog" }));

      expect(
        (mockCreate.mock.calls[0][0] as { tools: unknown[] }).tools
      ).toEqual([fakeTool]);
    });

    it("includes assistant + tool_result messages in subsequent API calls", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-1", name: "list_sessions_by_timeframe", input: { lookbackDays: 7 } },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"));

      await runAutomationPipeline(makeInput({ contentType: "changelog" }));

      const secondCallMessages = (
        mockCreate.mock.calls[1][0] as { messages: unknown[] }
      ).messages;
      // user → assistant (tool_use) → user (tool_result)
      expect(secondCallMessages.length).toBe(3);

      const toolResultMessage = secondCallMessages[2] as {
        role: string;
        content: unknown[];
      };
      expect(toolResultMessage.role).toBe("user");

      const toolResult = toolResultMessage.content[0] as {
        type: string;
        tool_use_id: string;
      };
      expect(toolResult.type).toBe("tool_result");
      expect(toolResult.tool_use_id).toBe("tu-1");
    });
  });

  // -------------------------------------------------------------------------
  // Result shape
  // -------------------------------------------------------------------------

  describe("PipelineResult shape", () => {
    it("always returns postsGenerated, sessionsScanned, and errors fields", async () => {
      const result = await runAutomationPipeline(makeInput());
      expect(result).toHaveProperty("postsGenerated");
      expect(result).toHaveProperty("sessionsScanned");
      expect(result).toHaveProperty("errors");
    });

    it("returns postsGenerated = 0 when the agent produces no create_post calls", async () => {
      mockCreate.mockImplementation(async () => makeTextResponse("No posts."));

      const result = await runAutomationPipeline(makeInput({ contentType: "changelog" }));

      expect(result.postsGenerated).toBe(0);
    });

    it("returns an empty errors array on full success", async () => {
      mockCreate.mockImplementation(async () => makeTextResponse("Done."));

      const result = await runAutomationPipeline(makeInput({ contentType: "changelog" }));

      expect(result.errors).toEqual([]);
    });

    it("accumulates errors from both scan failures and generation failures", async () => {
      mockScanSessionFiles.mockImplementation(async () => {
        throw new Error("scan error");
      });
      mockCreate.mockImplementation(async () => {
        throw new Error("generation error");
      });

      const result = await runAutomationPipeline(makeInput({ contentType: "changelog" }));

      expect(result.errors.length).toBeGreaterThanOrEqual(2);
      expect(result.errors.some((e) => e.includes("Session scan failed"))).toBe(true);
      expect(result.errors.some((e) => e.includes("Changelog generation failed"))).toBe(true);
    });
  });
});
