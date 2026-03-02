import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getModelForAgent,
  getHaikuModel,
  getSonnetModel,
  getOpusModel,
} from "@/lib/ai/orchestration/model-selector";
import { getToolsForAgent } from "@/lib/ai/orchestration/tool-registry";
import type { AgentType } from "@/lib/ai/orchestration/tool-registry";

// Mock all tool modules to avoid database and filesystem dependencies
vi.mock("@/lib/ai/tools/session-reader", () => ({
  sessionReaderTools: [
    {
      name: "get_session_messages",
      description: "Retrieve messages from a session",
      input_schema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "list_sessions_by_timeframe",
      description: "List sessions by timeframe",
      input_schema: { type: "object", properties: {}, required: [] },
    },
  ],
}));

vi.mock("@/lib/ai/tools/insight-tools", () => ({
  insightTools: [
    {
      name: "get_insights",
      description: "Retrieve insights",
      input_schema: { type: "object", properties: {}, required: [] },
    },
  ],
}));

vi.mock("@/lib/ai/tools/post-manager", () => ({
  postManagerTools: [
    {
      name: "create_post",
      description: "Create a post",
      input_schema: { type: "object", properties: {}, required: [] },
    },
  ],
}));

vi.mock("@/lib/ai/tools/markdown-editor", () => ({
  markdownEditorTools: [
    {
      name: "edit_markdown",
      description: "Edit markdown content",
      input_schema: { type: "object", properties: {}, required: [] },
    },
  ],
}));

vi.mock("@/lib/ai/tools/skill-loader", () => ({
  skillLoaderTools: [
    {
      name: "load_skill",
      description: "Load a skill",
      input_schema: { type: "object", properties: {}, required: [] },
    },
  ],
}));

describe("model-selector", () => {
  describe("getModelForAgent", () => {
    it("returns opus model for insight-extractor", () => {
      expect(getModelForAgent("insight-extractor")).toBe("claude-opus-4-6");
    });

    it("returns opus model for blog-writer", () => {
      expect(getModelForAgent("blog-writer")).toBe("claude-opus-4-6");
    });

    it("returns opus model for social-writer", () => {
      expect(getModelForAgent("social-writer")).toBe("claude-opus-4-6");
    });

    it("returns opus model for changelog-writer", () => {
      expect(getModelForAgent("changelog-writer")).toBe("claude-opus-4-6");
    });

    it("returns opus model for editor-chat", () => {
      expect(getModelForAgent("editor-chat")).toBe("claude-opus-4-6");
    });

    it("returns the same model string for all opus agents", () => {
      const opusAgents: AgentType[] = [
        "insight-extractor",
        "blog-writer",
        "social-writer",
        "changelog-writer",
        "editor-chat",
      ];
      const models = opusAgents.map((a) => getModelForAgent(a));
      expect(new Set(models).size).toBe(1);
      expect(models[0]).toBe("claude-opus-4-6");
    });
  });

  describe("getHaikuModel", () => {
    it("returns the haiku model string", () => {
      expect(getHaikuModel()).toBe("claude-haiku-4-5-20251001");
    });

    it("returns a consistent value on multiple calls", () => {
      expect(getHaikuModel()).toBe(getHaikuModel());
    });
  });

  describe("getSonnetModel", () => {
    it("returns the sonnet model string", () => {
      expect(getSonnetModel()).toBe("claude-sonnet-4-6");
    });

    it("returns a consistent value on multiple calls", () => {
      expect(getSonnetModel()).toBe(getSonnetModel());
    });
  });

  describe("getOpusModel", () => {
    it("returns the opus model string", () => {
      expect(getOpusModel()).toBe("claude-opus-4-6");
    });

    it("returns a consistent value on multiple calls", () => {
      expect(getOpusModel()).toBe(getOpusModel());
    });
  });

  describe("model constant relationships", () => {
    it("haiku, sonnet, and opus are distinct model strings", () => {
      const models = new Set([getHaikuModel(), getSonnetModel(), getOpusModel()]);
      expect(models.size).toBe(3);
    });

    it("getOpusModel matches model returned for opus agents", () => {
      expect(getModelForAgent("insight-extractor")).toBe(getOpusModel());
    });
  });
});

describe("tool-registry", () => {
  describe("getToolsForAgent", () => {
    it("returns session and insight tools for insight-extractor", () => {
      const tools = getToolsForAgent("insight-extractor");
      const names = tools.map((t) => t.name);
      expect(names).toContain("get_session_messages");
      expect(names).toContain("get_insights");
      expect(names).not.toContain("create_post");
      expect(names).not.toContain("edit_markdown");
      expect(names).not.toContain("load_skill");
    });

    it("returns session, insight, post, and skill tools for blog-writer", () => {
      const tools = getToolsForAgent("blog-writer");
      const names = tools.map((t) => t.name);
      expect(names).toContain("get_session_messages");
      expect(names).toContain("get_insights");
      expect(names).toContain("create_post");
      expect(names).toContain("load_skill");
      expect(names).not.toContain("edit_markdown");
    });

    it("returns session, insight, and post tools for social-writer", () => {
      const tools = getToolsForAgent("social-writer");
      const names = tools.map((t) => t.name);
      expect(names).toContain("get_session_messages");
      expect(names).toContain("get_insights");
      expect(names).toContain("create_post");
      expect(names).not.toContain("edit_markdown");
      expect(names).not.toContain("load_skill");
    });

    it("returns session and post tools for changelog-writer", () => {
      const tools = getToolsForAgent("changelog-writer");
      const names = tools.map((t) => t.name);
      expect(names).toContain("get_session_messages");
      expect(names).toContain("create_post");
      expect(names).not.toContain("get_insights");
      expect(names).not.toContain("edit_markdown");
      expect(names).not.toContain("load_skill");
    });

    it("returns post and markdown tools for editor-chat", () => {
      const tools = getToolsForAgent("editor-chat");
      const names = tools.map((t) => t.name);
      expect(names).toContain("create_post");
      expect(names).toContain("edit_markdown");
      expect(names).not.toContain("get_session_messages");
      expect(names).not.toContain("get_insights");
      expect(names).not.toContain("load_skill");
    });

    it("returns an array of tool objects with required shape", () => {
      const tools = getToolsForAgent("insight-extractor");
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      for (const tool of tools) {
        expect(tool).toHaveProperty("name");
        expect(tool).toHaveProperty("description");
        expect(tool).toHaveProperty("input_schema");
        expect(tool.input_schema.type).toBe("object");
      }
    });

    it("blog-writer has more tools than changelog-writer", () => {
      const blogTools = getToolsForAgent("blog-writer");
      const changelogTools = getToolsForAgent("changelog-writer");
      expect(blogTools.length).toBeGreaterThan(changelogTools.length);
    });

    it("returns flat array (no nested arrays)", () => {
      const tools = getToolsForAgent("blog-writer");
      expect(tools.every((t) => !Array.isArray(t))).toBe(true);
    });
  });
});
