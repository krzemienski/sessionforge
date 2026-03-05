/**
 * Unit tests for the social writer agent.
 *
 * The agent delegates to createAgentMcpServer() + runAgentStreaming().
 * Tests verify prompt selection by platform, user message construction,
 * template handling, skill integration, and proper delegation to the agent runner.
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
  description: string | null;
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

mock.module("../../prompts/social/twitter-thread", () => ({
  TWITTER_THREAD_PROMPT: "You are a Twitter thread writer.",
}));

mock.module("../../prompts/social/linkedin-post", () => ({
  LINKEDIN_PROMPT: "You are a LinkedIn post writer.",
}));

// --- Dynamic import of the module under test ---

let streamSocialWriter: (input: {
  workspaceId: string;
  insightId: string;
  platform: "twitter" | "linkedin";
  customInstructions?: string;
  templateId?: string;
}) => Promise<Response>;

beforeAll(async () => {
  const mod = await import("../social-writer");
  streamSocialWriter = mod.streamSocialWriter;
});

// --- Tests ---

describe("streamSocialWriter", () => {
  const workspaceId = "ws-social-001";
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
      const response = await streamSocialWriter({
        workspaceId,
        insightId,
        platform: "twitter",
      });
      expect(response).toBeInstanceOf(Response);
    });

    it("returns a response with text/event-stream content type", async () => {
      const response = await streamSocialWriter({
        workspaceId,
        insightId,
        platform: "twitter",
      });
      expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    });
  });

  describe("MCP server and agent runner delegation", () => {
    it("creates an MCP server with the social-writer agent type", async () => {
      await streamSocialWriter({ workspaceId, insightId, platform: "twitter" });
      expect(mockCreateAgentMcpServer).toHaveBeenCalledWith(
        "social-writer",
        workspaceId
      );
    });

    it("calls runAgentStreaming with agentType social-writer", async () => {
      await streamSocialWriter({ workspaceId, insightId, platform: "twitter" });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { agentType: string };
      expect(call.agentType).toBe("social-writer");
    });

    it("passes workspaceId to runAgentStreaming", async () => {
      await streamSocialWriter({
        workspaceId: "my-workspace-99",
        insightId,
        platform: "twitter",
      });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { workspaceId: string };
      expect(call.workspaceId).toBe("my-workspace-99");
    });

    it("passes the created MCP server to runAgentStreaming", async () => {
      const fakeMcp = { name: "fake-mcp" };
      mockCreateAgentMcpServer.mockImplementationOnce(() => fakeMcp);

      await streamSocialWriter({ workspaceId, insightId, platform: "twitter" });

      const call = mockRunAgentStreaming.mock.calls[0][0] as { mcpServer: unknown };
      expect(call.mcpServer).toBe(fakeMcp);
    });
  });

  describe("prompt selection by platform", () => {
    it("uses the Twitter thread prompt for twitter platform", async () => {
      await streamSocialWriter({ workspaceId, insightId, platform: "twitter" });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { systemPrompt: string };
      expect(call.systemPrompt).toBe("You are a Twitter thread writer.");
    });

    it("uses the LinkedIn prompt for linkedin platform", async () => {
      await streamSocialWriter({ workspaceId, insightId, platform: "linkedin" });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { systemPrompt: string };
      expect(call.systemPrompt).toBe("You are a LinkedIn post writer.");
    });
  });

  describe("user message construction", () => {
    it("includes the insightId in the user message", async () => {
      await streamSocialWriter({
        workspaceId,
        insightId: "special-insight-42",
        platform: "twitter",
      });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { userMessage: string };
      expect(call.userMessage).toContain("special-insight-42");
    });

    it("includes the platform name in the user message for twitter", async () => {
      await streamSocialWriter({ workspaceId, insightId, platform: "twitter" });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { userMessage: string };
      expect(call.userMessage).toContain("twitter");
    });

    it("includes the platform name in the user message for linkedin", async () => {
      await streamSocialWriter({ workspaceId, insightId, platform: "linkedin" });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { userMessage: string };
      expect(call.userMessage).toContain("linkedin");
    });

    it("includes the twitter_thread content type for twitter platform", async () => {
      await streamSocialWriter({ workspaceId, insightId, platform: "twitter" });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { userMessage: string };
      expect(call.userMessage).toContain("twitter_thread");
    });

    it("includes the linkedin_post content type for linkedin platform", async () => {
      await streamSocialWriter({ workspaceId, insightId, platform: "linkedin" });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { userMessage: string };
      expect(call.userMessage).toContain("linkedin_post");
    });

    it("appends customInstructions to the user message when provided", async () => {
      await streamSocialWriter({
        workspaceId,
        insightId,
        platform: "twitter",
        customInstructions: "Keep it punchy and use emojis",
      });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { userMessage: string };
      expect(call.userMessage).toContain("Keep it punchy and use emojis");
    });

    it("does not include 'Additional instructions' when no customInstructions", async () => {
      await streamSocialWriter({ workspaceId, insightId, platform: "twitter" });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { userMessage: string };
      expect(call.userMessage).not.toContain("Additional instructions:");
    });

    it("includes 'Additional instructions' label when customInstructions is provided", async () => {
      await streamSocialWriter({
        workspaceId,
        insightId,
        platform: "linkedin",
        customInstructions: "Focus on leadership",
      });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { userMessage: string };
      expect(call.userMessage).toContain("Additional instructions:");
    });

    it("mentions aiDraftMarkdown in the user message", async () => {
      await streamSocialWriter({ workspaceId, insightId, platform: "twitter" });
      const call = mockRunAgentStreaming.mock.calls[0][0] as { userMessage: string };
      expect(call.userMessage).toContain("aiDraftMarkdown");
    });
  });

  describe("style profile injection", () => {
    it("calls injectStyleProfile with the base prompt and workspaceId", async () => {
      await streamSocialWriter({
        workspaceId: "style-ws",
        insightId,
        platform: "twitter",
      });
      expect(mockInjectStyleProfile).toHaveBeenCalledWith(
        "You are a Twitter thread writer.",
        "style-ws"
      );
    });

    it("uses the style-injected prompt as system prompt", async () => {
      mockInjectStyleProfile.mockImplementationOnce(
        async () => "Style-injected: Twitter thread prompt"
      );

      await streamSocialWriter({ workspaceId, insightId, platform: "twitter" });

      const call = mockRunAgentStreaming.mock.calls[0][0] as { systemPrompt: string };
      expect(call.systemPrompt).toContain("Style-injected:");
    });

    it("applies style injection to LinkedIn prompt", async () => {
      await streamSocialWriter({ workspaceId, insightId, platform: "linkedin" });
      expect(mockInjectStyleProfile).toHaveBeenCalledWith(
        "You are a LinkedIn post writer.",
        workspaceId
      );
    });
  });

  describe("skill integration", () => {
    it("fetches active skills for the social agent type", async () => {
      await streamSocialWriter({ workspaceId, insightId, platform: "twitter" });
      expect(mockGetActiveSkillsForAgentType).toHaveBeenCalledWith(
        workspaceId,
        "social"
      );
    });

    it("calls buildSkillSystemPromptSuffix with the fetched skills", async () => {
      const fakeSkills = [{ name: "social-skill" }];
      mockGetActiveSkillsForAgentType.mockImplementationOnce(async () => fakeSkills);

      await streamSocialWriter({ workspaceId, insightId, platform: "linkedin" });

      expect(mockBuildSkillSystemPromptSuffix).toHaveBeenCalledWith(fakeSkills);
    });

    it("appends skill suffix to the system prompt", async () => {
      mockBuildSkillSystemPromptSuffix.mockImplementationOnce(
        () => " [social-skill-suffix]"
      );

      await streamSocialWriter({ workspaceId, insightId, platform: "twitter" });

      const call = mockRunAgentStreaming.mock.calls[0][0] as { systemPrompt: string };
      expect(call.systemPrompt).toContain("[social-skill-suffix]");
    });
  });

  describe("template handling", () => {
    it("does not query templates when no templateId is provided", async () => {
      await streamSocialWriter({ workspaceId, insightId, platform: "twitter" });
      expect(mockGetTemplateById).not.toHaveBeenCalled();
      expect(mockGetTemplateBySlug).not.toHaveBeenCalled();
    });

    it("looks up template by ID when templateId is provided", async () => {
      await streamSocialWriter({
        workspaceId,
        insightId,
        platform: "twitter",
        templateId: "tmpl-social-1",
      });
      expect(mockGetTemplateById).toHaveBeenCalledWith("tmpl-social-1");
    });

    it("falls back to built-in template when DB template is not found", async () => {
      mockGetTemplateById.mockImplementationOnce(async () => null);

      await streamSocialWriter({
        workspaceId,
        insightId,
        platform: "twitter",
        templateId: "built-in-social",
      });

      expect(mockGetTemplateBySlug).toHaveBeenCalledWith("built-in-social");
    });

    it("appends template name to system prompt when template is found", async () => {
      mockGetTemplateById.mockImplementationOnce(async () => ({
        id: "tmpl-social-1",
        name: "Twitter Thread Template",
        description: "A template for Twitter threads",
        structure: null,
        toneGuidance: null,
        exampleContent: null,
      }));

      await streamSocialWriter({
        workspaceId,
        insightId,
        platform: "twitter",
        templateId: "tmpl-social-1",
      });

      const call = mockRunAgentStreaming.mock.calls[0][0] as { systemPrompt: string };
      expect(call.systemPrompt).toContain("Twitter Thread Template");
    });

    it("tracks template usage when a DB template is found", async () => {
      mockGetTemplateById.mockImplementationOnce(async () => ({
        id: "tmpl-track",
        name: "Template",
        description: null,
        structure: null,
        toneGuidance: null,
        exampleContent: null,
      }));

      await streamSocialWriter({
        workspaceId,
        insightId,
        platform: "linkedin",
        templateId: "tmpl-track",
      });

      await new Promise<void>((r) => setTimeout(r, 0));
      expect(mockIncrementTemplateUsage).toHaveBeenCalledWith("tmpl-track");
    });
  });
});
