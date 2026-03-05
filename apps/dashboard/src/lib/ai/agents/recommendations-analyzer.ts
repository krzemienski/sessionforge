/**
 * Recommendations analyzer agent that analyzes content performance data and
 * generates actionable recommendations for improving content strategy.
 * Uses the Agent SDK with MCP tools to fetch performance metrics, analyze
 * patterns, and persist recommendations.
 */

import { createCustomMcpServer } from "../mcp-server-factory";
import { runAgentStreaming } from "../agent-runner";
import { RECOMMENDATIONS_PROMPT } from "../prompts/recommendations";

/** Input parameters for the recommendations analyzer agent. */
interface RecommendationsAnalyzerInput {
  /** ID of the workspace to analyze and store recommendations for. */
  workspaceId: string;
  /** Optional freeform instructions appended to the agent's prompt. */
  customInstructions?: string;
}

/**
 * Starts the recommendations analyzer agent and returns an SSE streaming response.
 *
 * @param input - Workspace ID and optional custom instructions.
 * @returns An SSE `Response` that streams status, tool, and completion events.
 */
export function streamRecommendationsAnalyzer(
  input: RecommendationsAnalyzerInput
): Response {
  const mcpServer = createCustomMcpServer(
    "recommendations-analyzer",
    ["insight", "post"],
    input.workspaceId,
  );

  const userMessage = input.customInstructions
    ? `Analyze all available content performance data for this workspace and generate actionable recommendations. Then output a structured JSON recommendations report.\n\nAdditional instructions: ${input.customInstructions}`
    : `Analyze all available content performance data for this workspace and generate actionable recommendations. Use the available tools to gather comprehensive data. Then output a structured JSON recommendations report.`;

  return runAgentStreaming(
    {
      agentType: "supplementary-writer",
      workspaceId: input.workspaceId,
      systemPrompt: RECOMMENDATIONS_PROMPT,
      userMessage,
      mcpServer,
    },
    {
      workspaceId: input.workspaceId,
    },
  );
}
