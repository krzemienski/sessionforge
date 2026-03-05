/**
 * Content strategist agent that generates publishing recommendations from analytics data.
 * Uses the Agent SDK with MCP tools to analyse cadence, engagement, and available
 * insights, then persists actionable recommendations via streaming SSE.
 */

import { createCustomMcpServer } from "../mcp-server-factory";
import { runAgentStreaming } from "../agent-runner";
import { CONTENT_STRATEGIST_PROMPT } from "../prompts/content-strategist";

/** Input parameters for the content strategist agent. */
interface ContentStrategistInput {
  /** ID of the workspace to generate recommendations for. */
  workspaceId: string;
  /** Optional freeform instructions appended to the agent's prompt. */
  customInstructions?: string;
}

/**
 * Starts the content strategist agent and returns an SSE streaming response.
 * The agent fetches analytics, identifies high-scoring unused insights, and
 * creates prioritised content recommendations via tool use, emitting progress
 * events throughout.
 *
 * @param input - Workspace and optional custom instructions.
 * @returns An SSE `Response` that streams status, tool, and text events.
 */
export function streamContentStrategist(input: ContentStrategistInput): Response {
  const mcpServer = createCustomMcpServer(
    "content-strategist",
    ["insight", "analytics", "recommendation"],
    input.workspaceId,
  );

  const userMessage = input.customInstructions
    ? `Analyse the publishing cadence, engagement metrics, and available insights for this workspace. Identify content gaps, surface high-scoring insights that haven't been converted, and create prioritised recommendations using create_recommendation.\n\nAdditional instructions: ${input.customInstructions}`
    : `Analyse the publishing cadence, engagement metrics, and available insights for this workspace. Identify content gaps, surface high-scoring insights (≥45 composite score) that haven't been converted to content, and save actionable recommendations using create_recommendation for each opportunity you find.`;

  return runAgentStreaming(
    {
      agentType: "content-strategist",
      workspaceId: input.workspaceId,
      systemPrompt: CONTENT_STRATEGIST_PROMPT,
      userMessage,
      mcpServer,
    },
    {
      workspaceId: input.workspaceId,
    },
  );
}
