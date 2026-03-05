/**
 * Unit tests for the insight extractor agent.
 *
 * Uses dynamic imports so that mock.module() calls are registered before the
 * module under test (and its dependencies) are loaded.
 */

import { describe, it, expect, mock, beforeAll, beforeEach } from "bun:test";

// --- Mock factory functions (stable references, reassigned per test) ---

const mockCreate = mock(async () => ({}));
const mockGetModelForAgent = mock(() => "claude-opus-4-6");
const mockGetToolsForAgent = mock(() => [] as unknown[]);
const mockHandleSessionReaderTool = mock(async () => ({ data: "session-data" }));
const mockHandleInsightTool = mock(async () => ({ id: "insight-123" }));

// --- Register module mocks BEFORE any dynamic import of the module under test ---

// NOTE: paths are relative to THIS test file (in __tests__/), not to insight-extractor.ts.
// __tests__/ → agents/ → ai/ so we need ../../ to reach ai/orchestration, ai/tools, etc.
mock.module("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

mock.module("../../orchestration/model-selector", () => ({
  getModelForAgent: mockGetModelForAgent,
}));

mock.module("../../orchestration/tool-registry", () => ({
  getToolsForAgent: mockGetToolsForAgent,
}));

mock.module("../../tools/session-reader", () => ({
  handleSessionReaderTool: mockHandleSessionReaderTool,
}));

mock.module("../../tools/insight-tools", () => ({
  handleInsightTool: mockHandleInsightTool,
}));

mock.module("../../prompts/insight-extraction", () => ({
  INSIGHT_EXTRACTION_PROMPT: "You are an insight extractor.",
}));

// --- Dynamic import of the module under test ---

let extractInsight: (input: { workspaceId: string; sessionId: string }) => Promise<{
  result: string | null;
  usage: unknown;
}>;

beforeAll(async () => {
  const mod = await import("../insight-extractor");
  extractInsight = mod.extractInsight;
});

// --- Helpers ---

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

// --- Tests ---

describe("extractInsight", () => {
  const workspaceId = "ws-abc";
  const sessionId = "sess-xyz";

  beforeEach(() => {
    mockCreate.mockClear();
    mockGetModelForAgent.mockClear();
    mockGetToolsForAgent.mockClear();
    mockHandleSessionReaderTool.mockClear();
    mockHandleInsightTool.mockClear();

    // Reset defaults
    mockGetModelForAgent.mockImplementation(() => "claude-opus-4-6");
    mockGetToolsForAgent.mockImplementation(() => []);
    mockHandleSessionReaderTool.mockImplementation(async () => ({ data: "session-data" }));
    mockHandleInsightTool.mockImplementation(async () => ({ id: "insight-123" }));
  });

  describe("successful direct response (no tool use)", () => {
    it("returns the text and usage when the model responds immediately", async () => {
      mockCreate.mockImplementation(async () =>
        makeTextResponse("This is a valuable insight about code quality.")
      );

      const result = await extractInsight({ workspaceId, sessionId });

      expect(result.result).toBe("This is a valuable insight about code quality.");
      expect(result.usage).toEqual({ input_tokens: 10, output_tokens: 20 });
    });

    it("calls getModelForAgent with insight-extractor", async () => {
      mockCreate.mockImplementation(async () => makeTextResponse("insight text"));

      await extractInsight({ workspaceId, sessionId });

      expect(mockGetModelForAgent).toHaveBeenCalledWith("insight-extractor");
    });

    it("calls getToolsForAgent with insight-extractor", async () => {
      mockCreate.mockImplementation(async () => makeTextResponse("insight text"));

      await extractInsight({ workspaceId, sessionId });

      expect(mockGetToolsForAgent).toHaveBeenCalledWith("insight-extractor");
    });

    it("sends the session ID in the initial user message", async () => {
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      await extractInsight({ workspaceId, sessionId: "my-session-42" });

      const firstCall = mockCreate.mock.calls[0][0] as {
        messages: Array<{ role: string; content: string }>;
      };
      const userMessage = firstCall.messages[0];
      expect(userMessage.role).toBe("user");
      expect(userMessage.content).toContain("my-session-42");
    });

    it("returns null result when the model produces no text block", async () => {
      mockCreate.mockImplementation(async () => ({
        content: [],
        stop_reason: "end_turn",
        usage: { input_tokens: 5, output_tokens: 0 },
      }));

      const result = await extractInsight({ workspaceId, sessionId });

      expect(result.result).toBeNull();
    });
  });

  describe("agentic tool-use loop", () => {
    it("dispatches a single tool call and then returns the final text", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-1", name: "get_session_summary", input: { sessionId } },
          ])
        )
        .mockImplementationOnce(async () =>
          makeTextResponse("Insight after reading summary.")
        );

      const result = await extractInsight({ workspaceId, sessionId });

      expect(result.result).toBe("Insight after reading summary.");
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(mockHandleSessionReaderTool).toHaveBeenCalledTimes(1);
    });

    it("handles multiple sequential rounds of tool calls before final response", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-1", name: "get_session_summary", input: { sessionId } },
          ])
        )
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-2",
              name: "create_insight",
              input: {
                title: "Insight",
                category: "tool_discovery",
                description: "desc",
                scores: {
                  novelty: 5,
                  tool_discovery: 5,
                  before_after: 3,
                  failure_recovery: 2,
                  reproducibility: 1,
                  scale: 1,
                },
              },
            },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("Final insight saved."));

      const result = await extractInsight({ workspaceId, sessionId });

      expect(result.result).toBe("Final insight saved.");
      expect(mockCreate).toHaveBeenCalledTimes(3);
      expect(mockHandleSessionReaderTool).toHaveBeenCalledTimes(1);
      expect(mockHandleInsightTool).toHaveBeenCalledTimes(1);
    });

    it("handles multiple tool calls in a single response (parallel dispatch)", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-1", name: "get_session_summary", input: { sessionId } },
            { id: "tu-2", name: "get_session_messages", input: { sessionId } },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("Done."));

      const result = await extractInsight({ workspaceId, sessionId });

      expect(result.result).toBe("Done.");
      expect(mockHandleSessionReaderTool).toHaveBeenCalledTimes(2);
    });

    it("includes tool results as user messages in subsequent API calls", async () => {
      mockHandleSessionReaderTool.mockImplementation(async () => ({
        data: "summary-result",
      }));

      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-99", name: "get_session_summary", input: { sessionId } },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"));

      await extractInsight({ workspaceId, sessionId });

      const secondCallMessages = (
        mockCreate.mock.calls[1][0] as { messages: unknown[] }
      ).messages;
      // initial user → assistant (tool_use) → user (tool_result)
      expect(secondCallMessages.length).toBe(3);

      const toolResultMessage = secondCallMessages[2] as {
        role: string;
        content: unknown[];
      };
      expect(toolResultMessage.role).toBe("user");

      const toolResult = toolResultMessage.content[0] as {
        type: string;
        tool_use_id: string;
        content: string;
      };
      expect(toolResult.type).toBe("tool_result");
      expect(toolResult.tool_use_id).toBe("tu-99");
      expect(toolResult.content).toContain("summary-result");
    });
  });

  describe("tool dispatch routing", () => {
    async function runWithSingleTool(toolName: string) {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-1", name: toolName, input: { sessionId } },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"));
      await extractInsight({ workspaceId, sessionId });
    }

    it("routes get_session_summary to handleSessionReaderTool", async () => {
      await runWithSingleTool("get_session_summary");
      expect(mockHandleSessionReaderTool).toHaveBeenCalledWith(
        workspaceId,
        "get_session_summary",
        expect.any(Object)
      );
      expect(mockHandleInsightTool).not.toHaveBeenCalled();
    });

    it("routes get_session_messages to handleSessionReaderTool", async () => {
      await runWithSingleTool("get_session_messages");
      expect(mockHandleSessionReaderTool).toHaveBeenCalledWith(
        workspaceId,
        "get_session_messages",
        expect.any(Object)
      );
    });

    it("routes list_sessions_by_timeframe to handleSessionReaderTool", async () => {
      await runWithSingleTool("list_sessions_by_timeframe");
      expect(mockHandleSessionReaderTool).toHaveBeenCalledWith(
        workspaceId,
        "list_sessions_by_timeframe",
        expect.any(Object)
      );
    });

    it("routes create_insight to handleInsightTool", async () => {
      await runWithSingleTool("create_insight");
      expect(mockHandleInsightTool).toHaveBeenCalledWith(
        workspaceId,
        "create_insight",
        expect.any(Object)
      );
      expect(mockHandleSessionReaderTool).not.toHaveBeenCalled();
    });

    it("routes get_top_insights to handleInsightTool", async () => {
      await runWithSingleTool("get_top_insights");
      expect(mockHandleInsightTool).toHaveBeenCalledWith(
        workspaceId,
        "get_top_insights",
        expect.any(Object)
      );
    });

    it("routes get_insight_details to handleInsightTool", async () => {
      await runWithSingleTool("get_insight_details");
      expect(mockHandleInsightTool).toHaveBeenCalledWith(
        workspaceId,
        "get_insight_details",
        expect.any(Object)
      );
    });

    it("passes the workspaceId to the session reader tool handler", async () => {
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

      await extractInsight({ workspaceId: "my-workspace", sessionId });

      expect(mockHandleSessionReaderTool).toHaveBeenCalledWith(
        "my-workspace",
        expect.any(String),
        expect.any(Object)
      );
    });

    it("passes the tool input to the handler", async () => {
      const toolInput = { sessionId: "specific-session" };
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-1", name: "get_session_summary", input: toolInput },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"));

      await extractInsight({ workspaceId, sessionId });

      expect(mockHandleSessionReaderTool).toHaveBeenCalledWith(
        workspaceId,
        "get_session_summary",
        toolInput
      );
    });
  });

  describe("tool error handling", () => {
    it("returns an error tool_result when a tool throws an Error", async () => {
      mockHandleSessionReaderTool.mockImplementation(async () => {
        throw new Error("Session not found");
      });

      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-err", name: "get_session_summary", input: { sessionId } },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("Recovered."));

      const result = await extractInsight({ workspaceId, sessionId });

      // The loop continues and produces a final answer
      expect(result.result).toBe("Recovered.");

      const secondCallMessages = (
        mockCreate.mock.calls[1][0] as { messages: unknown[] }
      ).messages;
      const toolResultMessage = secondCallMessages[2] as {
        role: string;
        content: unknown[];
      };
      const errorResult = toolResultMessage.content[0] as {
        type: string;
        tool_use_id: string;
        content: string;
        is_error: boolean;
      };
      expect(errorResult.is_error).toBe(true);
      expect(errorResult.content).toContain("Session not found");
    });

    it("handles non-Error thrown values gracefully", async () => {
      mockHandleSessionReaderTool.mockImplementation(async () => {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw "string error value";
      });

      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            {
              id: "tu-str-err",
              name: "get_session_summary",
              input: { sessionId },
            },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("ok"));

      const result = await extractInsight({ workspaceId, sessionId });
      expect(result.result).toBe("ok");

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
      expect(errorResult.content).toContain("string error value");
    });

    it("surfaces an unknown tool as an error tool_result without crashing", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-unknown", name: "totally_unknown_tool", input: {} },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("unreachable"));

      await extractInsight({ workspaceId, sessionId });

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
  });

  describe("API call parameters", () => {
    it("passes the system prompt on every API call", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-1", name: "get_session_summary", input: { sessionId } },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"));

      await extractInsight({ workspaceId, sessionId });

      for (const call of mockCreate.mock.calls) {
        expect((call[0] as { system: string }).system).toBe(
          "You are an insight extractor."
        );
      }
    });

    it("passes max_tokens of 4096 to each API call", async () => {
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      await extractInsight({ workspaceId, sessionId });

      expect(
        (mockCreate.mock.calls[0][0] as { max_tokens: number }).max_tokens
      ).toBe(4096);
    });

    it("passes the model returned by getModelForAgent", async () => {
      mockGetModelForAgent.mockImplementation(() => "claude-test-model");
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      await extractInsight({ workspaceId, sessionId });

      expect(
        (mockCreate.mock.calls[0][0] as { model: string }).model
      ).toBe("claude-test-model");
    });

    it("passes tools returned by getToolsForAgent", async () => {
      const fakeTool = {
        name: "fake_tool",
        description: "A fake tool",
        input_schema: { type: "object" as const, properties: {} },
      };
      mockGetToolsForAgent.mockImplementation(() => [fakeTool]);
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      await extractInsight({ workspaceId, sessionId });

      expect(
        (mockCreate.mock.calls[0][0] as { tools: unknown[] }).tools
      ).toEqual([fakeTool]);
    });
  });
});
