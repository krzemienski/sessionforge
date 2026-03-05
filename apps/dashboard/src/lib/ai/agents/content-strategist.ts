/**
 * Content strategist agent that generates publishing recommendations from analytics data.
 * Uses the Anthropic SDK with tool use to analyse cadence, engagement, and available
 * insights, then persists actionable recommendations via streaming SSE.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getSonnetModel } from "../orchestration/model-selector";
import { analyticsTools, handleAnalyticsTool } from "../tools/analytics-tools";
import { recommendationTools, handleRecommendationTool } from "../tools/recommendation-tools";
import { insightTools } from "../tools/insight-tools";
import { handleInsightTool } from "../tools/insight-tools";
import { CONTENT_STRATEGIST_PROMPT } from "../prompts/content-strategist";
import { createSSEStream, sseResponse } from "../orchestration/streaming";

const client = new Anthropic();

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
  const { stream, send, close } = createSSEStream();

  const run = async () => {
    try {
      const model = getSonnetModel();
      const tools = [
        ...(analyticsTools as Anthropic.Tool[]),
        ...(recommendationTools as Anthropic.Tool[]),
        ...(insightTools as Anthropic.Tool[]),
      ];

      const userMessage = input.customInstructions
        ? `Analyse the publishing cadence, engagement metrics, and available insights for this workspace. Identify content gaps, surface high-scoring insights that haven't been converted, and create prioritised recommendations using create_recommendation.\n\nAdditional instructions: ${input.customInstructions}`
        : `Analyse the publishing cadence, engagement metrics, and available insights for this workspace. Identify content gaps, surface high-scoring insights (≥45 composite score) that haven't been converted to content, and save actionable recommendations using create_recommendation for each opportunity you find.`;

      const messages: Anthropic.MessageParam[] = [
        { role: "user", content: userMessage },
      ];

      send("status", { phase: "starting", message: "Initializing content strategist..." });

      let response = await client.messages.create({
        model,
        max_tokens: 8192,
        system: CONTENT_STRATEGIST_PROMPT,
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
                const result = await dispatchTool(
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

        response = await client.messages.create({
          model,
          max_tokens: 8192,
          system: CONTENT_STRATEGIST_PROMPT,
          tools,
          messages,
        });
      }

      // Stream text blocks
      for (const block of response.content) {
        if (block.type === "text") {
          send("text", { content: block.text });
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
 * Routes a tool call from the agent to the appropriate tool handler.
 * Supports analytics, recommendation, and insight tools.
 *
 * @param workspaceId - Workspace context passed to each handler.
 * @param toolName - Name of the tool requested by the agent.
 * @param toolInput - Arguments supplied by the agent for the tool call.
 * @returns The handler's result, serialised to the agent as JSON.
 * @throws {Error} When `toolName` does not match any known tool.
 */
async function dispatchTool(
  workspaceId: string,
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<unknown> {
  if (
    toolName === "get_publishing_cadence" ||
    toolName === "get_cadence_gaps" ||
    toolName === "get_engagement_metrics" ||
    toolName === "get_content_analytics"
  ) {
    return handleAnalyticsTool(workspaceId, toolName, toolInput);
  }
  if (
    toolName === "create_recommendation" ||
    toolName === "get_recommendations" ||
    toolName === "get_recommendation" ||
    toolName === "update_recommendation_status"
  ) {
    return handleRecommendationTool(workspaceId, toolName, toolInput);
  }
  if (
    toolName.startsWith("get_insight") ||
    toolName === "get_top_insights" ||
    toolName === "create_insight"
  ) {
    return handleInsightTool(workspaceId, toolName, toolInput);
  }
  throw new Error(`Unknown tool: ${toolName}`);
}
