/**
 * Integration tests for the content generation pipeline.
 *
 * Exercises the full pipeline from streamBlogWriter through tool dispatch to
 * the real handleInsightTool, handleSessionReaderTool, and handlePostManagerTool
 * handlers, with only the Anthropic SDK and database mocked at their boundaries.
 *
 * Unlike unit tests, these tests do NOT mock tool handlers — they let the
 * real insight-tools, session-reader, and post-manager modules execute,
 * verifying that data flows correctly through the entire pipeline.
 *
 * The blog-writer returns an SSE streaming Response; tests collect all events
 * from the stream before asserting on them.
 */

import { describe, it, expect, mock, beforeAll, beforeEach } from "bun:test";

// ---------------------------------------------------------------------------
// Database mock state — controlled per test via beforeEach
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

const mockSessionData = {
  id: "db-session-id",
  workspaceId: "ws-content",
  sessionId: "session-xyz-001",
  projectName: "my-project",
  projectPath: "/Users/nick/my-project",
  messageCount: 6,
  toolsUsed: ["Read", "Glob", "Write"],
  filesModified: ["/Users/nick/my-project/src/scanner.ts"],
  errorsEncountered: [],
  summary: "Implemented file scanning with Glob+Read combo",
  startedAt: new Date("2024-06-01T10:00:00Z"),
  endedAt: new Date("2024-06-01T10:30:00Z"),
  durationSeconds: 1800,
  costUsd: 0.12,
  rawMetadata: {
    messages: [
      {
        role: "user",
        content: "Help me implement file scanning",
        timestamp: "2024-06-01T10:00:00Z",
      },
      {
        role: "assistant",
        content: "I will use Glob and Read for efficient scanning.",
        timestamp: "2024-06-01T10:00:10Z",
      },
    ],
  },
};

const mockPostData = {
  id: "post-created-001",
  workspaceId: "ws-content",
  title: "The Read-Glob Pipeline Pattern",
  content: "# The Read-Glob Pipeline Pattern\n\nCombining tools efficiently.",
  markdown: "# The Read-Glob Pipeline Pattern\n\nCombining tools efficiently.",
  contentType: "blog_post",
  insightId: "insight-001",
  status: "draft",
  toneUsed: "technical",
  wordCount: 7,
  sourceMetadata: null,
  createdAt: new Date("2024-06-01T12:00:00Z"),
};

// ---------------------------------------------------------------------------
// Mock function factories — reassigned per test where needed
// ---------------------------------------------------------------------------

const mockFindFirstInsight = mock(async () => mockInsightData);
const mockFindFirstSession = mock(async () => mockSessionData);
const mockFindManyInsights = mock(async () => [mockInsightData]);
const mockFindFirstPost = mock(async () => mockPostData);

// insert chain: db.insert().values().returning()
const mockInsertReturning = mock(async () => [mockPostData]);
const mockInsertValues = mock(() => ({ returning: mockInsertReturning }));
const mockDbInsert = mock(() => ({ values: mockInsertValues }));

// update chain: db.update().set().where().returning()
const mockUpdateReturning = mock(async () => [{ ...mockPostData, title: "Updated Title" }]);
const mockUpdateWhere = mock(() => ({ returning: mockUpdateReturning }));
const mockUpdateSet = mock(() => ({ where: mockUpdateWhere }));
const mockDbUpdate = mock(() => ({ set: mockUpdateSet }));

const mockCreate = mock(async () => ({}));

// ---------------------------------------------------------------------------
// Register module mocks BEFORE any dynamic imports
// ---------------------------------------------------------------------------

mock.module("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

mock.module("@/lib/db", () => ({
  db: {
    query: {
      insights: {
        findFirst: mockFindFirstInsight,
        findMany: mockFindManyInsights,
      },
      claudeSessions: { findFirst: mockFindFirstSession },
      posts: { findFirst: mockFindFirstPost },
    },
    insert: mockDbInsert,
    update: mockDbUpdate,
  },
}));

mock.module("@sessionforge/db", () => ({
  claudeSessions: {},
  insights: {},
  posts: {},
  insightCategoryEnum: {
    enumValues: [
      "tool_discovery",
      "workflow_optimization",
      "error_pattern",
      "performance",
      "architecture",
      "debugging",
    ],
  },
  contentTypeEnum: {
    enumValues: ["blog_post", "twitter_thread", "linkedin_post", "newsletter", "changelog"],
  },
  postStatusEnum: {
    enumValues: ["draft", "published", "archived"],
  },
  toneProfileEnum: {
    enumValues: ["professional", "casual", "technical", "conversational"],
  },
}));

mock.module("drizzle-orm", () => ({
  eq: mock(() => null),
  desc: mock(() => null),
  gte: mock(() => null),
  and: mock(() => null),
}));

mock.module("../../src/lib/ai/prompts/blog/technical", () => ({
  BLOG_TECHNICAL_PROMPT: "You are a technical blog writer.",
}));

mock.module("../../src/lib/ai/prompts/blog/tutorial", () => ({
  BLOG_TUTORIAL_PROMPT: "You are a tutorial blog writer.",
}));

mock.module("../../src/lib/ai/prompts/blog/conversational", () => ({
  BLOG_CONVERSATIONAL_PROMPT: "You are a conversational blog writer.",
}));

// ---------------------------------------------------------------------------
// Dynamic import of the module under test (after mocks are registered)
// ---------------------------------------------------------------------------

let streamBlogWriter: (input: {
  workspaceId: string;
  insightId: string;
  tone?: "technical" | "tutorial" | "conversational";
  customInstructions?: string;
}) => Response;

beforeAll(async () => {
  const mod = await import("../../src/lib/ai/agents/blog-writer");
  streamBlogWriter = mod.streamBlogWriter;
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

interface SSEEvent {
  event: string;
  data: unknown;
}

/**
 * Reads all SSE events from the response body and returns them as a list.
 * Each event contains the event name and the parsed (or raw) data payload.
 */
async function collectSSEEvents(response: Response): Promise<SSEEvent[]> {
  const events: SSEEvent[] = [];
  const text = await response.text();
  const chunks = text.split("\n\n").filter(Boolean);

  for (const chunk of chunks) {
    const lines = chunk.split("\n");
    let eventName = "";
    let dataLine = "";

    for (const line of lines) {
      if (line.startsWith("event: ")) eventName = line.slice(7);
      else if (line.startsWith("data: ")) dataLine = line.slice(6);
    }

    if (eventName && dataLine) {
      try {
        events.push({ event: eventName, data: JSON.parse(dataLine) });
      } catch {
        events.push({ event: eventName, data: dataLine });
      }
    }
  }

  return events;
}

function makeToolUseResponse(
  tools: Array<{ id: string; name: string; input: Record<string, unknown> }>,
  usage = { input_tokens: 30, output_tokens: 60 }
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

function makeTextResponse(
  text: string,
  usage = { input_tokens: 50, output_tokens: 200 }
) {
  return {
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    usage,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("content generation pipeline integration", () => {
  const workspaceId = "ws-content";
  const insightId = "insight-001";

  beforeEach(() => {
    mockCreate.mockReset();
    mockFindFirstInsight.mockReset();
    mockFindFirstSession.mockReset();
    mockFindManyInsights.mockReset();
    mockFindFirstPost.mockReset();
    mockInsertReturning.mockReset();
    mockInsertValues.mockReset();
    mockDbInsert.mockReset();
    mockUpdateReturning.mockReset();
    mockUpdateWhere.mockReset();
    mockUpdateSet.mockReset();
    mockDbUpdate.mockReset();

    // Restore default implementations
    mockFindFirstInsight.mockImplementation(async () => mockInsightData);
    mockFindFirstSession.mockImplementation(async () => mockSessionData);
    mockFindManyInsights.mockImplementation(async () => [mockInsightData]);
    mockFindFirstPost.mockImplementation(async () => mockPostData);
    mockInsertReturning.mockImplementation(async () => [mockPostData]);
    mockInsertValues.mockImplementation(() => ({ returning: mockInsertReturning }));
    mockDbInsert.mockImplementation(() => ({ values: mockInsertValues }));
    mockUpdateReturning.mockImplementation(async () => [
      { ...mockPostData, title: "Updated Title" },
    ]);
    mockUpdateWhere.mockImplementation(() => ({ returning: mockUpdateReturning }));
    mockUpdateSet.mockImplementation(() => ({ where: mockUpdateWhere }));
    mockDbUpdate.mockImplementation(() => ({ set: mockUpdateSet }));
  });

  // -------------------------------------------------------------------------
  // SSE response structure
  // -------------------------------------------------------------------------

  describe("SSE response structure", () => {
    it("returns a Response with correct SSE headers", async () => {
      mockCreate.mockImplementationOnce(async () => makeTextResponse("Blog post generated."));

      const response = streamBlogWriter({ workspaceId, insightId });

      expect(response).toBeInstanceOf(Response);
      expect(response.headers.get("Content-Type")).toBe("text/event-stream");
      expect(response.headers.get("Cache-Control")).toBe("no-cache");
      expect(response.headers.get("Connection")).toBe("keep-alive");

      // Drain the stream to avoid resource leaks
      await response.text();
    });

    it("emits a status event as the first event in the stream", async () => {
      mockCreate.mockImplementationOnce(async () => makeTextResponse("Done."));

      const response = streamBlogWriter({ workspaceId, insightId });
      const events = await collectSSEEvents(response);

      expect(events[0].event).toBe("status");
      expect((events[0].data as { phase: string }).phase).toBe("starting");
    });

    it("emits a done event as the final event in the stream", async () => {
      mockCreate.mockImplementationOnce(async () => makeTextResponse("Done."));

      const response = streamBlogWriter({ workspaceId, insightId });
      const events = await collectSSEEvents(response);

      const lastEvent = events[events.length - 1];
      expect(lastEvent.event).toBe("done");
    });

    it("emits a text event with the model's final response content", async () => {
      const blogContent = "# Read-Glob Pipeline\n\nThis is the blog post.";
      mockCreate.mockImplementationOnce(async () =>
        makeTextResponse(blogContent)
      );

      const response = streamBlogWriter({ workspaceId, insightId });
      const events = await collectSSEEvents(response);

      const textEvent = events.find((e) => e.event === "text");
      expect(textEvent).toBeDefined();
      expect((textEvent!.data as { content: string }).content).toBe(blogContent);
    });

    it("emits a complete event with usage stats after the text event", async () => {
      const usage = { input_tokens: 100, output_tokens: 500 };
      mockCreate.mockImplementationOnce(async () => makeTextResponse("Done.", usage));

      const response = streamBlogWriter({ workspaceId, insightId });
      const events = await collectSSEEvents(response);

      const completeEvent = events.find((e) => e.event === "complete");
      expect(completeEvent).toBeDefined();
      expect((completeEvent!.data as { usage: typeof usage }).usage).toEqual(usage);
    });
  });

  // -------------------------------------------------------------------------
  // Full insight-to-post pipeline
  // -------------------------------------------------------------------------

  describe("full insight-to-post pipeline", () => {
    it("routes get_insight_details through the real handler and returns insight data to the model", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-1",
              name: "get_insight_details",
              input: { insightId },
            },
          ])
        )
        .mockImplementationOnce(async () =>
          makeTextResponse("Insight retrieved. Writing blog post now.")
        );

      const response = streamBlogWriter({ workspaceId, insightId });
      const events = await collectSSEEvents(response);

      // Real handler was invoked
      expect(mockFindFirstInsight).toHaveBeenCalledTimes(1);

      // tool_use event emitted
      const toolUseEvent = events.find((e) => e.event === "tool_use");
      expect(toolUseEvent).toBeDefined();
      expect((toolUseEvent!.data as { tool: string }).tool).toBe("get_insight_details");
    });

    it("passes insight data as JSON string in tool result to the model", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-insight",
              name: "get_insight_details",
              input: { insightId },
            },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"));

      const response = streamBlogWriter({ workspaceId, insightId });
      await collectSSEEvents(response);

      const secondCallMessages = (
        mockCreate.mock.calls[1][0] as { messages: unknown[] }
      ).messages;

      // messages: initial user → assistant tool_use → user tool_result
      expect(secondCallMessages).toHaveLength(3);

      const toolResultMsg = secondCallMessages[2] as {
        role: string;
        content: Array<{ type: string; content: string }>;
      };
      expect(toolResultMsg.role).toBe("user");

      const toolResult = toolResultMsg.content[0];
      expect(toolResult.type).toBe("tool_result");

      // The real handler serialised the insight data to JSON
      const parsed = JSON.parse(toolResult.content);
      expect(parsed.id).toBe(mockInsightData.id);
      expect(parsed.title).toBe(mockInsightData.title);
      expect(parsed.compositeScore).toBe(mockInsightData.compositeScore);
    });

    it("routes create_post through the real handler which inserts into the database", async () => {
      const postInput = {
        title: "The Read-Glob Pipeline Pattern",
        markdown: "# The Read-Glob Pipeline Pattern\n\nEfficient file traversal.",
        contentType: "blog_post",
        insightId,
      };

      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-post",
              name: "create_post",
              input: postInput,
            },
          ])
        )
        .mockImplementationOnce(async () =>
          makeTextResponse("Blog post created successfully.")
        );

      const response = streamBlogWriter({ workspaceId, insightId });
      const events = await collectSSEEvents(response);

      // Real createPost called db.insert
      expect(mockDbInsert).toHaveBeenCalledTimes(1);
      expect(mockInsertValues).toHaveBeenCalledTimes(1);

      const insertedRecord = mockInsertValues.mock.calls[0][0] as {
        workspaceId: string;
        title: string;
        contentType: string;
        status: string;
        wordCount: number;
      };
      expect(insertedRecord.workspaceId).toBe(workspaceId);
      expect(insertedRecord.title).toBe(postInput.title);
      expect(insertedRecord.contentType).toBe("blog_post");
      expect(insertedRecord.status).toBe("draft");
      // Word count computed from markdown: "The Read-Glob Pipeline Pattern Efficient file traversal." = 7 words
      expect(insertedRecord.wordCount).toBeGreaterThan(0);

      const textEvent = events.find((e) => e.event === "text");
      expect((textEvent!.data as { content: string }).content).toBe(
        "Blog post created successfully."
      );
    });

    it("executes the full insight-fetch → session-fetch → create-post → text pipeline", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-1",
              name: "get_insight_details",
              input: { insightId },
            },
          ])
        )
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-2",
              name: "get_session_summary",
              input: { sessionId: "session-xyz-001" },
            },
          ])
        )
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-3",
              name: "create_post",
              input: {
                title: "File Scanning with Glob and Read",
                markdown:
                  "# File Scanning with Glob and Read\n\nA detailed walkthrough.",
                contentType: "blog_post",
              },
            },
          ])
        )
        .mockImplementationOnce(async () =>
          makeTextResponse(
            "I have created a comprehensive blog post about the file scanning pattern."
          )
        );

      const response = streamBlogWriter({ workspaceId, insightId });
      const events = await collectSSEEvents(response);

      const textEvent = events.find((e) => e.event === "text");
      expect((textEvent!.data as { content: string }).content).toBe(
        "I have created a comprehensive blog post about the file scanning pattern."
      );

      expect(mockCreate).toHaveBeenCalledTimes(4);
      expect(mockFindFirstInsight).toHaveBeenCalledTimes(1);
      expect(mockFindFirstSession).toHaveBeenCalledTimes(1);
      expect(mockDbInsert).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Session reader tool handler integration
  // -------------------------------------------------------------------------

  describe("session reader tool pipeline", () => {
    it("routes get_session_summary through the real handler and returns session data", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-session",
              name: "get_session_summary",
              input: { sessionId: "session-xyz-001" },
            },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("Session retrieved."));

      const response = streamBlogWriter({ workspaceId, insightId });
      await collectSSEEvents(response);

      expect(mockFindFirstSession).toHaveBeenCalledTimes(1);

      const secondCallMessages = (
        mockCreate.mock.calls[1][0] as { messages: unknown[] }
      ).messages;
      const toolResultMsg = secondCallMessages[2] as {
        content: Array<{ content: string }>;
      };
      const sessionData = JSON.parse(toolResultMsg.content[0].content);

      expect(sessionData.sessionId).toBe(mockSessionData.sessionId);
      expect(sessionData.projectName).toBe(mockSessionData.projectName);
      expect(sessionData.toolsUsed).toContain("Read");
      expect(sessionData.toolsUsed).toContain("Glob");
    });

    it("routes get_session_messages through the real handler and returns message list", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-msgs",
              name: "get_session_messages",
              input: { sessionId: "session-xyz-001", limit: 20 },
            },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("Messages read."));

      const response = streamBlogWriter({ workspaceId, insightId });
      await collectSSEEvents(response);

      expect(mockFindFirstSession).toHaveBeenCalledTimes(1);

      const secondCallMessages = (
        mockCreate.mock.calls[1][0] as { messages: unknown[] }
      ).messages;
      const toolResultMsg = secondCallMessages[2] as {
        content: Array<{ content: string }>;
      };
      const messages = JSON.parse(toolResultMsg.content[0].content);

      expect(Array.isArray(messages)).toBe(true);
      expect(messages[0].role).toBe("user");
    });

    it("propagates session-not-found error as an error tool result", async () => {
      mockFindFirstSession.mockImplementation(async () => undefined);

      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-err",
              name: "get_session_summary",
              input: { sessionId: "nonexistent-session" },
            },
          ])
        )
        .mockImplementationOnce(async () =>
          makeTextResponse("Session not found, writing from insight only.")
        );

      const response = streamBlogWriter({ workspaceId, insightId });
      const events = await collectSSEEvents(response);

      // Pipeline continues despite error
      const textEvent = events.find((e) => e.event === "text");
      expect((textEvent!.data as { content: string }).content).toBe(
        "Session not found, writing from insight only."
      );

      // Error tool result was sent back to model
      const secondCallMessages = (
        mockCreate.mock.calls[1][0] as { messages: unknown[] }
      ).messages;
      const toolResultMsg = secondCallMessages[2] as {
        content: Array<{ is_error?: boolean; content: string }>;
      };
      const errorResult = toolResultMsg.content[0];
      expect(errorResult.is_error).toBe(true);
      expect(errorResult.content).toContain("not found");
    });
  });

  // -------------------------------------------------------------------------
  // Post manager tool handler integration
  // -------------------------------------------------------------------------

  describe("post manager tool pipeline", () => {
    it("routes get_post through the real handler and returns post data to the model", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-get-post",
              name: "get_post",
              input: { postId: "post-created-001" },
            },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("Post retrieved."));

      const response = streamBlogWriter({ workspaceId, insightId });
      await collectSSEEvents(response);

      expect(mockFindFirstPost).toHaveBeenCalledTimes(1);

      const secondCallMessages = (
        mockCreate.mock.calls[1][0] as { messages: unknown[] }
      ).messages;
      const toolResultMsg = secondCallMessages[2] as {
        content: Array<{ content: string }>;
      };
      const postData = JSON.parse(toolResultMsg.content[0].content);

      expect(postData.id).toBe(mockPostData.id);
      expect(postData.title).toBe(mockPostData.title);
    });

    it("routes get_markdown through the real handler and returns markdown string", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-markdown",
              name: "get_markdown",
              input: { postId: "post-created-001" },
            },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("Markdown retrieved."));

      const response = streamBlogWriter({ workspaceId, insightId });
      await collectSSEEvents(response);

      expect(mockFindFirstPost).toHaveBeenCalledTimes(1);

      const secondCallMessages = (
        mockCreate.mock.calls[1][0] as { messages: unknown[] }
      ).messages;
      const toolResultMsg = secondCallMessages[2] as {
        content: Array<{ content: string }>;
      };
      // get_markdown returns raw markdown string, serialised to JSON
      const markdown = JSON.parse(toolResultMsg.content[0].content);
      expect(typeof markdown).toBe("string");
    });

    it("routes update_post through the real handler and returns updated post", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-update",
              name: "update_post",
              input: { postId: "post-created-001", title: "Updated Title" },
            },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("Post updated."));

      const response = streamBlogWriter({ workspaceId, insightId });
      await collectSSEEvents(response);

      expect(mockDbUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdateSet).toHaveBeenCalledTimes(1);
    });

    it("propagates post-not-found error as an error tool result", async () => {
      mockFindFirstPost.mockImplementation(async () => undefined);

      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-no-post",
              name: "get_post",
              input: { postId: "nonexistent-post" },
            },
          ])
        )
        .mockImplementationOnce(async () =>
          makeTextResponse("Post not found, creating a fresh one.")
        );

      const response = streamBlogWriter({ workspaceId, insightId });
      const events = await collectSSEEvents(response);

      const textEvent = events.find((e) => e.event === "text");
      expect((textEvent!.data as { content: string }).content).toBe(
        "Post not found, creating a fresh one."
      );

      const secondCallMessages = (
        mockCreate.mock.calls[1][0] as { messages: unknown[] }
      ).messages;
      const toolResultMsg = secondCallMessages[2] as {
        content: Array<{ is_error?: boolean; content: string }>;
      };
      const errorResult = toolResultMsg.content[0];
      expect(errorResult.is_error).toBe(true);
      expect(errorResult.content).toContain("not found");
    });

    it("computes word count correctly when creating a post", async () => {
      const markdown = "The quick brown fox jumps over the lazy dog";

      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-wc",
              name: "create_post",
              input: {
                title: "Word Count Test",
                markdown,
                contentType: "blog_post",
              },
            },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"));

      const response = streamBlogWriter({ workspaceId, insightId });
      await collectSSEEvents(response);

      const insertedRecord = mockInsertValues.mock.calls[0][0] as {
        wordCount: number;
      };
      // 9 words in the markdown string
      expect(insertedRecord.wordCount).toBe(9);
    });

    it("passes workspaceId from blog writer input to createPost (not from tool input)", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-ws",
              name: "create_post",
              input: {
                title: "Workspace Test Post",
                markdown: "Testing workspace propagation.",
                contentType: "blog_post",
              },
            },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"));

      const response = streamBlogWriter({
        workspaceId: "ws-specific-test",
        insightId,
      });
      await collectSSEEvents(response);

      const insertedRecord = mockInsertValues.mock.calls[0][0] as {
        workspaceId: string;
      };
      expect(insertedRecord.workspaceId).toBe("ws-specific-test");
    });
  });

  // -------------------------------------------------------------------------
  // Skill loader tool handler integration
  // -------------------------------------------------------------------------

  describe("skill loader tool pipeline", () => {
    it("routes list_available_skills through the real handler gracefully", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-skills",
              name: "list_available_skills",
              input: {},
            },
          ])
        )
        .mockImplementationOnce(async () =>
          makeTextResponse("Skills listed successfully.")
        );

      const response = streamBlogWriter({ workspaceId, insightId });
      const events = await collectSSEEvents(response);

      const textEvent = events.find((e) => e.event === "text");
      expect((textEvent!.data as { content: string }).content).toBe(
        "Skills listed successfully."
      );
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it("routes get_skill_by_name through the real handler gracefully", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-skill",
              name: "get_skill_by_name",
              input: { name: "nonexistent-skill" },
            },
          ])
        )
        .mockImplementationOnce(async () =>
          makeTextResponse("Skill not found, proceeding without it.")
        );

      const response = streamBlogWriter({ workspaceId, insightId });
      const events = await collectSSEEvents(response);

      const textEvent = events.find((e) => e.event === "text");
      expect((textEvent!.data as { content: string }).content).toBe(
        "Skill not found, proceeding without it."
      );
    });
  });

  // -------------------------------------------------------------------------
  // Tone and custom instructions
  // -------------------------------------------------------------------------

  describe("tone and custom instructions", () => {
    it("uses the technical system prompt by default", async () => {
      mockCreate.mockImplementationOnce(async () => makeTextResponse("done"));

      const response = streamBlogWriter({ workspaceId, insightId });
      await collectSSEEvents(response);

      const firstCall = mockCreate.mock.calls[0][0] as { system: string };
      expect(firstCall.system).toBe("You are a technical blog writer.");
    });

    it("uses the tutorial system prompt when tone is tutorial", async () => {
      mockCreate.mockImplementationOnce(async () => makeTextResponse("done"));

      const response = streamBlogWriter({
        workspaceId,
        insightId,
        tone: "tutorial",
      });
      await collectSSEEvents(response);

      const firstCall = mockCreate.mock.calls[0][0] as { system: string };
      expect(firstCall.system).toBe("You are a tutorial blog writer.");
    });

    it("uses the conversational system prompt when tone is conversational", async () => {
      mockCreate.mockImplementationOnce(async () => makeTextResponse("done"));

      const response = streamBlogWriter({
        workspaceId,
        insightId,
        tone: "conversational",
      });
      await collectSSEEvents(response);

      const firstCall = mockCreate.mock.calls[0][0] as { system: string };
      expect(firstCall.system).toBe("You are a conversational blog writer.");
    });

    it("appends custom instructions to the user message when provided", async () => {
      mockCreate.mockImplementationOnce(async () => makeTextResponse("done"));

      const customInstructions = "Focus on beginner-friendly explanations.";
      const response = streamBlogWriter({
        workspaceId,
        insightId,
        customInstructions,
      });
      await collectSSEEvents(response);

      const firstCall = mockCreate.mock.calls[0][0] as {
        messages: Array<{ role: string; content: string }>;
      };
      const userMessage = firstCall.messages[0].content;
      expect(userMessage).toContain(customInstructions);
    });

    it("includes the insight ID in the user message without custom instructions", async () => {
      mockCreate.mockImplementationOnce(async () => makeTextResponse("done"));

      const response = streamBlogWriter({ workspaceId, insightId });
      await collectSSEEvents(response);

      const firstCall = mockCreate.mock.calls[0][0] as {
        messages: Array<{ role: string; content: string }>;
      };
      const userMessage = firstCall.messages[0].content;
      expect(userMessage).toContain(insightId);
    });

    it("passes system prompt on every API call throughout the pipeline", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-1",
              name: "get_insight_details",
              input: { insightId },
            },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"));

      const response = streamBlogWriter({
        workspaceId,
        insightId,
        tone: "tutorial",
      });
      await collectSSEEvents(response);

      for (const call of mockCreate.mock.calls) {
        expect((call[0] as { system: string }).system).toBe(
          "You are a tutorial blog writer."
        );
      }
    });
  });

  // -------------------------------------------------------------------------
  // Parallel tool dispatch integration
  // -------------------------------------------------------------------------

  describe("parallel tool dispatch integration", () => {
    it("dispatches multiple tools concurrently and collects all results", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-a",
              name: "get_insight_details",
              input: { insightId },
            },
            {
              id: "tu-b",
              name: "get_top_insights",
              input: { limit: 3 },
            },
          ])
        )
        .mockImplementationOnce(async () =>
          makeTextResponse("Analysed insight alongside top performers.")
        );

      const response = streamBlogWriter({ workspaceId, insightId });
      const events = await collectSSEEvents(response);

      const textEvent = events.find((e) => e.event === "text");
      expect((textEvent!.data as { content: string }).content).toBe(
        "Analysed insight alongside top performers."
      );

      // Both real handlers were called
      expect(mockFindFirstInsight).toHaveBeenCalledTimes(1);
      expect(mockFindManyInsights).toHaveBeenCalledTimes(1);

      // Both tool results appear in the next API call
      const secondCallMessages = (
        mockCreate.mock.calls[1][0] as { messages: unknown[] }
      ).messages;
      const toolResultMsg = secondCallMessages[2] as {
        role: string;
        content: unknown[];
      };
      expect(toolResultMsg.content).toHaveLength(2);
    });

    it("returns correct tool_use_id for each parallel tool result", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "id-insight",
              name: "get_insight_details",
              input: { insightId },
            },
            {
              id: "id-session",
              name: "get_session_summary",
              input: { sessionId: "session-xyz-001" },
            },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"));

      const response = streamBlogWriter({ workspaceId, insightId });
      await collectSSEEvents(response);

      const secondCallMessages = (
        mockCreate.mock.calls[1][0] as { messages: unknown[] }
      ).messages;
      const toolResultMsg = secondCallMessages[2] as {
        content: Array<{ type: string; tool_use_id: string }>;
      };

      const ids = toolResultMsg.content.map((c) => c.tool_use_id);
      expect(ids).toContain("id-insight");
      expect(ids).toContain("id-session");
    });

    it("emits tool_use events for each tool call in a parallel batch", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-a",
              name: "get_insight_details",
              input: { insightId },
            },
            {
              id: "tu-b",
              name: "get_session_summary",
              input: { sessionId: "session-xyz-001" },
            },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"));

      const response = streamBlogWriter({ workspaceId, insightId });
      const events = await collectSSEEvents(response);

      const toolUseEvents = events.filter((e) => e.event === "tool_use");
      expect(toolUseEvents).toHaveLength(2);

      const toolNames = toolUseEvents.map((e) => (e.data as { tool: string }).tool);
      expect(toolNames).toContain("get_insight_details");
      expect(toolNames).toContain("get_session_summary");
    });
  });

  // -------------------------------------------------------------------------
  // API call structure through the pipeline
  // -------------------------------------------------------------------------

  describe("API call structure through the pipeline", () => {
    it("grows message history correctly across multiple tool-use rounds", async () => {
      const capturedMessageLengths: number[] = [];

      mockCreate
        .mockImplementationOnce(async (args: { messages: unknown[] }) => {
          capturedMessageLengths.push(args.messages.length);
          return makeToolUseResponse([
            { id: "tu-1", name: "get_insight_details", input: { insightId } },
          ]);
        })
        .mockImplementationOnce(async (args: { messages: unknown[] }) => {
          capturedMessageLengths.push(args.messages.length);
          return makeToolUseResponse([
            {
              id: "tu-2",
              name: "get_session_summary",
              input: { sessionId: "session-xyz-001" },
            },
          ]);
        })
        .mockImplementationOnce(async (args: { messages: unknown[] }) => {
          capturedMessageLengths.push(args.messages.length);
          return makeTextResponse("Final blog post.");
        });

      const response = streamBlogWriter({ workspaceId, insightId });
      await collectSSEEvents(response);

      expect(capturedMessageLengths).toHaveLength(3);

      // Round 1: [user]
      expect(capturedMessageLengths[0]).toBe(1);

      // Round 2: [user, assistant(tool_use), user(tool_result)]
      expect(capturedMessageLengths[1]).toBe(3);

      // Round 3: [user, assistant, user, assistant(tool_use), user(tool_result)]
      expect(capturedMessageLengths[2]).toBe(5);
    });

    it("emits tool_result events for successful tool calls", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-1",
              name: "get_insight_details",
              input: { insightId },
            },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"));

      const response = streamBlogWriter({ workspaceId, insightId });
      const events = await collectSSEEvents(response);

      const toolResultEvent = events.find((e) => e.event === "tool_result");
      expect(toolResultEvent).toBeDefined();
      expect((toolResultEvent!.data as { tool: string; success: boolean }).tool).toBe(
        "get_insight_details"
      );
      expect((toolResultEvent!.data as { success: boolean }).success).toBe(true);
    });

    it("emits tool_result event with success:false when a tool handler throws", async () => {
      mockFindFirstInsight.mockImplementation(async () => undefined);

      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-err",
              name: "get_insight_details",
              input: { insightId: "bad-id" },
            },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"));

      const response = streamBlogWriter({ workspaceId, insightId });
      const events = await collectSSEEvents(response);

      const toolResultEvent = events.find((e) => e.event === "tool_result");
      expect(toolResultEvent).toBeDefined();
      expect((toolResultEvent!.data as { success: boolean }).success).toBe(false);
      expect((toolResultEvent!.data as { error: string }).error).toContain("not found");
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe("error handling", () => {
    it("emits an error event when the Anthropic API call throws", async () => {
      mockCreate.mockImplementationOnce(async () => {
        throw new Error("API rate limit exceeded");
      });

      const response = streamBlogWriter({ workspaceId, insightId });
      const events = await collectSSEEvents(response);

      const errorEvent = events.find((e) => e.event === "error");
      expect(errorEvent).toBeDefined();
      expect((errorEvent!.data as { message: string }).message).toBe(
        "API rate limit exceeded"
      );
    });

    it("still emits a done event after an error", async () => {
      mockCreate.mockImplementationOnce(async () => {
        throw new Error("Network failure");
      });

      const response = streamBlogWriter({ workspaceId, insightId });
      const events = await collectSSEEvents(response);

      const doneEvent = events.find((e) => e.event === "done");
      expect(doneEvent).toBeDefined();
    });

    it("handles unknown tool name by emitting a tool_result error event", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-unknown",
              name: "unknown_tool_name",
              input: {},
            },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("Handled error."));

      const response = streamBlogWriter({ workspaceId, insightId });
      const events = await collectSSEEvents(response);

      const toolResultEvent = events.find((e) => e.event === "tool_result");
      expect(toolResultEvent).toBeDefined();
      expect((toolResultEvent!.data as { success: boolean }).success).toBe(false);
      expect(
        (toolResultEvent!.data as { error: string }).error
      ).toContain("Unknown tool");
    });
  });

  // -------------------------------------------------------------------------
  // Realistic end-to-end scenario
  // -------------------------------------------------------------------------

  describe("realistic end-to-end scenario", () => {
    it("processes a complete blog writing workflow from insight to published draft", async () => {
      const blogMarkdown =
        "# The Read-Glob Pipeline Pattern\n\n" +
        "When working with large codebases, combining Read and Glob tools reduces API round-trips significantly.\n\n" +
        "## How It Works\n\n" +
        "First, use Glob to discover files matching your pattern. Then batch-read them with Read.\n\n" +
        "## Example\n\n" +
        "```typescript\n" +
        "const files = await Glob('**/*.ts');\n" +
        "const contents = await Promise.all(files.map(f => Read(f)));\n" +
        "```\n\n" +
        "This approach is 3x faster than sequential reads.";

      mockCreate
        .mockImplementationOnce(async () =>
          // Step 1: Fetch the insight
          makeToolUseResponse([
            {
              id: "step-1",
              name: "get_insight_details",
              input: { insightId },
            },
          ])
        )
        .mockImplementationOnce(async () =>
          // Step 2: Fetch the related session for concrete examples
          makeToolUseResponse([
            {
              id: "step-2",
              name: "get_session_summary",
              input: { sessionId: "session-xyz-001" },
            },
          ])
        )
        .mockImplementationOnce(async () =>
          // Step 3: Create the blog post
          makeToolUseResponse([
            {
              id: "step-3",
              name: "create_post",
              input: {
                title: "The Read-Glob Pipeline Pattern",
                markdown: blogMarkdown,
                contentType: "blog_post",
                insightId,
                toneUsed: "technical",
                sourceMetadata: {
                  sessionIds: ["session-xyz-001"],
                  insightIds: [insightId],
                  generatedBy: "blog_writer",
                },
              },
            },
          ])
        )
        .mockImplementationOnce(async () =>
          // Step 4: Final response
          makeTextResponse(
            "I have written and saved a comprehensive technical blog post about the Read-Glob pipeline pattern, drawing from the session data and insight details."
          )
        );

      const response = streamBlogWriter({
        workspaceId,
        insightId,
        tone: "technical",
        customInstructions: "Include code examples.",
      });
      const events = await collectSSEEvents(response);

      // Four API calls: initial → after insight fetch → after session fetch → after post creation
      expect(mockCreate).toHaveBeenCalledTimes(4);

      // Insight and session were queried
      expect(mockFindFirstInsight).toHaveBeenCalledTimes(1);
      expect(mockFindFirstSession).toHaveBeenCalledTimes(1);

      // Post was inserted
      expect(mockDbInsert).toHaveBeenCalledTimes(1);
      const insertedRecord = mockInsertValues.mock.calls[0][0] as {
        workspaceId: string;
        contentType: string;
        title: string;
        wordCount: number;
        insightId: string;
      };
      expect(insertedRecord.workspaceId).toBe(workspaceId);
      expect(insertedRecord.contentType).toBe("blog_post");
      expect(insertedRecord.title).toBe("The Read-Glob Pipeline Pattern");
      expect(insertedRecord.wordCount).toBeGreaterThan(0);
      expect(insertedRecord.insightId).toBe(insightId);

      // SSE events check
      const textEvent = events.find((e) => e.event === "text");
      expect((textEvent!.data as { content: string }).content).toContain(
        "comprehensive technical blog post"
      );

      const completeEvent = events.find((e) => e.event === "complete");
      expect(completeEvent).toBeDefined();
      expect((completeEvent!.data as { usage: unknown }).usage).toBeDefined();

      // Final done event
      const lastEvent = events[events.length - 1];
      expect(lastEvent.event).toBe("done");

      // Technical prompt was used throughout
      for (const call of mockCreate.mock.calls) {
        expect((call[0] as { system: string }).system).toBe(
          "You are a technical blog writer."
        );
      }
    });
  });
});
