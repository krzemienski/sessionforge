/**
 * Corpus analyzer agent for cross-session pattern detection.
 * Unlike insight-extractor (which analyzes ONE session), this agent
 * receives ALL sessions in a lookback window and identifies patterns
 * that span multiple sessions — recurring themes, skill evolution,
 * corrections, breakthroughs, and failure recovery arcs.
 *
 * Used by the automation pipeline during the "extracting" stage.
 */

import { createAgentMcpServer } from "../mcp-server-factory";
import { runAgent } from "../agent-runner";
import { CORPUS_ANALYSIS_PROMPT } from "../prompts/corpus-analysis";

/**
 * Input parameters for corpus analysis.
 * @property {string} workspaceId - The workspace to analyze.
 * @property {number} lookbackDays - Number of days to scan for sessions.
 * @property {string} [topicFilter] - Optional topic to focus analysis on.
 * @property {string} [traceId] - Trace ID for observability correlation.
 */
interface AnalyzeCorpusInput {
  workspaceId: string;
  lookbackDays: number;
  topicFilter?: string;
  traceId?: string;
}

/**
 * Result from corpus analysis.
 * @property {number} insightCount - Number of insights created by the agent.
 * @property {string | null} text - Final text summary from the agent.
 */
interface CorpusAnalysisResult {
  insightCount: number;
  text: string | null;
}

/**
 * Runs the corpus-analyzer agent against all sessions in a lookback window.
 *
 * Agent workflow:
 * 1. Loads all session summaries via list_sessions_by_timeframe tool
 * 2. Deep-dives into promising sessions via get_session_messages tool
 * 3. Identifies cross-session patterns and trends
 * 4. Creates insights (via create_insight tool) backed by multi-session evidence
 *
 * Quality gate: Scores each created insight using composite formula:
 * (novelty × 3) + (tool_discovery × 3) + (before_after × 2) + (failure_recovery × 3) + (reproducibility × 1) + (scale × 1)
 * Caps score at 65 and filters for score >= 15. Logs metrics for observability.
 *
 * @param {AnalyzeCorpusInput} input - Configuration for analysis.
 * @returns {Promise<CorpusAnalysisResult>} Insight count and summary text from the agent.
 * @throws {Error} If agent execution fails or MCP tools fail.
 *
 * @example
 * const result = await analyzeCorpus({
 *   workspaceId: "ws_123",
 *   lookbackDays: 30,
 *   topicFilter: "authentication"
 * });
 * console.log(`Created ${result.insightCount} insights`);
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
  const createCalls = result.toolResults.filter(
    (r) => r.tool === "mcp__tools__create_insight",
  );
  const insightCount = createCalls.length;

  // Quality gate: log metrics for observability
  const scores = createCalls
    .map((r) => {
      try {
        const input = r.result as Record<string, unknown>;
        const s = input.scores as Record<string, number> | undefined;
        if (!s) return null;
        const composite =
          (s.novelty ?? 0) * 3 +
          (s.tool_discovery ?? 0) * 3 +
          (s.before_after ?? 0) * 2 +
          (s.failure_recovery ?? 0) * 3 +
          (s.reproducibility ?? 0) * 1 +
          (s.scale ?? 0) * 1;
        return Math.min(composite, 65);
      } catch {
        return null;
      }
    })
    .filter((s): s is number => s !== null);

  const aboveThreshold = scores.filter((s) => s >= 15).length;
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  console.log(
    `[corpus-analyzer] Quality gate: ${insightCount} insights created, ${aboveThreshold}/${scores.length} above threshold (avg score: ${avgScore})`
  );

  return { insightCount, text: result.text };
}
