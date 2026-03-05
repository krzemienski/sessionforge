/**
 * Tool registry for AI agents.
 * Maps each agent type to the subset of Anthropic tool definitions it is
 * permitted to call, providing a single point of control for tool access.
 */

import { sessionReaderTools } from "../tools/session-reader";
import { insightTools } from "../tools/insight-tools";
import { postManagerTools } from "../tools/post-manager";
import { markdownEditorTools } from "../tools/markdown-editor";
import { skillLoaderTools } from "../tools/skill-loader";
import { githubContextTools } from "../tools/github-context";

/** Union of all recognised agent identifiers in the system. */
export type AgentType =
  | "insight-extractor"
  | "blog-writer"
  | "social-writer"
  | "changelog-writer"
  | "editor-chat"
  | "newsletter-writer"
  | "evidence-writer"
  | "repurpose-writer"
  | "supplementary-writer";

/** Shape of an Anthropic tool definition passed to `client.messages.create`. */
type AnthropicTool = {
  /** Unique tool name the model uses when requesting a call. */
  name: string;
  /** Human-readable description shown to the model as guidance. */
  description: string;
  /** JSON Schema defining accepted input parameters. */
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

/**
 * Central registry of all available tool groups, keyed by a short name.
 * Each entry maps to an array of typed Anthropic tool definitions.
 */
const ALL_TOOLS: Record<string, AnthropicTool[]> = {
  session: sessionReaderTools as AnthropicTool[],
  insight: insightTools as AnthropicTool[],
  post: postManagerTools as AnthropicTool[],
  markdown: markdownEditorTools as AnthropicTool[],
  skill: skillLoaderTools as AnthropicTool[],
  github: githubContextTools as AnthropicTool[],
};

/**
 * Declares which tool groups each agent type may access.
 * Agents receive only the tools listed here, limiting their capabilities
 * to what is appropriate for their task.
 */
const AGENT_TOOL_SETS: Record<AgentType, (keyof typeof ALL_TOOLS)[]> = {
  "insight-extractor": ["session", "insight"],
  "blog-writer": ["session", "insight", "post", "skill", "github"],
  "social-writer": ["session", "insight", "post"],
  "changelog-writer": ["session", "post", "github"],
  "editor-chat": ["post", "markdown"],
  "newsletter-writer": ["session", "insight", "post"],
  "evidence-writer": ["session", "insight", "post"],
  "repurpose-writer": ["post"],
  "supplementary-writer": ["post"],
};

/**
 * Returns the merged list of Anthropic tool definitions for the given agent.
 *
 * Looks up the agent's permitted tool groups in `AGENT_TOOL_SETS` and
 * concatenates the corresponding arrays from `ALL_TOOLS`.
 *
 * @param agentType - The agent whose tools should be retrieved.
 * @returns A flat array of tool definitions ready to pass to the Anthropic SDK.
 */
export function getToolsForAgent(agentType: AgentType): AnthropicTool[] {
  const toolSetKeys = AGENT_TOOL_SETS[agentType];
  return toolSetKeys.flatMap((key) => ALL_TOOLS[key]);
}
