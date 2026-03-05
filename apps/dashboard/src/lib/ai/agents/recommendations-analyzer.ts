/**
 * Recommendations analyzer agent that analyzes content performance data and
 * generates actionable recommendations for improving content strategy.
 * Uses the Anthropic SDK with tool use to fetch performance metrics, analyze
 * patterns, and persist recommendations, streaming progress events over SSE.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getOpusModel } from "../orchestration/model-selector";
import { handlePerformanceAnalyzerTool, performanceAnalyzerTools } from "../tools/performance-analyzer";
import { RECOMMENDATIONS_PROMPT } from "../prompts/recommendations";
import { createSSEStream, sseResponse } from "../orchestration/streaming";
import { db } from "@/lib/db";
import { contentRecommendations } from "@sessionforge/db";

const client = new Anthropic();

/** Maps recommendation dimension strings from the prompt to DB enum values. */
const DIMENSION_TO_TYPE: Record<
  string,
  "topic" | "format" | "length" | "keyword" | "improvement"
> = {
  topics: "topic",
  formats: "format",
  length: "length",
  keywords: "keyword",
  improvements: "improvement",
};

/** Maps priority strings to numeric confidence scores for storage. */
const PRIORITY_TO_CONFIDENCE: Record<string, number> = {
  high: 0.9,
  medium: 0.6,
  low: 0.3,
};

/** Input parameters for the recommendations analyzer agent. */
interface RecommendationsAnalyzerInput {
  /** ID of the workspace to analyze and store recommendations for. */
  workspaceId: string;
  /** Optional freeform instructions appended to the agent's prompt. */
  customInstructions?: string;
}

/** Shape of a single recommendation returned in the AI's JSON output. */
interface ParsedRecommendation {
  id: string;
  dimension: string;
  priority: string;
  title: string;
  recommendation: string;
  reasoning: string;
  supporting_data: Record<string, unknown>;
  expected_impact: string;
}

/** Shape of the structured JSON the agent outputs after analysis. */
interface RecommendationsOutput {
  generated_at: string;
  summary: string;
  recommendations: ParsedRecommendation[];
  underperforming_posts: unknown[];
}

/**
 * Starts the recommendations analyzer agent and returns an SSE streaming response.
 * The agent fetches performance metrics via tool use, then generates and persists
 * structured recommendations for the workspace.
 *
 * @param input - Workspace ID and optional custom instructions.
 * @returns An SSE `Response` that streams status, tool, and completion events.
 */
export function streamRecommendationsAnalyzer(
  input: RecommendationsAnalyzerInput
): Response {
  const { stream, send, close } = createSSEStream();

  const run = async () => {
    try {
      const model = getOpusModel();
      const tools = performanceAnalyzerTools as Anthropic.Tool[];

      const userMessage = input.customInstructions
        ? `Analyze all available content performance data for this workspace and generate actionable recommendations. Use the performance analysis tools to gather data across topics, formats, lengths, and engagement metrics. Then output a structured JSON recommendations report.\n\nAdditional instructions: ${input.customInstructions}`
        : `Analyze all available content performance data for this workspace and generate actionable recommendations. Use get_performance_by_topic, get_performance_by_format, get_performance_by_length, get_top_performing_posts, and get_underperforming_posts tools to gather comprehensive data. Then output a structured JSON recommendations report.`;

      const messages: Anthropic.MessageParam[] = [
        { role: "user", content: userMessage },
      ];

      send("status", {
        phase: "starting",
        message: "Initializing recommendations analyzer...",
      });

      let response = await client.messages.create({
        model,
        max_tokens: 8192,
        system: RECOMMENDATIONS_PROMPT,
        tools,
        messages,
      });

      while (response.stop_reason === "tool_use") {
        const toolUseBlocks = response.content.filter(
          (b): b is Anthropic.ContentBlock & { type: "tool_use" } =>
            b.type === "tool_use"
        );

        for (const toolUse of toolUseBlocks) {
          send("tool_use", { tool: toolUse.name, input: toolUse.input });
        }

        const toolResults: Anthropic.MessageParam = {
          role: "user",
          content: await Promise.all(
            toolUseBlocks.map(async (toolUse) => {
              try {
                const result = await handlePerformanceAnalyzerTool(
                  input.workspaceId,
                  toolUse.name,
                  toolUse.input as Record<string, unknown>
                );
                send("tool_result", { tool: toolUse.name, success: true });
                return {
                  type: "tool_result" as const,
                  tool_use_id: toolUse.id,
                  content: JSON.stringify(result),
                };
              } catch (error) {
                const errMsg =
                  error instanceof Error ? error.message : String(error);
                send("tool_result", {
                  tool: toolUse.name,
                  success: false,
                  error: errMsg,
                });
                return {
                  type: "tool_result" as const,
                  tool_use_id: toolUse.id,
                  content: `Error: ${errMsg}`,
                  is_error: true,
                };
              }
            })
          ),
        };

        messages.push({ role: "assistant", content: response.content });
        messages.push(toolResults);

        send("status", {
          phase: "analyzing",
          message: "Processing performance data...",
        });

        response = await client.messages.create({
          model,
          max_tokens: 8192,
          system: RECOMMENDATIONS_PROMPT,
          tools,
          messages,
        });
      }

      // Parse and persist the structured JSON output
      for (const block of response.content) {
        if (block.type === "text") {
          const output = parseRecommendationsOutput(block.text);
          if (output) {
            send("status", {
              phase: "saving",
              message: `Saving ${output.recommendations.length} recommendations...`,
            });
            await persistRecommendations(input.workspaceId, output);
            send("text", { content: block.text });
          } else {
            send("text", { content: block.text });
          }
        }
      }

      send("complete", { usage: response.usage });
    } catch (error) {
      send("error", {
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      close();
    }
  };

  run();
  return sseResponse(stream);
}

/**
 * Attempts to parse the agent's text output as a structured recommendations report.
 * Returns null if the text does not contain valid JSON.
 *
 * @param text - Raw text block from the agent's final message.
 * @returns Parsed output object, or null if parsing fails.
 */
function parseRecommendationsOutput(text: string): RecommendationsOutput | null {
  try {
    // The prompt instructs the model to return strict JSON with no markdown
    const trimmed = text.trim();
    const parsed = JSON.parse(trimmed);
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray(parsed.recommendations)
    ) {
      return parsed as RecommendationsOutput;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Persists parsed recommendations to the content_recommendations database table.
 * Skips entries whose dimension does not map to a recognised recommendation type.
 *
 * @param workspaceId - Workspace that owns the recommendations.
 * @param output - Structured recommendations report from the agent.
 */
async function persistRecommendations(
  workspaceId: string,
  output: RecommendationsOutput
): Promise<void> {
  const rows = output.recommendations
    .map((rec) => {
      const recommendationType = DIMENSION_TO_TYPE[rec.dimension];
      if (!recommendationType) return null;

      const confidenceScore =
        PRIORITY_TO_CONFIDENCE[rec.priority] ?? PRIORITY_TO_CONFIDENCE.low;

      return {
        workspaceId,
        recommendationType,
        title: rec.title,
        description: rec.recommendation,
        reasoning: rec.reasoning,
        supportingData: rec.supporting_data as Record<string, unknown>,
        confidenceScore,
      };
    })
    .filter(
      (row): row is NonNullable<typeof row> => row !== null
    );

  if (rows.length === 0) return;

  await db.insert(contentRecommendations).values(rows);
}
