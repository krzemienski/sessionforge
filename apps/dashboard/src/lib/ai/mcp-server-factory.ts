/**
 * MCP server factory for AI agents.
 * Converts existing tool definitions and handlers into Agent SDK
 * tool() instances bundled via createSdkMcpServer().
 *
 * This bridges the gap between the existing Anthropic tool format
 * (JSON Schema input_schema + handler functions) and the Agent SDK's
 * MCP tool format (Zod schemas + tool() calls).
 */

import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";

delete process.env.CLAUDECODE;

import { z } from "zod";

import { handleSessionReaderTool } from "./tools/session-reader";
import { handleInsightTool } from "./tools/insight-tools";
import { handlePostManagerTool } from "./tools/post-manager";
import { handleMarkdownEditorTool } from "./tools/markdown-editor";
import { handleSkillLoaderTool } from "./tools/skill-loader";
import { handleEvidenceTool } from "./tools/evidence-tools";
import { handleIngestionTool } from "./tools/ingestion-tools";

import type { AgentType } from "./orchestration/tool-registry";

// ── Tool group → handler routing ──

type ToolHandler = (
  workspaceId: string,
  toolName: string,
  toolInput: Record<string, unknown>,
) => Promise<unknown>;

type SkillToolHandler = (
  toolName: string,
  toolInput: Record<string, unknown>,
) => Promise<unknown>;

const TOOL_GROUP_HANDLERS: Record<string, ToolHandler> = {
  session: handleSessionReaderTool,
  insight: handleInsightTool,
  post: handlePostManagerTool,
  markdown: handleMarkdownEditorTool,
  evidence: handleEvidenceTool,
  ingestion: handleIngestionTool,
};

const SKILL_HANDLER: SkillToolHandler = handleSkillLoaderTool;

// ── Tool name → group mapping ──

const TOOL_NAME_TO_GROUP: Record<string, string> = {
  // session tools
  get_session_messages: "session",
  get_session_summary: "session",
  list_sessions_by_timeframe: "session",
  // insight tools
  get_insight_details: "insight",
  get_top_insights: "insight",
  create_insight: "insight",
  // post tools
  create_post: "post",
  update_post: "post",
  get_post: "post",
  get_markdown: "post",
  // markdown tools
  edit_markdown: "markdown",
  // skill tools
  list_available_skills: "skill",
  get_skill_by_name: "skill",
  // evidence tools (Phase 2 mining)
  mine_sessions: "evidence",
  get_evidence_detail: "evidence",
  get_evidence_timeline: "evidence",
  // ingestion tools (Phase 3)
  get_source_material: "ingestion",
  get_external_source: "ingestion",
  get_repo_analysis: "ingestion",
  get_content_brief: "ingestion",
};

// ── Agent type → tool groups (mirrors AGENT_TOOL_SETS from tool-registry) ──

const AGENT_TOOL_GROUPS: Record<AgentType, string[]> = {
  "insight-extractor": ["session", "insight"],
  "corpus-analyzer": ["session", "insight"],
  "blog-writer": ["session", "insight", "post", "skill"],
  "social-writer": ["session", "insight", "post"],
  "changelog-writer": ["session", "post"],
  "editor-chat": ["post", "markdown"],
  "repurpose-writer": ["post"],
  "newsletter-writer": ["session", "insight", "post"],
  "evidence-writer": ["session", "insight", "post", "evidence", "ingestion"],
  "supplementary-writer": ["post"],
  "content-strategist": ["insight", "analytics", "recommendation"],
};

// ── Zod schemas for each tool ──

const TOOL_SCHEMAS: Record<string, { description: string; schema: z.AnyZodObject }> = {
  get_session_messages: {
    description: "Retrieve messages from a specific Claude session by sessionId.",
    schema: z.object({
      sessionId: z.string().describe("The session ID to fetch messages for"),
      limit: z.number().optional().describe("Maximum number of messages to return (default: 100)"),
    }),
  },
  get_session_summary: {
    description: "Get metadata and summary for a specific Claude session.",
    schema: z.object({
      sessionId: z.string().describe("The session ID to get summary for"),
    }),
  },
  list_sessions_by_timeframe: {
    description: "List Claude sessions within a lookback window, optionally filtered by project name.",
    schema: z.object({
      lookbackDays: z.number().describe("Number of days to look back"),
      projectFilter: z.string().optional().describe("Optional project name filter (partial match)"),
    }),
  },
  get_insight_details: {
    description: "Get full details of a specific insight by ID.",
    schema: z.object({
      insightId: z.string().describe("The insight ID"),
    }),
  },
  get_top_insights: {
    description: "Get top insights sorted by composite score.",
    schema: z.object({
      limit: z.number().optional().describe("Max results (default: 10)"),
      minScore: z.number().optional().describe("Minimum composite score filter"),
    }),
  },
  create_insight: {
    description: "Create a new insight record in the database. Category MUST be one of: novel_problem_solving, tool_pattern_discovery, before_after_transformation, failure_recovery, architecture_decision, performance_optimization.",
    schema: z.object({
      sessionId: z.string().optional(),
      category: z.enum([
        "novel_problem_solving",
        "tool_pattern_discovery",
        "before_after_transformation",
        "failure_recovery",
        "architecture_decision",
        "performance_optimization",
      ]),
      title: z.string(),
      description: z.string(),
      codeSnippets: z.array(z.object({
        language: z.string(),
        code: z.string(),
        context: z.string(),
      })).optional(),
      terminalOutput: z.array(z.string()).optional(),
      scores: z.object({
        novelty: z.number(),
        tool_discovery: z.number(),
        before_after: z.number(),
        failure_recovery: z.number(),
        reproducibility: z.number(),
        scale: z.number(),
      }),
    }),
  },
  create_post: {
    description: "Create a new post/content item in the database. contentType MUST be one of: blog_post, twitter_thread, linkedin_post, devto_post, changelog, newsletter, custom.",
    schema: z.object({
      title: z.string(),
      markdown: z.string().describe("Full markdown content"),
      contentType: z.enum(["blog_post", "twitter_thread", "linkedin_post", "devto_post", "changelog", "newsletter", "custom"]),
      insightId: z.string().optional(),
      parentPostId: z.string().optional().describe("ID of the source post being repurposed"),
      status: z.string().optional(),
      toneUsed: z.string().optional(),
      aiDraftMarkdown: z.string().optional().describe("Original AI-generated markdown for style learning"),
      sourceMetadata: z.record(z.unknown()).optional(),
    }),
  },
  update_post: {
    description: "Update an existing post by ID.",
    schema: z.object({
      postId: z.string(),
      title: z.string().optional(),
      markdown: z.string().optional(),
      status: z.string().optional(),
      toneUsed: z.string().optional(),
    }),
  },
  get_post: {
    description: "Get a post by ID including all metadata.",
    schema: z.object({
      postId: z.string(),
    }),
  },
  get_markdown: {
    description: "Get just the markdown content of a post.",
    schema: z.object({
      postId: z.string(),
    }),
  },
  edit_markdown: {
    description: "Edit the markdown content of a post with precise line-level operations.",
    schema: z.object({
      postId: z.string().describe("Post ID to edit"),
      operation: z.enum(["replaceLine", "replaceRange", "insert", "delete"]).describe("Type of edit operation"),
      lineNumber: z.number().optional().describe("Line number (1-indexed) for replaceLine"),
      startLine: z.number().optional().describe("Start line for replaceRange or delete"),
      endLine: z.number().optional().describe("End line for replaceRange or delete"),
      afterLine: z.number().optional().describe("Insert content after this line number"),
      newContent: z.string().optional().describe("Replacement content"),
      content: z.string().optional().describe("Content to insert"),
    }),
  },
  list_available_skills: {
    description: "List all available Claude skills in the ~/.claude/skills directory.",
    schema: z.object({}),
  },
  get_skill_by_name: {
    description: "Get the content of a specific skill by name.",
    schema: z.object({
      name: z.string().describe("Skill name to retrieve"),
    }),
  },
  // ── Evidence tools (Phase 2 session mining) ──
  mine_sessions: {
    description: "Mine session history for evidence related to a topic using full-text search and AI classification.",
    schema: z.object({
      topic: z.string().describe("The topic or claim to find evidence for"),
      limit: z.number().optional().describe("Max evidence items to return (default: 20)"),
    }),
  },
  get_evidence_detail: {
    description: "Get full message context for a specific evidence item from a session.",
    schema: z.object({
      sessionId: z.string().describe("Session ID containing the evidence"),
      messageIndex: z.number().describe("Message index within the session"),
      contextWindow: z.number().optional().describe("Number of surrounding messages to include (default: 3)"),
    }),
  },
  get_evidence_timeline: {
    description: "Arrange evidence items chronologically and return a timeline view.",
    schema: z.object({
      sessionIds: z.array(z.string()).describe("List of session IDs to arrange chronologically"),
    }),
  },
  // ── Ingestion tools (Phase 3 source material) ──
  get_source_material: {
    description: "Get the complete assembled source material package including user brief, external sources, and repo analyses.",
    schema: z.object({}),
  },
  get_external_source: {
    description: "Get full parsed content for a specific external URL source by index.",
    schema: z.object({
      index: z.number().describe("Zero-based index of the external source"),
    }),
  },
  get_repo_analysis: {
    description: "Get full repository analysis by index.",
    schema: z.object({
      index: z.number().describe("Zero-based index of the repository"),
    }),
  },
  get_content_brief: {
    description: "Get the structured content brief extracted from the user's text input.",
    schema: z.object({}),
  },
};

// ── Factory ──

/**
 * Creates an MCP tool instance that routes to the appropriate handler.
 */
function createMcpTool(
  toolName: string,
  workspaceId: string,
) {
  const config = TOOL_SCHEMAS[toolName];
  if (!config) throw new Error(`No schema defined for tool: ${toolName}`);

  const group = TOOL_NAME_TO_GROUP[toolName];
  if (!group) throw new Error(`No group mapping for tool: ${toolName}`);

  return tool(
    toolName,
    config.description,
    config.schema.shape,
    async (args: Record<string, unknown>) => {
      try {
        let result: unknown;
        if (group === "skill") {
          result = await SKILL_HANDLER(toolName, args);
        } else {
          const handler = TOOL_GROUP_HANDLERS[group];
          if (!handler) throw new Error(`No handler for group: ${group}`);
          result = await handler(workspaceId, toolName, args);
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
        };
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Error: ${errMsg}` }],
          isError: true,
        };
      }
    },
  );
}

/**
 * Returns the list of tool names for a given tool group.
 */
function getToolNamesForGroup(group: string): string[] {
  return Object.entries(TOOL_NAME_TO_GROUP)
    .filter(([, g]) => g === group)
    .map(([name]) => name);
}

/**
 * Creates an MCP server configured with the appropriate tools for the given agent type.
 *
 * @param agentType - The agent whose tools should be provided.
 * @param workspaceId - The workspace context for tool execution.
 * @returns A configured MCP server ready to pass to query().
 */
export function createAgentMcpServer(agentType: AgentType, workspaceId: string) {
  const groups = AGENT_TOOL_GROUPS[agentType];
  if (!groups) {
    throw new Error(`Unknown agent type: ${agentType}`);
  }

  const mcpTools = groups
    .flatMap(getToolNamesForGroup)
    .map((name) => createMcpTool(name, workspaceId));

  return createSdkMcpServer({
    name: `sessionforge-${agentType}`,
    tools: mcpTools,
  });
}

/**
 * Creates an MCP server with a custom set of tool groups.
 * Useful for non-standard agent configurations (e.g., content-generator, API route).
 *
 * @param name - Server name for identification.
 * @param toolGroups - Array of tool group names to include.
 * @param workspaceId - The workspace context for tool execution.
 */
export function createCustomMcpServer(
  name: string,
  toolGroups: string[],
  workspaceId: string,
) {
  const mcpTools = toolGroups
    .flatMap(getToolNamesForGroup)
    .map((toolName) => createMcpTool(toolName, workspaceId));

  return createSdkMcpServer({ name, tools: mcpTools });
}
