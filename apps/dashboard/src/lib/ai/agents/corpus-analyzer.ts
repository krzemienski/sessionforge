/**
 * Corpus analyzer agent for cross-session pattern detection.
 * Unlike insight-extractor (which analyzes ONE session), this agent
 * receives ALL sessions in a lookback window and identifies patterns
 * that span multiple sessions — recurring themes, skill evolution,
 * corrections, breakthroughs, and failure recovery arcs.
 */

import { createAgentMcpServer } from "../mcp-server-factory";
import { runAgent } from "../agent-runner";
import { CORPUS_ANALYSIS_PROMPT } from "../prompts/corpus-analysis";

interface AnalyzeCorpusInput {
  workspaceId: string;
  lookbackDays: number;
  topicFilter?: string;
  traceId?: string;
}

interface CorpusAnalysisResult {
  insightCount: number;
  text: string | null;
}

/**
 * Runs the corpus-analyzer agent against all sessions in a lookback window.
 *
 * The agent:
 * 1. Loads all session summaries via list_sessions_by_timeframe
 * 2. Deep-dives into promising sessions via get_session_messages
 * 3. Identifies cross-session patterns
 * 4. Creates insights (via create_insight) backed by multi-session evidence
 */
export async function analyzeCorpus(
  input: AnalyzeCorpusInput,
): Promise<CorpusAnalysisResult> {
  const mcpServer = createAgentMcpServer("corpus-analyzer", input.workspaceId);

  const topicClause = input.topicFilter
    ? ` Focus especially on sessions related to "${input.topicFilter}".`
    : "";

  const userMessage = `Analyze all sessions from the last ${input.lookbackDays} days. Use list_sessions_by_timeframe with lookbackDays=${input.lookbackDays} to get every session. Then identify cross-session patterns and create insights for the best ones.${topicClause}`;

  const result = await runAgent(
    {
      agentType: "corpus-analyzer",
      workspaceId: input.workspaceId,
      systemPrompt: CORPUS_ANALYSIS_PROMPT,
      userMessage,
      mcpServer,
      maxTurns: 35,
      traceId: input.traceId,
    },
    {
      lookbackDays: input.lookbackDays,
      topicFilter: input.topicFilter,
      workspaceId: input.workspaceId,
    },
  );

  // Count how many create_insight tool calls were made
  const insightCount = result.toolResults.filter(
    (r) => r.tool === "mcp__tools__create_insight",
  ).length;

  return { insightCount, text: result.text };
}
