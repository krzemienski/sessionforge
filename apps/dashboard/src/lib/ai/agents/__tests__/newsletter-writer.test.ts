/**
 * Unit tests for the newsletter writer agent.
 *
 * The agent delegates to createAgentMcpServer() + runAgentStreaming().
 * Tests verify user message construction, template handling, and proper
 * delegation to the agent runner.
 *
 * Uses dynamic imports so that mock.module() calls are registered before
 * the module under test (and its dependencies) are loaded.
 */

import { describe, it, expect, mock, beforeAll, beforeEach } from "bun:test";

// --- Mock factory functions (stable references, reassigned per test) ---

const mockCreateAgentMcpServer = mock((_type: string, _ws: string) => ({
  name: "mock-mcp-server",
}));

const mockRunAgentStreaming = mock(
  (_opts: unknown, _meta?: unknown): Response =>
    new Response("data: mock\n\n", {
      headers: { "Content-Type": "text/event-stream" },
    })
);

const mockGetTemplateById = mock(async (_id: string) => null as null | {
  id: string;
  name: string;
  description: string | null;
  structure: { sections: Array<{ heading: string; description: string; required: boolean }> } | null;
  toneGuidance: string | null;
  exampleContent: string | null;
});

const mockIncrementTemplateUsage = mock(async (_id: string) => {});

const mockGetTemplateBySlug = mock((_slug: string) => null as null | {
  name: string;
  description: string | null;
  structure: { sections: Array<{ heading: string; description: string; required: boolean }> } | null;
  toneGuidance: string | null;
  exampleContent: string | null;
});

const mockInjectStyleProfile = mock(
  async (prompt: string, _workspaceId: string) => prompt
);

// --- Register module mocks BEFORE any dynamic import of the module under test ---

mock.module("../../mcp-server-factory", () => ({
  createAgentMcpServer: mockCreateAgentMcpServer,
}));

mock.module("../../agent-runner", () => ({
  runAgentStreaming: mockRunAgentStreaming,
}));

mock.module("@/lib/style/profile-injector", () => ({
  injectStyleProfile: mockInjectStyleProfile,
}));

mock.module("@/lib/templates", () => ({
  getTemplateBySlug: mockGetTemplateBySlug,
}));

mock.module("@/lib/templates/db-operations", () => ({
  getTemplateById: mockGetTemplateById,
  incrementTemplateUsage: mockIncrementTemplateUsage,
}));

mock.module("../../prompts/newsletter", () => ({
  NEWSLETTER_PROMPT: "You are a newsletter writer.",
}));

// --- Dynamic import of the module under test ---

let streamNewsletterWriter: (input: {
  workspaceId: string;
  lookbackDays: number;
  customInstructions?: string;
  templateId?: string;
}) => Promise<Response>;

beforeAll(async () => {
  const mod = await import("../newsletter-writer");
  streamNewsletterWriter = mod.streamNewsletterWriter;
});

// --- Tests ---

describe("streamNewsletterWriter", () => {
  const workspaceId = "ws-newsletter-001";

  beforeEach(() => {
    mockCreateAgentMcpServer.mockClear();
    mockRunAgentStreaming.mockClear();
    mockGetTemplateById.mockClear();
    mockGetTemplateBySlug.mockClear();
    mockIncrementTemplateUsage.mockClear();
    mockInjectStyleProfile.mockClear();

    // Reset defaults
    mockGetTemplateById.mockImplementation(async () => null);
    mockGetTemplateBySlug.mockImplementation(() => null);
    mockInjectStyleProfile.mockImplementation(async (prompt: string) => prompt);
    mockRunAgentStreaming.mockImplementation(
      () =>
        new Response("data: mock\n\n", {
          headers: { "Content-Type": "text/event-stream" },
        })
    );
  });

  describe("return value", () => {
    it("returns a Response", async () => {
      const response = await streamNewsletterWriter({ workspaceId, lookbackDays: 7 });
      expect(response).toBeInstanceOf(Response);
    });

    it("returns a response with text/event-stream content type", async () => {
      const response = await streamNewsletterWriter({ workspaceId, lookbackDays: 7 });
      expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    });
  });

  describe("MCP server and agent runner delegation", () => {
    it("creates an MCP server with the newsletter-writer agent type", async () => {
      await streamNewsletterWriter({ workspaceId, lookbackDays: 7 });
      expect(mockCreateAgentMcpServer).toHaveBeenCalledWith(
        "newsletter-writer",
        workspaceId
      );
    });

    it("calls runAgentStreaming with agentType newsletter-writer", async () => {
      await streamNewsletterWriter({ workspaceId, lookbackDays: 7 });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { agentType: string };
      expect(call.agentType).toBe("newsletter-writer");
    });

    it("passes workspaceId to runAgentStreaming", async () => {
      await streamNewsletterWriter({ workspaceId: "my-workspace-99", lookbackDays: 7 });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { workspaceId: string };
      expect(call.workspaceId).toBe("my-workspace-99");
    });

    it("passes the created MCP server to runAgentStreaming", async () => {
      const fakeMcp = { name: "fake-mcp" };
      mockCreateAgentMcpServer.mockImplementationOnce(() => fakeMcp);

      await streamNewsletterWriter({ workspaceId, lookbackDays: 7 });

      const call = mockRunAgentStreaming.mock.calls[0][0] as { mcpServer: unknown };
      expect(call.mcpServer).toBe(fakeMcp);
    });

    it("passes trackRun: false to runAgentStreaming", async () => {
      await streamNewsletterWriter({ workspaceId, lookbackDays: 7 });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { trackRun: boolean };
      expect(call.trackRun).toBe(false);
    });

    it("uses the newsletter system prompt", async () => {
      await streamNewsletterWriter({ workspaceId, lookbackDays: 7 });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { systemPrompt: string };
      expect(call.systemPrompt).toBe("You are a newsletter writer.");
    });
  });

  describe("user message construction", () => {
    it("includes the lookbackDays count in the user message", async () => {
      await streamNewsletterWriter({ workspaceId, lookbackDays: 7 });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { userMessage: string };
      expect(call.userMessage).toContain("7");
    });

    it("uses singular 'day' when lookbackDays is 1", async () => {
      await streamNewsletterWriter({ workspaceId, lookbackDays: 1 });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { userMessage: string };
      expect(call.userMessage).toContain("1 day");
      expect(call.userMessage).not.toContain("1 days");
    });

    it("uses plural 'days' when lookbackDays is greater than 1", async () => {
      await streamNewsletterWriter({ workspaceId, lookbackDays: 30 });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { userMessage: string };
      expect(call.userMessage).toContain("30 days");
    });

    it("appends customInstructions to the user message when provided", async () => {
      await streamNewsletterWriter({
        workspaceId,
        lookbackDays: 7,
        customInstructions: "Focus on TypeScript discoveries",
      });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { userMessage: string };
      expect(call.userMessage).toContain("Focus on TypeScript discoveries");
    });

    it("does not include 'Additional instructions' when no customInstructions", async () => {
      await streamNewsletterWriter({ workspaceId, lookbackDays: 7 });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { userMessage: string };
      expect(call.userMessage).not.toContain("Additional instructions:");
    });

    it("includes 'Additional instructions' label when customInstructions is provided", async () => {
      await streamNewsletterWriter({
        workspaceId,
        lookbackDays: 7,
        customInstructions: "Extra text",
      });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { userMessage: string };
      expect(call.userMessage).toContain("Additional instructions:");
    });

    it("mentions list_sessions_by_timeframe in the user message", async () => {
      await streamNewsletterWriter({ workspaceId, lookbackDays: 7 });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { userMessage: string };
      expect(call.userMessage).toContain("list_sessions_by_timeframe");
    });

    it("mentions get_top_insights in the user message", async () => {
      await streamNewsletterWriter({ workspaceId, lookbackDays: 7 });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { userMessage: string };
      expect(call.userMessage).toContain("get_top_insights");
    });

    it("mentions create_post in the user message", async () => {
      await streamNewsletterWriter({ workspaceId, lookbackDays: 7 });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { userMessage: string };
      expect(call.userMessage).toContain("create_post");
    });

    it("uses lookbackDays of 7 correctly in the message", async () => {
      await streamNewsletterWriter({ workspaceId, lookbackDays: 7 });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { userMessage: string };
      expect(call.userMessage).toContain("7 days");
    });
  });

  describe("template handling", () => {
    it("does not query templates when no templateId is provided", async () => {
      await streamNewsletterWriter({ workspaceId, lookbackDays: 7 });
      expect(mockGetTemplateById).not.toHaveBeenCalled();
      expect(mockGetTemplateBySlug).not.toHaveBeenCalled();
    });

    it("looks up template by ID when templateId is provided", async () => {
      await streamNewsletterWriter({
        workspaceId,
        lookbackDays: 7,
        templateId: "tmpl-newsletter-1",
      });
      expect(mockGetTemplateById).toHaveBeenCalledWith("tmpl-newsletter-1");
    });

    it("falls back to built-in template when DB template is not found", async () => {
      mockGetTemplateById.mockImplementationOnce(async () => null);

      await streamNewsletterWriter({
        workspaceId,
        lookbackDays: 7,
        templateId: "built-in-newsletter",
      });

      expect(mockGetTemplateBySlug).toHaveBeenCalledWith("built-in-newsletter");
    });

    it("appends template name to system prompt when DB template is found", async () => {
      mockGetTemplateById.mockImplementationOnce(async () => ({
        id: "tmpl-newsletter-1",
        name: "Weekly Digest Template",
        description: "A weekly digest newsletter template",
        structure: null,
        toneGuidance: null,
        exampleContent: null,
      }));

      await streamNewsletterWriter({
        workspaceId,
        lookbackDays: 7,
        templateId: "tmpl-newsletter-1",
      });

      const call = mockRunAgentStreaming.mock.calls[0][0] as { systemPrompt: string };
      expect(call.systemPrompt).toContain("Weekly Digest Template");
    });

    it("tracks template usage when a DB template is found", async () => {
      mockGetTemplateById.mockImplementationOnce(async () => ({
        id: "tmpl-track-nl",
        name: "Newsletter Template",
        description: null,
        structure: null,
        toneGuidance: null,
        exampleContent: null,
      }));

      await streamNewsletterWriter({
        workspaceId,
        lookbackDays: 7,
        templateId: "tmpl-track-nl",
      });

      await new Promise<void>((r) => setTimeout(r, 0));
      expect(mockIncrementTemplateUsage).toHaveBeenCalledWith("tmpl-track-nl");
    });

    it("does not modify system prompt when template is not found anywhere", async () => {
      mockGetTemplateById.mockImplementationOnce(async () => null);
      mockGetTemplateBySlug.mockImplementationOnce(() => null);

      await streamNewsletterWriter({
        workspaceId,
        lookbackDays: 7,
        templateId: "nonexistent-tmpl",
      });

      const call = mockRunAgentStreaming.mock.calls[0][0] as { systemPrompt: string };
      expect(call.systemPrompt).toBe("You are a newsletter writer.");
    });
  });
});
