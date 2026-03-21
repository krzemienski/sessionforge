/**
 * Unit tests for the repurpose writer agent.
 *
 * Verifies that all 6 target formats are correctly routed, that parentPostId
 * is always embedded in the user message, that voice profile injection is
 * called, and that format-specific content requirements are present in the
 * prompts (twitter 5-10 tweets, linkedin 1000-1500 chars, newsletter Key
 * Takeaways, doc_page structured headings).
 */

import { describe, it, expect, mock, beforeAll, beforeEach } from "bun:test";

// --- Stable mock references ---

const mockCreateAgentMcpServer = mock((_type: string, _ws: string) => ({
  name: "mock-mcp-server",
}));

const mockRunAgentStreaming = mock(
  (_opts: unknown): Response =>
    new Response("data: mock\n\n", {
      headers: { "Content-Type": "text/event-stream" },
    })
);

const mockInjectStyleProfile = mock(
  async (prompt: string, _workspaceId: string) => prompt
);

// --- Register module mocks BEFORE dynamic import ---

mock.module("../../mcp-server-factory", () => ({
  createAgentMcpServer: mockCreateAgentMcpServer,
}));

mock.module("../../agent-runner", () => ({
  runAgentStreaming: mockRunAgentStreaming,
}));

mock.module("@/lib/style/profile-injector", () => ({
  injectStyleProfile: mockInjectStyleProfile,
}));

// --- Dynamic import of the module under test ---

let streamRepurposeWriter: (input: {
  workspaceId: string;
  sourcePostId: string;
  targetFormat: string;
  customInstructions?: string;
}) => Promise<Response>;

beforeAll(async () => {
  const mod = await import("../repurpose-writer");
  streamRepurposeWriter = mod.streamRepurposeWriter;
});

// --- Tests ---

const BASE_INPUT = {
  workspaceId: "ws-test-001",
  sourcePostId: "post-abc-123",
};

describe("streamRepurposeWriter", () => {
  beforeEach(() => {
    mockCreateAgentMcpServer.mockClear();
    mockRunAgentStreaming.mockClear();
    mockInjectStyleProfile.mockClear();

    mockInjectStyleProfile.mockImplementation(
      async (prompt: string, _ws: string) => prompt
    );
    mockRunAgentStreaming.mockImplementation(
      () =>
        new Response("data: mock\n\n", {
          headers: { "Content-Type": "text/event-stream" },
        })
    );
  });

  // --- Return value ---

  describe("return value", () => {
    it("returns a Response", async () => {
      const result = await streamRepurposeWriter({
        ...BASE_INPUT,
        targetFormat: "twitter_thread",
      });
      expect(result).toBeInstanceOf(Response);
    });
  });

  // --- parentPostId in user message ---

  describe("parentPostId embedding", () => {
    const ALL_FORMATS = [
      "twitter_thread",
      "linkedin_post",
      "newsletter",
      "doc_page",
      "changelog",
      "tldr",
    ] as const;

    for (const format of ALL_FORMATS) {
      it(`embeds parentPostId in user message for ${format}`, async () => {
        await streamRepurposeWriter({
          ...BASE_INPUT,
          targetFormat: format,
        });
        const call = mockRunAgentStreaming.mock.calls[0][0] as {
          userMessage: string;
        };
        expect(call.userMessage).toContain(BASE_INPUT.sourcePostId);
      });
    }

    it("instructs agent to set parentPostId on the created post", async () => {
      await streamRepurposeWriter({
        ...BASE_INPUT,
        targetFormat: "twitter_thread",
      });
      const call = mockRunAgentStreaming.mock.calls[0][0] as {
        userMessage: string;
      };
      expect(call.userMessage).toContain("parentPostId");
    });

    it("instructs agent to set generatedBy to repurpose_writer", async () => {
      await streamRepurposeWriter({
        ...BASE_INPUT,
        targetFormat: "linkedin_post",
      });
      const call = mockRunAgentStreaming.mock.calls[0][0] as {
        userMessage: string;
      };
      expect(call.userMessage).toContain("repurpose_writer");
    });
  });

  // --- Voice profile injection ---

  describe("voice profile injection", () => {
    it("calls injectStyleProfile with the workspaceId", async () => {
      await streamRepurposeWriter({
        workspaceId: "my-workspace",
        sourcePostId: "post-001",
        targetFormat: "twitter_thread",
      });
      expect(mockInjectStyleProfile).toHaveBeenCalledWith(
        expect.any(String),
        "my-workspace"
      );
    });

    it("uses the style-injected prompt as system prompt", async () => {
      mockInjectStyleProfile.mockImplementationOnce(
        async () => "INJECTED_VOICE_GUIDE_CONTENT"
      );
      await streamRepurposeWriter({
        ...BASE_INPUT,
        targetFormat: "newsletter",
      });
      const call = mockRunAgentStreaming.mock.calls[0][0] as {
        systemPrompt: string;
      };
      expect(call.systemPrompt).toBe("INJECTED_VOICE_GUIDE_CONTENT");
    });
  });

  // --- MCP server ---

  describe("MCP server", () => {
    it("creates the MCP server as repurpose-writer type", async () => {
      await streamRepurposeWriter({
        ...BASE_INPUT,
        targetFormat: "doc_page",
      });
      expect(mockCreateAgentMcpServer).toHaveBeenCalledWith(
        "repurpose-writer",
        BASE_INPUT.workspaceId
      );
    });
  });

  // --- Prompt content requirements ---

  describe("twitter_thread prompt requirements", () => {
    it("system prompt specifies 5-10 tweets", async () => {
      await streamRepurposeWriter({
        ...BASE_INPUT,
        targetFormat: "twitter_thread",
      });
      const call = mockRunAgentStreaming.mock.calls[0][0] as {
        systemPrompt: string;
      };
      expect(call.systemPrompt).toMatch(/5.{0,5}10\s*tweets/i);
    });

    it("system prompt specifies 280-character limit", async () => {
      await streamRepurposeWriter({
        ...BASE_INPUT,
        targetFormat: "twitter_thread",
      });
      const call = mockRunAgentStreaming.mock.calls[0][0] as {
        systemPrompt: string;
      };
      expect(call.systemPrompt).toContain("280");
    });

    it("system prompt requires a hook tweet", async () => {
      await streamRepurposeWriter({
        ...BASE_INPUT,
        targetFormat: "twitter_thread",
      });
      const call = mockRunAgentStreaming.mock.calls[0][0] as {
        systemPrompt: string;
      };
      expect(call.systemPrompt.toLowerCase()).toContain("hook");
    });

    it("system prompt requires a CTA final tweet", async () => {
      await streamRepurposeWriter({
        ...BASE_INPUT,
        targetFormat: "twitter_thread",
      });
      const call = mockRunAgentStreaming.mock.calls[0][0] as {
        systemPrompt: string;
      };
      expect(call.systemPrompt.toUpperCase()).toContain("CTA");
    });

    it("system prompt specifies numbered format (1/N)", async () => {
      await streamRepurposeWriter({
        ...BASE_INPUT,
        targetFormat: "twitter_thread",
      });
      const call = mockRunAgentStreaming.mock.calls[0][0] as {
        systemPrompt: string;
      };
      expect(call.systemPrompt).toContain("1/N");
    });
  });

  describe("linkedin_post prompt requirements", () => {
    it("system prompt specifies 1000-1500 character length", async () => {
      await streamRepurposeWriter({
        ...BASE_INPUT,
        targetFormat: "linkedin_post",
      });
      const call = mockRunAgentStreaming.mock.calls[0][0] as {
        systemPrompt: string;
      };
      expect(call.systemPrompt).toContain("1000");
      expect(call.systemPrompt).toContain("1500");
    });

    it("system prompt specifies characters (not words)", async () => {
      await streamRepurposeWriter({
        ...BASE_INPUT,
        targetFormat: "linkedin_post",
      });
      const call = mockRunAgentStreaming.mock.calls[0][0] as {
        systemPrompt: string;
      };
      expect(call.systemPrompt.toLowerCase()).toContain("characters");
    });

    it("system prompt requires a hook opening", async () => {
      await streamRepurposeWriter({
        ...BASE_INPUT,
        targetFormat: "linkedin_post",
      });
      const call = mockRunAgentStreaming.mock.calls[0][0] as {
        systemPrompt: string;
      };
      expect(call.systemPrompt.toLowerCase()).toContain("hook");
    });

    it("system prompt requires hashtags", async () => {
      await streamRepurposeWriter({
        ...BASE_INPUT,
        targetFormat: "linkedin_post",
      });
      const call = mockRunAgentStreaming.mock.calls[0][0] as {
        systemPrompt: string;
      };
      expect(call.systemPrompt.toLowerCase()).toContain("hashtag");
    });
  });

  describe("newsletter prompt requirements", () => {
    it("system prompt includes Key Takeaways section", async () => {
      await streamRepurposeWriter({
        ...BASE_INPUT,
        targetFormat: "newsletter",
      });
      const call = mockRunAgentStreaming.mock.calls[0][0] as {
        systemPrompt: string;
      };
      expect(call.systemPrompt).toContain("Key Takeaways");
    });

    it("system prompt specifies 200-400 word target", async () => {
      await streamRepurposeWriter({
        ...BASE_INPUT,
        targetFormat: "newsletter",
      });
      const call = mockRunAgentStreaming.mock.calls[0][0] as {
        systemPrompt: string;
      };
      expect(call.systemPrompt).toContain("200");
      expect(call.systemPrompt).toContain("400");
    });

    it("system prompt requires a section header", async () => {
      await streamRepurposeWriter({
        ...BASE_INPUT,
        targetFormat: "newsletter",
      });
      const call = mockRunAgentStreaming.mock.calls[0][0] as {
        systemPrompt: string;
      };
      expect(call.systemPrompt).toMatch(/section.{0,10}header|header/i);
    });

    it("system prompt requires a CTA line", async () => {
      await streamRepurposeWriter({
        ...BASE_INPUT,
        targetFormat: "newsletter",
      });
      const call = mockRunAgentStreaming.mock.calls[0][0] as {
        systemPrompt: string;
      };
      expect(call.systemPrompt.toLowerCase()).toMatch(/cta|call.{0,5}action/i);
    });
  });

  describe("doc_page prompt requirements", () => {
    it("system prompt includes Overview heading", async () => {
      await streamRepurposeWriter({
        ...BASE_INPUT,
        targetFormat: "doc_page",
      });
      const call = mockRunAgentStreaming.mock.calls[0][0] as {
        systemPrompt: string;
      };
      expect(call.systemPrompt).toContain("Overview");
    });

    it("system prompt includes Prerequisites heading", async () => {
      await streamRepurposeWriter({
        ...BASE_INPUT,
        targetFormat: "doc_page",
      });
      const call = mockRunAgentStreaming.mock.calls[0][0] as {
        systemPrompt: string;
      };
      expect(call.systemPrompt).toContain("Prerequisites");
    });

    it("system prompt includes Usage heading", async () => {
      await streamRepurposeWriter({
        ...BASE_INPUT,
        targetFormat: "doc_page",
      });
      const call = mockRunAgentStreaming.mock.calls[0][0] as {
        systemPrompt: string;
      };
      expect(call.systemPrompt).toContain("Usage");
    });

    it("system prompt includes code block format", async () => {
      await streamRepurposeWriter({
        ...BASE_INPUT,
        targetFormat: "doc_page",
      });
      const call = mockRunAgentStreaming.mock.calls[0][0] as {
        systemPrompt: string;
      };
      expect(call.systemPrompt).toContain("```");
    });

    it("system prompt includes Related section", async () => {
      await streamRepurposeWriter({
        ...BASE_INPUT,
        targetFormat: "doc_page",
      });
      const call = mockRunAgentStreaming.mock.calls[0][0] as {
        systemPrompt: string;
      };
      expect(call.systemPrompt).toContain("Related");
    });
  });

  // --- Custom instructions ---

  describe("custom instructions", () => {
    it("appends custom instructions to user message when provided", async () => {
      await streamRepurposeWriter({
        ...BASE_INPUT,
        targetFormat: "twitter_thread",
        customInstructions: "Focus on the database optimization angle",
      });
      const call = mockRunAgentStreaming.mock.calls[0][0] as {
        userMessage: string;
      };
      expect(call.userMessage).toContain("Focus on the database optimization angle");
    });

    it("does not include extra instructions text when none provided", async () => {
      await streamRepurposeWriter({
        ...BASE_INPUT,
        targetFormat: "changelog",
      });
      const call = mockRunAgentStreaming.mock.calls[0][0] as {
        userMessage: string;
      };
      expect(call.userMessage).not.toContain("Additional instructions:");
    });
  });
});
