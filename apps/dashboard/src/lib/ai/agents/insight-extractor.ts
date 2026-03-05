/**
 * Insight extractor agent for analyzing sessions and generating insights.
 * Uses the Agent SDK with MCP tools to fetch session data and create insights.
 */

import { createAgentMcpServer } from "../mcp-server-factory";
import { runAgent } from "../agent-runner";
import { INSIGHT_EXTRACTION_PROMPT } from "../prompts/insight-extraction";

/** Input parameters for the insight extraction agent. */
interface ExtractInsightInput {
  /** The workspace that owns the session. */
  workspaceId: string;
  /** The session to analyze and extract an insight from. */
  sessionId: string;
}

/**
 * Runs the insight-extractor agent for a single session.
 *
 * @param input - The workspace and session identifiers to process.
 * @returns An object containing the final insight text.
 */
export async function extractInsight(input: ExtractInsightInput) {
  const mcpServer = createAgentMcpServer("insight-extractor", input.workspaceId);

  const result = await runAgent(
    {
      agentType: "insight-extractor",
      workspaceId: input.workspaceId,
      systemPrompt: INSIGHT_EXTRACTION_PROMPT,
      userMessage: `Analyze session "${input.sessionId}" and extract the most valuable insight. First use get_session_summary and get_session_messages to understand the session, then use create_insight to save it.`,
      mcpServer,
    },
    { sessionId: input.sessionId, workspaceId: input.workspaceId },
  );

  return { result: result.text, usage: null };
}
