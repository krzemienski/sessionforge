/**
 * Insight extractor agent for analyzing sessions and generating insights.
 * Runs an agentic loop with the Anthropic SDK, dispatching tool calls to
 * session-reader and insight-tools handlers until a final response is produced.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getModelForAgent } from "../orchestration/model-selector";
import { getToolsForAgent } from "../orchestration/tool-registry";
import { handleSessionReaderTool } from "../tools/session-reader";
import { handleInsightTool } from "../tools/insight-tools";
import { INSIGHT_EXTRACTION_PROMPT } from "../prompts/insight-extraction";

const client = new Anthropic();

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
 * Initiates a conversation with the model, executes tool calls in a loop
 * until the model produces a final text response, and returns the extracted
 * insight text along with token usage statistics.
 *
 * @param input - The workspace and session identifiers to process.
 * @returns An object containing the final insight text and Anthropic usage data.
 */
export async function extractInsight(input: ExtractInsightInput) {
  const model = getModelForAgent("insight-extractor");
  const tools = getToolsForAgent("insight-extractor");

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Analyze session "${input.sessionId}" and extract the most valuable insight. First use get_session_summary and get_session_messages to understand the session, then use create_insight to save it.`,
    },
  ];

  let response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: INSIGHT_EXTRACTION_PROMPT,
    tools: tools as Anthropic.Tool[],
    messages,
  });

  let createdInsight: {
    id: string;
    title: string;
    category: string;
    compositeScore: number;
  } | null = null;

  // Tool dispatch loop
  while (response.stop_reason === "tool_use") {
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ContentBlock & { type: "tool_use" } =>
        b.type === "tool_use"
    );

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

            if (
              toolUse.name === "create_insight" &&
              result &&
              typeof result === "object"
            ) {
              const r = result as {
                id: string;
                title: string;
                category: string;
                compositeScore: number;
              };
              if (!createdInsight) createdInsight = r;
            }

            return {
              type: "tool_result" as const,
              tool_use_id: toolUse.id,
              content: JSON.stringify(result),
            };
          } catch (error) {
            return {
              type: "tool_result" as const,
              tool_use_id: toolUse.id,
              content: `Error: ${error instanceof Error ? error.message : String(error)}`,
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
      max_tokens: 4096,
      system: INSIGHT_EXTRACTION_PROMPT,
      tools: tools as Anthropic.Tool[],
      messages,
    });
  }

  // Extract final text response
  const textBlock = response.content.find((b) => b.type === "text");
  return {
    result: textBlock?.type === "text" ? textBlock.text : null,
    usage: response.usage,
    insight: createdInsight,
  };
}

/**
 * Routes a model tool call to the appropriate handler.
 *
 * Delegates session-related tools to {@link handleSessionReaderTool} and
 * insight-related tools to {@link handleInsightTool}.
 *
 * @param workspaceId - The workspace context for the tool execution.
 * @param toolName - The name of the tool requested by the model.
 * @param toolInput - The input arguments provided by the model for the tool.
 * @returns The tool result to pass back to the model.
 * @throws {Error} If `toolName` does not match any registered handler.
 */
async function dispatchTool(
  workspaceId: string,
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<unknown> {
  // Route to appropriate handler
  if (
    toolName.startsWith("get_session") ||
    toolName === "list_sessions_by_timeframe"
  ) {
    return handleSessionReaderTool(workspaceId, toolName, toolInput);
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
