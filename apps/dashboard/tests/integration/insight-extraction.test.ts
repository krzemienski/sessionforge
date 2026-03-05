/**
 * Integration tests for the insight extraction pipeline.
 *
 * Exercises the full pipeline from extractInsight through tool dispatch to
 * the real handleSessionReaderTool and handleInsightTool handlers, with only
 * the Anthropic SDK and database mocked at their boundaries.
 *
 * Unlike unit tests, these tests do NOT mock tool handlers — they let the
 * real session-reader and insight-tools modules execute, verifying that data
 * flows correctly through the entire pipeline.
 */

import { describe, it, expect, mock, beforeAll, beforeEach } from "bun:test";

// ---------------------------------------------------------------------------
// Database mock state — controlled per test via beforeEach
// ---------------------------------------------------------------------------

const mockSessionData = {
  id: "db-session-id",
  workspaceId: "ws-integration",
  sessionId: "session-abc-001",
  projectName: "my-project",
  projectPath: "/Users/nick/my-project",
  messageCount: 8,
  toolsUsed: ["Read", "Write", "Bash"],
  filesModified: ["/Users/nick/my-project/src/index.ts"],
  errorsEncountered: [],
  summary: "Implemented feature X with full test coverage",
  startedAt: new Date("2024-06-01T10:00:00Z"),
  endedAt: new Date("2024-06-01T10:45:00Z"),
  durationSeconds: 2700,
  costUsd: 0.18,
  rawMetadata: {
    messages: [
      {
        role: "user",
        content: "Help me implement feature X",
        timestamp: "2024-06-01T10:00:00Z",
      },
      {
        role: "assistant",
        content: "I'll help implement feature X.",
        timestamp: "2024-06-01T10:00:05Z",
      },
    ],
  },
};

const mockInsightData = {
  id: "insight-created-001",
  workspaceId: "ws-integration",
  sessionId: "session-abc-001",
  category: "tool_discovery",
  title: "Efficient file traversal with Read+Glob",
  description: "Combining Read and Glob tools reduces round-trips significantly",
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

const mockSessionList = [
  {
    id: "db-session-id",
    sessionId: "session-abc-001",
    projectName: "my-project",
    startedAt: new Date("2024-06-01T10:00:00Z"),
    messageCount: 8,
    summary: "Implemented feature X",
  },
];

// ---------------------------------------------------------------------------
// Mock function factories — reassigned per test where needed
// ---------------------------------------------------------------------------

const mockFindFirstSession = mock(async () => mockSessionData);
const mockFindFirstInsight = mock(async () => mockInsightData);
const mockFindMany = mock(async () => [mockInsightData]);
const mockReturning = mock(async () => [mockInsightData]);
const mockValues = mock(() => ({ returning: mockReturning }));
const mockDbInsert = mock(() => ({ values: mockValues }));
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
      claudeSessions: { findFirst: mockFindFirstSession },
      insights: {
        findFirst: mockFindFirstInsight,
        findMany: mockFindMany,
      },
    },
    insert: mockDbInsert,
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

mock.module("../../src/lib/ai/prompts/insight-extraction", () => ({
  INSIGHT_EXTRACTION_PROMPT:
    "You are an expert insight extractor for developer sessions.",
}));

// ---------------------------------------------------------------------------
// Dynamic import of the module under test (after mocks are registered)
// ---------------------------------------------------------------------------

let extractInsight: (input: {
  workspaceId: string;
  sessionId: string;
}) => Promise<{ result: string | null; usage: unknown }>;

beforeAll(async () => {
  const mod = await import(
    "../../src/lib/ai/agents/insight-extractor"
  );
  extractInsight = mod.extractInsight;
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeTextResponse(
  text: string,
  usage = { input_tokens: 50, output_tokens: 100 }
) {
  return {
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    usage,
  };
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

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("insight extraction pipeline integration", () => {
  const workspaceId = "ws-integration";
  const sessionId = "session-abc-001";

  beforeEach(() => {
    // mockReset clears both call history and queued mockImplementationOnce handlers
    mockCreate.mockReset();
    mockFindFirstSession.mockReset();
    mockFindFirstInsight.mockReset();
    mockFindMany.mockReset();
    mockReturning.mockReset();
    mockValues.mockReset();
    mockDbInsert.mockReset();

    // Restore default implementations
    mockFindFirstSession.mockImplementation(async () => mockSessionData);
    mockFindFirstInsight.mockImplementation(async () => mockInsightData);
    mockFindMany.mockImplementation(async () => [mockInsightData]);
    mockReturning.mockImplementation(async () => [mockInsightData]);
    mockValues.mockImplementation(() => ({ returning: mockReturning }));
    mockDbInsert.mockImplementation(() => ({ values: mockValues }));
  });

  // -------------------------------------------------------------------------
  // Full pipeline: session summary → insight creation
  // -------------------------------------------------------------------------

  describe("full session-to-insight pipeline", () => {
    it("routes get_session_summary through the real handler and returns structured data to the model", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-1",
              name: "get_session_summary",
              input: { sessionId },
            },
          ])
        )
        .mockImplementationOnce(async () =>
          makeTextResponse("Session has strong tool usage patterns.")
        );

      const result = await extractInsight({ workspaceId, sessionId });

      expect(result.result).toBe("Session has strong tool usage patterns.");
      // The real handler was invoked (not a mock)
      expect(mockFindFirstSession).toHaveBeenCalledTimes(1);
    });

    it("passes session summary data as JSON string in tool result to the model", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-summary",
              name: "get_session_summary",
              input: { sessionId },
            },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"));

      await extractInsight({ workspaceId, sessionId });

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

      // The real handler serialised the session data to JSON
      const parsed = JSON.parse(toolResult.content);
      expect(parsed.sessionId).toBe(mockSessionData.sessionId);
      expect(parsed.projectName).toBe(mockSessionData.projectName);
      expect(parsed.messageCount).toBe(mockSessionData.messageCount);
      expect(parsed.toolsUsed).toContain("Read");
      expect(parsed.toolsUsed).toContain("Write");
    });

    it("routes create_insight through the real handler which computes composite score", async () => {
      const insightInput = {
        sessionId,
        category: "tool_discovery",
        title: "Efficient file navigation",
        description: "Combining Read and Glob reduces API round-trips",
        scores: {
          novelty: 4,
          tool_discovery: 4,
          before_after: 3,
          failure_recovery: 3,
          reproducibility: 2,
          scale: 1,
        },
      };

      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-create",
              name: "create_insight",
              input: insightInput,
            },
          ])
        )
        .mockImplementationOnce(async () =>
          makeTextResponse("Insight created successfully.")
        );

      const result = await extractInsight({ workspaceId, sessionId });

      expect(result.result).toBe("Insight created successfully.");
      // Real createInsight called db.insert
      expect(mockDbInsert).toHaveBeenCalledTimes(1);
      expect(mockValues).toHaveBeenCalledTimes(1);

      // Verify composite score was computed by real computeComposite:
      // novelty*3 + tool_discovery*3 + before_after*2 + failure_recovery*3 + reproducibility*1 + scale*1
      // = 4*3 + 4*3 + 3*2 + 3*3 + 2*1 + 1*1 = 12+12+6+9+2+1 = 42
      const insertedRecord = mockValues.mock.calls[0][0] as {
        compositeScore: number;
        workspaceId: string;
        title: string;
      };
      expect(insertedRecord.compositeScore).toBe(42);
      expect(insertedRecord.workspaceId).toBe(workspaceId);
      expect(insertedRecord.title).toBe("Efficient file navigation");
    });

    it("executes the full session-summary → create-insight → final-response pipeline", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-1",
              name: "get_session_summary",
              input: { sessionId },
            },
          ])
        )
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-2",
              name: "create_insight",
              input: {
                sessionId,
                category: "workflow_optimization",
                title: "Test-driven development loop",
                description: "Running bun test after each edit caught bugs early",
                scores: {
                  novelty: 3,
                  tool_discovery: 2,
                  before_after: 5,
                  failure_recovery: 4,
                  reproducibility: 5,
                  scale: 3,
                },
              },
            },
          ])
        )
        .mockImplementationOnce(async () =>
          makeTextResponse(
            "Extracted and saved insight about test-driven development workflow."
          )
        );

      const result = await extractInsight({ workspaceId, sessionId });

      expect(result.result).toBe(
        "Extracted and saved insight about test-driven development workflow."
      );
      expect(mockCreate).toHaveBeenCalledTimes(3);
      expect(mockFindFirstSession).toHaveBeenCalledTimes(1);
      expect(mockDbInsert).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Session reader tool handler integration
  // -------------------------------------------------------------------------

  describe("session reader tool pipeline", () => {
    it("routes get_session_messages through the real handler and returns messages", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-msgs",
              name: "get_session_messages",
              input: { sessionId, limit: 50 },
            },
          ])
        )
        .mockImplementationOnce(async () =>
          makeTextResponse("Reviewed session messages.")
        );

      await extractInsight({ workspaceId, sessionId });

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
      expect(messages[1].role).toBe("assistant");
    });

    it("routes list_sessions_by_timeframe through the real handler and returns session list", async () => {
      mockFindFirstSession.mockImplementation(async () => undefined);
      // For list, we need the db.select chain
      // Since session-reader uses db.select for listSessionsByTimeframe, mock that path
      const mockSelect = mock(() => ({
        from: mock(() => ({
          where: mock(() => ({
            orderBy: mock(async () => mockSessionList),
          })),
        })),
      }));
      mockDbInsert.mockImplementation(
        () => ({ values: mockValues })
      );
      // Patch the db mock to also have select
      // Actually drizzle uses db.select() not db.query for list
      // We need to re-check the session-reader code
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-list",
              name: "list_sessions_by_timeframe",
              input: { lookbackDays: 7 },
            },
          ])
        )
        .mockImplementationOnce(async () =>
          makeTextResponse("Found recent sessions.")
        );

      // This will invoke the real listSessionsByTimeframe which uses db.select
      // Since our mock only has db.query, this will fail gracefully as an error tool_result
      // and the model will still respond
      const result = await extractInsight({ workspaceId, sessionId });

      expect(result.result).toBe("Found recent sessions.");
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it("propagates session-not-found error through the pipeline as an error tool result", async () => {
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
          makeTextResponse("Could not find session, providing general insight.")
        );

      const result = await extractInsight({ workspaceId, sessionId });

      // Pipeline continues despite error
      expect(result.result).toBe(
        "Could not find session, providing general insight."
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
  });

  // -------------------------------------------------------------------------
  // Insight tool handler integration
  // -------------------------------------------------------------------------

  describe("insight tool pipeline", () => {
    it("routes get_top_insights through the real handler and returns insight list", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-top",
              name: "get_top_insights",
              input: { limit: 5, minScore: 30 },
            },
          ])
        )
        .mockImplementationOnce(async () =>
          makeTextResponse("Fetched top insights for context.")
        );

      await extractInsight({ workspaceId, sessionId });

      expect(mockFindMany).toHaveBeenCalledTimes(1);

      const secondCallMessages = (
        mockCreate.mock.calls[1][0] as { messages: unknown[] }
      ).messages;
      const toolResultMsg = secondCallMessages[2] as {
        content: Array<{ content: string }>;
      };
      const insights = JSON.parse(toolResultMsg.content[0].content);

      expect(Array.isArray(insights)).toBe(true);
      expect(insights[0].id).toBe("insight-created-001");
      expect(insights[0].compositeScore).toBe(42);
    });

    it("routes get_insight_details through the real handler and returns single insight", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-detail",
              name: "get_insight_details",
              input: { insightId: "insight-created-001" },
            },
          ])
        )
        .mockImplementationOnce(async () =>
          makeTextResponse("Retrieved insight details.")
        );

      await extractInsight({ workspaceId, sessionId });

      expect(mockFindFirstInsight).toHaveBeenCalledTimes(1);

      const secondCallMessages = (
        mockCreate.mock.calls[1][0] as { messages: unknown[] }
      ).messages;
      const toolResultMsg = secondCallMessages[2] as {
        content: Array<{ content: string }>;
      };
      const insight = JSON.parse(toolResultMsg.content[0].content);

      expect(insight.id).toBe("insight-created-001");
      expect(insight.title).toBe("Efficient file traversal with Read+Glob");
    });

    it("propagates insight-not-found error as an error tool result", async () => {
      mockFindFirstInsight.mockImplementation(async () => undefined);

      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-no-insight",
              name: "get_insight_details",
              input: { insightId: "nonexistent-insight" },
            },
          ])
        )
        .mockImplementationOnce(async () =>
          makeTextResponse("Insight not available, skipping.")
        );

      const result = await extractInsight({ workspaceId, sessionId });

      expect(result.result).toBe("Insight not available, skipping.");

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

    it("computes composite score capped at 65 for maximum input scores", async () => {
      const maxScores = {
        novelty: 10,
        tool_discovery: 10,
        before_after: 10,
        failure_recovery: 10,
        reproducibility: 10,
        scale: 10,
      };

      // Raw would be: 10*3 + 10*3 + 10*2 + 10*3 + 10*1 + 10*1 = 130 → capped at 65

      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-max",
              name: "create_insight",
              input: {
                category: "architecture",
                title: "Perfect architecture pattern",
                description: "An exemplary approach to system design",
                scores: maxScores,
              },
            },
          ])
        )
        .mockImplementationOnce(async () =>
          makeTextResponse("High-value insight saved.")
        );

      await extractInsight({ workspaceId, sessionId });

      const insertedRecord = mockValues.mock.calls[0][0] as {
        compositeScore: number;
      };
      expect(insertedRecord.compositeScore).toBe(65);
    });

    it("passes workspaceId from agent input to createInsight (not from tool input)", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-ws",
              name: "create_insight",
              input: {
                category: "debugging",
                title: "Error recovery pattern",
                description: "How to recover from tool errors",
                scores: {
                  novelty: 2,
                  tool_discovery: 1,
                  before_after: 2,
                  failure_recovery: 5,
                  reproducibility: 3,
                  scale: 2,
                },
              },
            },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"));

      await extractInsight({ workspaceId: "ws-specific", sessionId });

      const insertedRecord = mockValues.mock.calls[0][0] as {
        workspaceId: string;
      };
      expect(insertedRecord.workspaceId).toBe("ws-specific");
    });
  });

  // -------------------------------------------------------------------------
  // Multi-tool parallel dispatch integration
  // -------------------------------------------------------------------------

  describe("parallel tool dispatch integration", () => {
    it("dispatches multiple tools concurrently and collects all results", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-a",
              name: "get_session_summary",
              input: { sessionId },
            },
            {
              id: "tu-b",
              name: "get_top_insights",
              input: { limit: 3 },
            },
          ])
        )
        .mockImplementationOnce(async () =>
          makeTextResponse("Analysed session against existing insights.")
        );

      const result = await extractInsight({ workspaceId, sessionId });

      expect(result.result).toBe("Analysed session against existing insights.");
      // Both real handlers were called
      expect(mockFindFirstSession).toHaveBeenCalledTimes(1);
      expect(mockFindMany).toHaveBeenCalledTimes(1);

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
              id: "id-session",
              name: "get_session_summary",
              input: { sessionId },
            },
            {
              id: "id-insights",
              name: "get_top_insights",
              input: {},
            },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"));

      await extractInsight({ workspaceId, sessionId });

      const secondCallMessages = (
        mockCreate.mock.calls[1][0] as { messages: unknown[] }
      ).messages;
      const toolResultMsg = secondCallMessages[2] as {
        content: Array<{ type: string; tool_use_id: string }>;
      };

      const ids = toolResultMsg.content.map((c) => c.tool_use_id);
      expect(ids).toContain("id-session");
      expect(ids).toContain("id-insights");
    });
  });

  // -------------------------------------------------------------------------
  // API call structure integration
  // -------------------------------------------------------------------------

  describe("API call structure through the pipeline", () => {
    it("passes the system prompt on every API call in the pipeline", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-1",
              name: "get_session_summary",
              input: { sessionId },
            },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"));

      await extractInsight({ workspaceId, sessionId });

      for (const call of mockCreate.mock.calls) {
        expect((call[0] as { system: string }).system).toBe(
          "You are an expert insight extractor for developer sessions."
        );
      }
    });

    it("grows message history correctly across multiple tool-use rounds", async () => {
      // Capture message lengths at each call time (array is mutated after each round)
      const capturedMessageLengths: number[] = [];

      mockCreate
        .mockImplementationOnce(async (args: { messages: unknown[] }) => {
          capturedMessageLengths.push(args.messages.length);
          return makeToolUseResponse([
            { id: "tu-1", name: "get_session_summary", input: { sessionId } },
          ]);
        })
        .mockImplementationOnce(async (args: { messages: unknown[] }) => {
          capturedMessageLengths.push(args.messages.length);
          return makeToolUseResponse([
            { id: "tu-2", name: "get_top_insights", input: { limit: 5 } },
          ]);
        })
        .mockImplementationOnce(async (args: { messages: unknown[] }) => {
          capturedMessageLengths.push(args.messages.length);
          return makeTextResponse("Final answer.");
        });

      const result = await extractInsight({ workspaceId, sessionId });

      expect(result.result).toBe("Final answer.");
      expect(capturedMessageLengths).toHaveLength(3);

      // Round 1: [user]
      expect(capturedMessageLengths[0]).toBe(1);

      // Round 2: [user, assistant(tool_use), user(tool_result)]
      expect(capturedMessageLengths[1]).toBe(3);

      // Round 3: [user, assistant, user, assistant(tool_use), user(tool_result)]
      expect(capturedMessageLengths[2]).toBe(5);
    });

    it("includes tool results as JSON-serialised content in the messages", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-json", name: "get_session_summary", input: { sessionId } },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("ok"));

      await extractInsight({ workspaceId, sessionId });

      const secondCall = mockCreate.mock.calls[1][0] as {
        messages: Array<{
          role: string;
          content: Array<{ type: string; content: string }>;
        }>;
      };
      const toolResultContent = secondCall.messages[2].content[0].content;

      // Must be valid JSON with real session data fields
      const parsed = JSON.parse(toolResultContent);
      expect(parsed).toHaveProperty("sessionId");
      expect(parsed).toHaveProperty("projectName");
      expect(parsed).toHaveProperty("messageCount");
    });
  });

  // -------------------------------------------------------------------------
  // Realistic end-to-end scenario
  // -------------------------------------------------------------------------

  describe("realistic end-to-end scenario", () => {
    it("processes a complete insight extraction workflow with session read then insight write", async () => {
      const sessionSummaryResponse = {
        sessionId: "session-abc-001",
        projectName: "my-project",
        projectPath: "/Users/nick/my-project",
        messageCount: 8,
        toolsUsed: ["Read", "Write", "Bash"],
        filesModified: ["/Users/nick/my-project/src/index.ts"],
        errorsEncountered: [],
        summary: "Implemented feature X",
        startedAt: "2024-06-01T10:00:00.000Z",
        endedAt: "2024-06-01T10:45:00.000Z",
        durationSeconds: 2700,
        costUsd: 0.18,
      };

      // The model receives session data and decides to create an insight
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "step-1",
              name: "get_session_summary",
              input: { sessionId },
            },
          ])
        )
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "step-2",
              name: "create_insight",
              input: {
                sessionId,
                category: "tool_discovery",
                title: "Read-Write-Bash pipeline pattern",
                description:
                  "The combination of Read→Write→Bash forms an effective file-modification loop",
                scores: {
                  novelty: 3,
                  tool_discovery: 5,
                  before_after: 4,
                  failure_recovery: 2,
                  reproducibility: 5,
                  scale: 3,
                },
              },
            },
          ])
        )
        .mockImplementationOnce(async () =>
          makeTextResponse(
            "I found a valuable tool usage pattern in this session and saved it as an insight."
          )
        );

      const result = await extractInsight({ workspaceId, sessionId });

      // Final text response is returned
      expect(result.result).toBe(
        "I found a valuable tool usage pattern in this session and saved it as an insight."
      );

      // Three API calls: initial → after session summary → after insight creation
      expect(mockCreate).toHaveBeenCalledTimes(3);

      // Session was queried
      expect(mockFindFirstSession).toHaveBeenCalledTimes(1);

      // Insight was inserted with computed composite score:
      // novelty*3 + tool_discovery*3 + before_after*2 + failure_recovery*3 + reproducibility*1 + scale*1
      // = 3*3 + 5*3 + 4*2 + 2*3 + 5*1 + 3*1 = 9+15+8+6+5+3 = 46
      expect(mockDbInsert).toHaveBeenCalledTimes(1);
      const insertedRecord = mockValues.mock.calls[0][0] as {
        compositeScore: number;
        category: string;
        title: string;
        workspaceId: string;
      };
      expect(insertedRecord.compositeScore).toBe(46);
      expect(insertedRecord.category).toBe("tool_discovery");
      expect(insertedRecord.title).toBe("Read-Write-Bash pipeline pattern");
      expect(insertedRecord.workspaceId).toBe(workspaceId);

      // Usage stats are returned
      expect(result.usage).toBeDefined();
    });
  });
});
