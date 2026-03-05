/**
 * Unit tests for the blog writer agent.
 *
 * The agent delegates to createAgentMcpServer() + runAgentStreaming().
 * Tests verify prompt selection, user message construction, template
 * handling, skill integration, and proper delegation to the agent runner.
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

const mockGetActiveSkillsForAgentType = mock(async () => []);
const mockBuildSkillSystemPromptSuffix = mock((_skills: unknown[]) => "");

const mockInjectStyleProfile = mock(
  async (prompt: string, _workspaceId: string) => prompt
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
  description: string;
  structure: { sections: Array<{ heading: string; description: string; required: boolean }> } | null;
  toneGuidance: string | null;
  exampleContent: string | null;
});

// --- Register module mocks BEFORE any dynamic import of the module under test ---

mock.module("../../mcp-server-factory", () => ({
  createAgentMcpServer: mockCreateAgentMcpServer,
}));

mock.module("../../agent-runner", () => ({
  runAgentStreaming: mockRunAgentStreaming,
}));

mock.module("../../tools/skill-loader", () => ({
  getActiveSkillsForAgentType: mockGetActiveSkillsForAgentType,
  buildSkillSystemPromptSuffix: mockBuildSkillSystemPromptSuffix,
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

mock.module("../../prompts/blog/technical", () => ({
  BLOG_TECHNICAL_PROMPT: "You are a technical blog writer.",
}));

mock.module("../../prompts/blog/tutorial", () => ({
  BLOG_TUTORIAL_PROMPT: "You are a tutorial blog writer.",
}));

mock.module("../../prompts/blog/conversational", () => ({
  BLOG_CONVERSATIONAL_PROMPT: "You are a conversational blog writer.",
}));

// --- Dynamic import of the module under test ---

let streamBlogWriter: (input: {
  workspaceId: string;
  insightId: string;
  tone?: "technical" | "tutorial" | "conversational";
  customInstructions?: string;
  templateId?: string;
}) => Promise<Response>;

beforeAll(async () => {
  const mod = await import("../blog-writer");
  streamBlogWriter = mod.streamBlogWriter;
});

// --- Tests ---

describe("streamBlogWriter", () => {
  const workspaceId = "ws-blog-001";
  const insightId = "insight-xyz";

  beforeEach(() => {
    mockCreateAgentMcpServer.mockClear();
    mockRunAgentStreaming.mockClear();
    mockGetActiveSkillsForAgentType.mockClear();
    mockBuildSkillSystemPromptSuffix.mockClear();
    mockInjectStyleProfile.mockClear();
    mockGetTemplateById.mockClear();
    mockGetTemplateBySlug.mockClear();
    mockIncrementTemplateUsage.mockClear();

    // Reset defaults
    mockGetActiveSkillsForAgentType.mockImplementation(async () => []);
    mockBuildSkillSystemPromptSuffix.mockImplementation(() => "");
    mockInjectStyleProfile.mockImplementation(
      async (prompt: string, _ws: string) => prompt
    );
    mockGetTemplateById.mockImplementation(async () => null);
    mockGetTemplateBySlug.mockImplementation(() => null);
    mockRunAgentStreaming.mockImplementation(
      () =>
        new Response("data: mock\n\n", {
          headers: { "Content-Type": "text/event-stream" },
        })
    );
  });

  describe("return value", () => {
    it("returns a Response", async () => {
      const response = await streamBlogWriter({ workspaceId, insightId });
      expect(response).toBeInstanceOf(Response);
    });

    it("returns a response with text/event-stream content type", async () => {
      const response = await streamBlogWriter({ workspaceId, insightId });
      expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    });
  });

  describe("MCP server and agent runner delegation", () => {
    it("creates an MCP server with the blog-writer agent type", async () => {
      await streamBlogWriter({ workspaceId, insightId });
      expect(mockCreateAgentMcpServer).toHaveBeenCalledWith(
        "blog-writer",
        workspaceId
      );
    });

    it("calls runAgentStreaming with agentType blog-writer", async () => {
      await streamBlogWriter({ workspaceId, insightId });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { agentType: string };
      expect(call.agentType).toBe("blog-writer");
    });

    it("passes workspaceId to runAgentStreaming", async () => {
      await streamBlogWriter({ workspaceId: "my-workspace-99", insightId });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { workspaceId: string };
      expect(call.workspaceId).toBe("my-workspace-99");
    });

    it("passes the created MCP server to runAgentStreaming", async () => {
      const fakeMcp = { name: "fake-mcp" };
      mockCreateAgentMcpServer.mockImplementationOnce(() => fakeMcp);

      await streamBlogWriter({ workspaceId, insightId });

      const call = mockRunAgentStreaming.mock.calls[0][0] as { mcpServer: unknown };
      expect(call.mcpServer).toBe(fakeMcp);
    });
  });

  describe("prompt selection by tone", () => {
    it("uses the technical prompt by default (no tone specified)", async () => {
      await streamBlogWriter({ workspaceId, insightId });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { systemPrompt: string };
      expect(call.systemPrompt).toBe("You are a technical blog writer.");
    });

    it("uses the technical prompt when tone is 'technical'", async () => {
      await streamBlogWriter({ workspaceId, insightId, tone: "technical" });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { systemPrompt: string };
      expect(call.systemPrompt).toBe("You are a technical blog writer.");
    });

    it("uses the tutorial prompt when tone is 'tutorial'", async () => {
      await streamBlogWriter({ workspaceId, insightId, tone: "tutorial" });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { systemPrompt: string };
      expect(call.systemPrompt).toBe("You are a tutorial blog writer.");
    });

    it("uses the conversational prompt when tone is 'conversational'", async () => {
      await streamBlogWriter({ workspaceId, insightId, tone: "conversational" });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { systemPrompt: string };
      expect(call.systemPrompt).toBe("You are a conversational blog writer.");
    });
  });

  describe("user message construction", () => {
    it("includes the insightId in the user message", async () => {
      await streamBlogWriter({ workspaceId, insightId: "my-special-insight" });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { userMessage: string };
      expect(call.userMessage).toContain("my-special-insight");
    });

    it("appends customInstructions to the user message when provided", async () => {
      await streamBlogWriter({
        workspaceId,
        insightId,
        customInstructions: "Use lots of code examples",
      });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { userMessage: string };
      expect(call.userMessage).toContain("Use lots of code examples");
    });

    it("does not include 'Additional instructions' text when no customInstructions", async () => {
      await streamBlogWriter({ workspaceId, insightId });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { userMessage: string };
      expect(call.userMessage).not.toContain("Additional instructions:");
    });

    it("includes 'Additional instructions' label when customInstructions is provided", async () => {
      await streamBlogWriter({
        workspaceId,
        insightId,
        customInstructions: "Focus on TypeScript",
      });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { userMessage: string };
      expect(call.userMessage).toContain("Additional instructions:");
    });

    it("mentions create_post in the user message", async () => {
      await streamBlogWriter({ workspaceId, insightId });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { userMessage: string };
      expect(call.userMessage).toContain("create_post");
    });

    it("mentions aiDraftMarkdown in the user message", async () => {
      await streamBlogWriter({ workspaceId, insightId });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { userMessage: string };
      expect(call.userMessage).toContain("aiDraftMarkdown");
    });
  });

  describe("style profile injection", () => {
    it("calls injectStyleProfile with the base prompt and workspaceId", async () => {
      await streamBlogWriter({ workspaceId: "style-ws", insightId });
      expect(mockInjectStyleProfile).toHaveBeenCalledWith(
        "You are a technical blog writer.",
        "style-ws"
      );
    });

    it("uses the style-injected prompt as the system prompt", async () => {
      mockInjectStyleProfile.mockImplementationOnce(
        async () => "Style-injected: technical prompt"
      );

      await streamBlogWriter({ workspaceId, insightId });

      const call = mockRunAgentStreaming.mock.calls[0][0] as { systemPrompt: string };
      expect(call.systemPrompt).toContain("Style-injected:");
    });

    it("applies style injection to tutorial prompt", async () => {
      await streamBlogWriter({ workspaceId, insightId, tone: "tutorial" });
      expect(mockInjectStyleProfile).toHaveBeenCalledWith(
        "You are a tutorial blog writer.",
        workspaceId
      );
    });
  });

  describe("skill integration", () => {
    it("fetches active skills for the blog agent type", async () => {
      await streamBlogWriter({ workspaceId, insightId });
      expect(mockGetActiveSkillsForAgentType).toHaveBeenCalledWith(
        workspaceId,
        "blog"
      );
    });

    it("calls buildSkillSystemPromptSuffix with the fetched skills", async () => {
      const fakeSkills = [{ name: "test-skill" }];
      mockGetActiveSkillsForAgentType.mockImplementationOnce(async () => fakeSkills);

      await streamBlogWriter({ workspaceId, insightId });

      expect(mockBuildSkillSystemPromptSuffix).toHaveBeenCalledWith(fakeSkills);
    });

    it("appends skill suffix to the system prompt", async () => {
      mockBuildSkillSystemPromptSuffix.mockImplementationOnce(() => " [skill-suffix]");

      await streamBlogWriter({ workspaceId, insightId });

      const call = mockRunAgentStreaming.mock.calls[0][0] as { systemPrompt: string };
      expect(call.systemPrompt).toContain("[skill-suffix]");
    });
  });

  describe("template handling", () => {
    it("does not query templates when no templateId is provided", async () => {
      await streamBlogWriter({ workspaceId, insightId });
      expect(mockGetTemplateById).not.toHaveBeenCalled();
      expect(mockGetTemplateBySlug).not.toHaveBeenCalled();
    });

    it("looks up template by ID when templateId is provided", async () => {
      await streamBlogWriter({ workspaceId, insightId, templateId: "tmpl-123" });
      expect(mockGetTemplateById).toHaveBeenCalledWith("tmpl-123");
    });

    it("falls back to built-in template when DB template is not found", async () => {
      mockGetTemplateById.mockImplementationOnce(async () => null);

      await streamBlogWriter({ workspaceId, insightId, templateId: "how-i-built-x" });

      expect(mockGetTemplateBySlug).toHaveBeenCalledWith("how-i-built-x");
    });

    it("does not call getTemplateBySlug when DB template is found", async () => {
      mockGetTemplateById.mockImplementationOnce(async () => ({
        id: "tmpl-123",
        name: "My Template",
        description: null,
        structure: null,
        toneGuidance: null,
        exampleContent: null,
      }));

      await streamBlogWriter({ workspaceId, insightId, templateId: "tmpl-123" });

      expect(mockGetTemplateBySlug).not.toHaveBeenCalled();
    });

    it("appends template name to system prompt when DB template is found", async () => {
      mockGetTemplateById.mockImplementationOnce(async () => ({
        id: "tmpl-123",
        name: "Debugging Story",
        description: "A template for debugging stories.",
        structure: null,
        toneGuidance: null,
        exampleContent: null,
      }));

      await streamBlogWriter({ workspaceId, insightId, templateId: "tmpl-123" });

      const call = mockRunAgentStreaming.mock.calls[0][0] as { systemPrompt: string };
      expect(call.systemPrompt).toContain("Debugging Story");
    });

    it("includes template sections in system prompt when present", async () => {
      mockGetTemplateById.mockImplementationOnce(async () => ({
        id: "tmpl-s",
        name: "Structured Template",
        description: null,
        structure: {
          sections: [
            { heading: "Problem", description: "Describe the problem.", required: true },
          ],
        },
        toneGuidance: null,
        exampleContent: null,
      }));

      await streamBlogWriter({ workspaceId, insightId, templateId: "tmpl-s" });

      const call = mockRunAgentStreaming.mock.calls[0][0] as { systemPrompt: string };
      expect(call.systemPrompt).toContain("Problem");
    });

    it("tracks template usage when a DB template is found", async () => {
      mockGetTemplateById.mockImplementationOnce(async () => ({
        id: "tmpl-abc",
        name: "Template",
        description: null,
        structure: null,
        toneGuidance: null,
        exampleContent: null,
      }));

      await streamBlogWriter({ workspaceId, insightId, templateId: "tmpl-abc" });

      // Fire-and-forget: allow the microtask queue to settle
      await new Promise<void>((r) => setTimeout(r, 0));
      expect(mockIncrementTemplateUsage).toHaveBeenCalledWith("tmpl-abc");
    });

    it("does not track usage for built-in (slug) templates", async () => {
      mockGetTemplateById.mockImplementationOnce(async () => null);
      mockGetTemplateBySlug.mockImplementationOnce(() => ({
        name: "Built-in",
        description: "A built-in template",
        structure: null,
        toneGuidance: null,
        exampleContent: null,
      }));

      await streamBlogWriter({ workspaceId, insightId, templateId: "built-in-slug" });
      await new Promise<void>((r) => setTimeout(r, 0));

      expect(mockIncrementTemplateUsage).not.toHaveBeenCalled();
    });
  });
});
