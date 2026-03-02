import { sessionReaderTools } from "../tools/session-reader";
import { insightTools } from "../tools/insight-tools";
import { postManagerTools } from "../tools/post-manager";
import { markdownEditorTools } from "../tools/markdown-editor";
import { skillLoaderTools } from "../tools/skill-loader";

export type AgentType =
  | "insight-extractor"
  | "blog-writer"
  | "social-writer"
  | "changelog-writer"
  | "editor-chat";

type AnthropicTool = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

const ALL_TOOLS: Record<string, AnthropicTool[]> = {
  session: sessionReaderTools as AnthropicTool[],
  insight: insightTools as AnthropicTool[],
  post: postManagerTools as AnthropicTool[],
  markdown: markdownEditorTools as AnthropicTool[],
  skill: skillLoaderTools as AnthropicTool[],
};

const AGENT_TOOL_SETS: Record<AgentType, (keyof typeof ALL_TOOLS)[]> = {
  "insight-extractor": ["session", "insight"],
  "blog-writer": ["session", "insight", "post", "skill"],
  "social-writer": ["session", "insight", "post"],
  "changelog-writer": ["session", "post"],
  "editor-chat": ["post", "markdown"],
};

export function getToolsForAgent(agentType: AgentType): AnthropicTool[] {
  const toolSetKeys = AGENT_TOOL_SETS[agentType];
  return toolSetKeys.flatMap((key) => ALL_TOOLS[key]);
}
