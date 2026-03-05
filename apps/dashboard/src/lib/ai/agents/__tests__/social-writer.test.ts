/**
 * Unit tests for the social writer agent.
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
const mockHandlePostManagerTool = mock(async () => ({ postId: "post-456" }));

const mockSend = mock((_event: string, _data: unknown) => {});
const mockClose = mock(() => {});

// --- Register module mocks BEFORE any dynamic import of the module under test ---

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

mock.module("../../tools/post-manager", () => ({
  handlePostManagerTool: mockHandlePostManagerTool,
}));

mock.module("../../prompts/social/twitter-thread", () => ({
  TWITTER_THREAD_PROMPT: "You are a Twitter thread writer.",
}));

mock.module("../../prompts/social/linkedin-post", () => ({
  LINKEDIN_PROMPT: "You are a LinkedIn post writer.",
}));

mock.module("../../orchestration/streaming", () => ({
  createSSEStream: () => ({
    stream: new ReadableStream(),
    send: mockSend,
    close: mockClose,
  }),
  sseResponse: (stream: ReadableStream) =>
    new Response(stream, {
      headers: { "Content-Type": "text/event-stream" },
    }),
}));

// --- Dynamic import of the module under test ---

let streamSocialWriter: (input: {
  workspaceId: string;
  insightId: string;
  platform: "twitter" | "linkedin";
  customInstructions?: string;
}) => Response;

beforeAll(async () => {
  const mod = await import("../social-writer");
  streamSocialWriter = mod.streamSocialWriter;
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

/** Wait for the background async run() to fully settle. */
async function flushAsync() {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

// --- Tests ---

describe("streamSocialWriter", () => {
  const workspaceId = "ws-social-001";
  const insightId = "insight-abc";

  beforeEach(() => {
    mockCreate.mockClear();
    mockGetModelForAgent.mockClear();
    mockGetToolsForAgent.mockClear();
    mockHandleSessionReaderTool.mockClear();
    mockHandleInsightTool.mockClear();
    mockHandlePostManagerTool.mockClear();
    mockSend.mockClear();
    mockClose.mockClear();

    // Reset defaults
    mockGetModelForAgent.mockImplementation(() => "claude-opus-4-6");
    mockGetToolsForAgent.mockImplementation(() => []);
    mockHandleSessionReaderTool.mockImplementation(async () => ({ data: "session-data" }));
    mockHandleInsightTool.mockImplementation(async () => ({ id: "insight-123" }));
    mockHandlePostManagerTool.mockImplementation(async () => ({ postId: "post-456" }));
  });

  describe("return value", () => {
    it("returns a Response immediately (synchronous)", () => {
      mockCreate.mockImplementation(async () => makeTextResponse("Tweet thread."));

      const response = streamSocialWriter({ workspaceId, insightId, platform: "twitter" });

      expect(response).toBeInstanceOf(Response);
    });

    it("returns a response with text/event-stream content type", () => {
      mockCreate.mockImplementation(async () => makeTextResponse("Tweet thread."));

      const response = streamSocialWriter({ workspaceId, insightId, platform: "twitter" });

      expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    });
  });

  describe("SSE event lifecycle", () => {
    it("sends a starting status event", async () => {
      mockCreate.mockImplementation(async () => makeTextResponse("Done."));

      streamSocialWriter({ workspaceId, insightId, platform: "twitter" });
      await flushAsync();

      const statusCalls = mockSend.mock.calls.filter((c) => c[0] === "status");
      expect(statusCalls.length).toBeGreaterThan(0);
      expect((statusCalls[0][1] as { phase: string }).phase).toBe("starting");
    });

    it("sends a text event with the model's final text", async () => {
      mockCreate.mockImplementation(async () =>
        makeTextResponse("This is the social post content.")
      );

      streamSocialWriter({ workspaceId, insightId, platform: "linkedin" });
      await flushAsync();

      const textCalls = mockSend.mock.calls.filter((c) => c[0] === "text");
      expect(textCalls.length).toBe(1);
      expect(
        (textCalls[0][1] as { content: string }).content
      ).toBe("This is the social post content.");
    });

    it("sends a complete event after all text is emitted", async () => {
      const usage = { input_tokens: 42, output_tokens: 100 };
      mockCreate.mockImplementation(async () => makeTextResponse("Done.", usage));

      streamSocialWriter({ workspaceId, insightId, platform: "twitter" });
      await flushAsync();

      const completeCalls = mockSend.mock.calls.filter((c) => c[0] === "complete");
      expect(completeCalls.length).toBe(1);
      expect((completeCalls[0][1] as { usage: unknown }).usage).toEqual(usage);
    });

    it("calls close() after the run completes", async () => {
      mockCreate.mockImplementation(async () => makeTextResponse("Done."));

      streamSocialWriter({ workspaceId, insightId, platform: "twitter" });
      await flushAsync();

      expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it("sends an error event and still calls close() on API failure", async () => {
      mockCreate.mockImplementation(async () => {
        throw new Error("API unavailable");
      });

      streamSocialWriter({ workspaceId, insightId, platform: "twitter" });
      await flushAsync();

      const errorCalls = mockSend.mock.calls.filter((c) => c[0] === "error");
      expect(errorCalls.length).toBe(1);
      expect(
        (errorCalls[0][1] as { message: string }).message
      ).toBe("API unavailable");
      expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it("sends an error event for non-Error thrown values", async () => {
      mockCreate.mockImplementation(async () => {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw "network failure";
      });

      streamSocialWriter({ workspaceId, insightId, platform: "linkedin" });
      await flushAsync();

      const errorCalls = mockSend.mock.calls.filter((c) => c[0] === "error");
      expect(errorCalls.length).toBe(1);
      expect(
        (errorCalls[0][1] as { message: string }).message
      ).toBe("network failure");
    });

    it("sends no text events when the model produces no text block", async () => {
      mockCreate.mockImplementation(async () => ({
        content: [],
        stop_reason: "end_turn",
        usage: { input_tokens: 5, output_tokens: 0 },
      }));

      streamSocialWriter({ workspaceId, insightId, platform: "twitter" });
      await flushAsync();

      const textCalls = mockSend.mock.calls.filter((c) => c[0] === "text");
      expect(textCalls.length).toBe(0);
    });
  });

  describe("prompt selection by platform", () => {
    it("uses the Twitter thread prompt when platform is 'twitter'", async () => {
      mockCreate.mockImplementation(async () => makeTextResponse("Twitter post"));

      streamSocialWriter({ workspaceId, insightId, platform: "twitter" });
      await flushAsync();

      expect(
        (mockCreate.mock.calls[0][0] as { system: string }).system
      ).toBe("You are a Twitter thread writer.");
    });

    it("uses the LinkedIn prompt when platform is 'linkedin'", async () => {
      mockCreate.mockImplementation(async () => makeTextResponse("LinkedIn post"));

      streamSocialWriter({ workspaceId, insightId, platform: "linkedin" });
      await flushAsync();

      expect(
        (mockCreate.mock.calls[0][0] as { system: string }).system
      ).toBe("You are a LinkedIn post writer.");
    });
  });

  describe("user message construction", () => {
    it("includes the insightId in the initial user message", async () => {
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      streamSocialWriter({ workspaceId, insightId: "my-special-insight", platform: "twitter" });
      await flushAsync();

      const firstCall = mockCreate.mock.calls[0][0] as {
        messages: Array<{ role: string; content: string }>;
      };
      const userMessage = firstCall.messages[0];
      expect(userMessage.role).toBe("user");
      expect(userMessage.content).toContain("my-special-insight");
    });

    it("includes the platform in the initial user message", async () => {
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      streamSocialWriter({ workspaceId, insightId, platform: "linkedin" });
      await flushAsync();

      const firstCall = mockCreate.mock.calls[0][0] as {
        messages: Array<{ role: string; content: string }>;
      };
      const userMessage = firstCall.messages[0];
      expect(userMessage.content).toContain("linkedin");
    });

    it("includes the content_type 'twitter_thread' when platform is twitter", async () => {
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      streamSocialWriter({ workspaceId, insightId, platform: "twitter" });
      await flushAsync();

      const firstCall = mockCreate.mock.calls[0][0] as {
        messages: Array<{ role: string; content: string }>;
      };
      const userMessage = firstCall.messages[0];
      expect(userMessage.content).toContain("twitter_thread");
    });

    it("includes the content_type 'linkedin_post' when platform is linkedin", async () => {
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      streamSocialWriter({ workspaceId, insightId, platform: "linkedin" });
      await flushAsync();

      const firstCall = mockCreate.mock.calls[0][0] as {
        messages: Array<{ role: string; content: string }>;
      };
      const userMessage = firstCall.messages[0];
      expect(userMessage.content).toContain("linkedin_post");
    });

    it("appends customInstructions to the user message when provided", async () => {
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      streamSocialWriter({
        workspaceId,
        insightId,
        platform: "twitter",
        customInstructions: "Use bullet points and emojis",
      });
      await flushAsync();

      const firstCall = mockCreate.mock.calls[0][0] as {
        messages: Array<{ role: string; content: string }>;
      };
      const userMessage = firstCall.messages[0];
      expect(userMessage.content).toContain("Use bullet points and emojis");
    });

    it("does not include 'Additional instructions' text when no customInstructions", async () => {
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      streamSocialWriter({ workspaceId, insightId, platform: "twitter" });
      await flushAsync();

      const firstCall = mockCreate.mock.calls[0][0] as {
        messages: Array<{ role: string; content: string }>;
      };
      const userMessage = firstCall.messages[0];
      expect(userMessage.content).not.toContain("Additional instructions:");
    });
  });

  describe("API call parameters", () => {
    it("calls getModelForAgent with social-writer", async () => {
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      streamSocialWriter({ workspaceId, insightId, platform: "twitter" });
      await flushAsync();

      expect(mockGetModelForAgent).toHaveBeenCalledWith("social-writer");
    });

    it("calls getToolsForAgent with social-writer", async () => {
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      streamSocialWriter({ workspaceId, insightId, platform: "twitter" });
      await flushAsync();

      expect(mockGetToolsForAgent).toHaveBeenCalledWith("social-writer");
    });

    it("passes max_tokens of 4096 to each API call", async () => {
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      streamSocialWriter({ workspaceId, insightId, platform: "twitter" });
      await flushAsync();

      expect(
        (mockCreate.mock.calls[0][0] as { max_tokens: number }).max_tokens
      ).toBe(4096);
    });

    it("passes the model returned by getModelForAgent", async () => {
      mockGetModelForAgent.mockImplementation(() => "claude-custom-model");
      mockCreate.mockImplementation(async () => makeTextResponse("done"));

      streamSocialWriter({ workspaceId, insightId, platform: "twitter" });
      await flushAsync();

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

      streamSocialWriter({ workspaceId, insightId, platform: "twitter" });
      await flushAsync();

      expect(
        (mockCreate.mock.calls[0][0] as { tools: unknown[] }).tools
      ).toEqual([fakeTool]);
    });

    it("passes the system prompt on every API call in a tool-use loop", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-1", name: "get_insight_by_id", input: { insightId } },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"));

      streamSocialWriter({ workspaceId, insightId, platform: "twitter" });
      await flushAsync();

      for (const call of mockCreate.mock.calls) {
        expect((call[0] as { system: string }).system).toBe(
          "You are a Twitter thread writer."
        );
      }
    });
  });

  describe("agentic tool-use loop", () => {
    it("sends tool_use events for each tool call", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-1", name: "get_insight_by_id", input: { insightId } },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("Social post done."));

      streamSocialWriter({ workspaceId, insightId, platform: "twitter" });
      await flushAsync();

      const toolUseCalls = mockSend.mock.calls.filter((c) => c[0] === "tool_use");
      expect(toolUseCalls.length).toBe(1);
      expect((toolUseCalls[0][1] as { tool: string }).tool).toBe("get_insight_by_id");
    });

    it("sends tool_result events after each dispatch", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-1", name: "get_insight_by_id", input: { insightId } },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"));

      streamSocialWriter({ workspaceId, insightId, platform: "linkedin" });
      await flushAsync();

      const toolResultCalls = mockSend.mock.calls.filter(
        (c) => c[0] === "tool_result"
      );
      expect(toolResultCalls.length).toBe(1);
      expect((toolResultCalls[0][1] as { success: boolean }).success).toBe(true);
    });

    it("handles multiple sequential rounds of tool calls before final response", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-1", name: "get_insight_by_id", input: { insightId } },
          ])
        )
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-2", name: "create_post", input: { title: "Post", content: "..." } },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("Final social post."));

      streamSocialWriter({ workspaceId, insightId, platform: "twitter" });
      await flushAsync();

      expect(mockCreate).toHaveBeenCalledTimes(3);

      const textCalls = mockSend.mock.calls.filter((c) => c[0] === "text");
      expect(textCalls.length).toBe(1);
      expect(
        (textCalls[0][1] as { content: string }).content
      ).toBe("Final social post.");
    });

    it("handles multiple tool calls in a single response (parallel dispatch)", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-1", name: "get_insight_by_id", input: { insightId } },
            { id: "tu-2", name: "get_session_summary", input: { sessionId: "s1" } },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("Done."));

      streamSocialWriter({ workspaceId, insightId, platform: "twitter" });
      await flushAsync();

      const toolUseCalls = mockSend.mock.calls.filter((c) => c[0] === "tool_use");
      expect(toolUseCalls.length).toBe(2);
    });

    it("includes tool results as user messages in subsequent API calls", async () => {
      mockHandleInsightTool.mockImplementation(async () => ({
        id: "insight-123",
        title: "My Insight",
      }));

      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-99", name: "get_insight_by_id", input: { insightId } },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"));

      streamSocialWriter({ workspaceId, insightId, platform: "linkedin" });
      await flushAsync();

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
      expect(toolResult.content).toContain("insight-123");
    });
  });

  describe("tool dispatch routing", () => {
    async function runWithSingleTool(toolName: string) {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-1", name: toolName, input: { insightId } },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"));
      streamSocialWriter({ workspaceId, insightId, platform: "twitter" });
      await flushAsync();
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

    it("routes get_insight_by_id to handleInsightTool", async () => {
      await runWithSingleTool("get_insight_by_id");
      expect(mockHandleInsightTool).toHaveBeenCalledWith(
        workspaceId,
        "get_insight_by_id",
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

    it("routes create_insight to handleInsightTool", async () => {
      await runWithSingleTool("create_insight");
      expect(mockHandleInsightTool).toHaveBeenCalledWith(
        workspaceId,
        "create_insight",
        expect.any(Object)
      );
    });

    it("routes create_post to handlePostManagerTool", async () => {
      await runWithSingleTool("create_post");
      expect(mockHandlePostManagerTool).toHaveBeenCalledWith(
        workspaceId,
        "create_post",
        expect.any(Object)
      );
      expect(mockHandleInsightTool).not.toHaveBeenCalled();
    });

    it("routes update_post to handlePostManagerTool", async () => {
      await runWithSingleTool("update_post");
      expect(mockHandlePostManagerTool).toHaveBeenCalledWith(
        workspaceId,
        "update_post",
        expect.any(Object)
      );
    });

    it("routes get_post to handlePostManagerTool", async () => {
      await runWithSingleTool("get_post");
      expect(mockHandlePostManagerTool).toHaveBeenCalledWith(
        workspaceId,
        "get_post",
        expect.any(Object)
      );
    });

    it("routes get_markdown to handlePostManagerTool", async () => {
      await runWithSingleTool("get_markdown");
      expect(mockHandlePostManagerTool).toHaveBeenCalledWith(
        workspaceId,
        "get_markdown",
        expect.any(Object)
      );
    });

    it("passes the workspaceId to session reader tool handler", async () => {
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-1", name: "get_session_summary", input: { insightId } },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"));

      streamSocialWriter({ workspaceId: "my-workspace-99", insightId, platform: "twitter" });
      await flushAsync();

      expect(mockHandleSessionReaderTool).toHaveBeenCalledWith(
        "my-workspace-99",
        expect.any(String),
        expect.any(Object)
      );
    });

    it("passes the tool input to the handler", async () => {
      const toolInput = { insightId: "specific-insight" };
      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-1", name: "get_insight_by_id", input: toolInput },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("done"));

      streamSocialWriter({ workspaceId, insightId, platform: "twitter" });
      await flushAsync();

      expect(mockHandleInsightTool).toHaveBeenCalledWith(
        workspaceId,
        "get_insight_by_id",
        toolInput
      );
    });
  });

  describe("tool error handling", () => {
    it("sends a failed tool_result event when a tool throws an Error", async () => {
      mockHandleInsightTool.mockImplementation(async () => {
        throw new Error("Insight not found");
      });

      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-err", name: "get_insight_by_id", input: { insightId } },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("Recovered."));

      streamSocialWriter({ workspaceId, insightId, platform: "twitter" });
      await flushAsync();

      const failedToolResult = mockSend.mock.calls.find(
        (c) =>
          c[0] === "tool_result" &&
          (c[1] as { success: boolean }).success === false
      );
      expect(failedToolResult).toBeDefined();
      expect(
        (failedToolResult![1] as { error: string }).error
      ).toBe("Insight not found");
    });

    it("includes error info in the tool_result message sent to the API", async () => {
      mockHandlePostManagerTool.mockImplementation(async () => {
        throw new Error("Post creation failed");
      });

      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-err", name: "create_post", input: { title: "T" } },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("ok"));

      streamSocialWriter({ workspaceId, insightId, platform: "linkedin" });
      await flushAsync();

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
      expect(errorResult.content).toContain("Post creation failed");
    });

    it("handles non-Error thrown values gracefully", async () => {
      mockHandleInsightTool.mockImplementation(async () => {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw "string error value";
      });

      mockCreate
        .mockImplementationOnce(async () =>
          makeToolUseResponse([
            { id: "tu-str", name: "get_insight_by_id", input: { insightId } },
          ])
        )
        .mockImplementationOnce(async () => makeTextResponse("ok"));

      streamSocialWriter({ workspaceId, insightId, platform: "twitter" });
      await flushAsync();

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

      streamSocialWriter({ workspaceId, insightId, platform: "twitter" });
      await flushAsync();

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
});
