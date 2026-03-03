/**
 * Newsletter writer agent that generates email digest posts from recent sessions.
 * Uses tool-calling to list sessions by timeframe, aggregate top insights, and
 * create a newsletter post, streaming progress events over SSE as it works.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getModelForAgent } from "../orchestration/model-selector";
import { getToolsForAgent } from "../orchestration/tool-registry";
import { handleSessionReaderTool } from "../tools/session-reader";
import { handleInsightTool } from "../tools/insight-tools";
import { handlePostManagerTool } from "../tools/post-manager";
import { NEWSLETTER_PROMPT } from "../prompts/newsletter";
import { createSSEStream, sseResponse } from "../orchestration/streaming";

const client = new Anthropic();

/** Input parameters for the newsletter writer agent. */
interface NewsletterWriterInput {
  /** Workspace to read sessions from and publish the newsletter post to. */
  workspaceId: string;
  /** Number of past days to include in the digest (typically 1, 7, or 30). */
  lookbackDays: number;
  /** Optional extra instructions appended to the agent prompt. */
  customInstructions?: string;
}

/**
 * Starts a streaming newsletter generation run and returns an SSE response.
 * The agent lists sessions in the lookback window, fetches top insights,
 * and creates a newsletter post via tool calls.
 *
 * @param input - Configuration for the newsletter run.
 * @returns A streaming SSE {@link Response} with status, tool, and text events.
 */
export function streamNewsletterWriter(input: NewsletterWriterInput): Response {
  const { stream, send, close } = createSSEStream();

  const run = async () => {
    try {
      const model = getModelForAgent("newsletter-writer");
      const tools = getToolsForAgent("newsletter-writer");

      const userMessage = input.customInstructions
        ? `Generate a newsletter email digest for the last ${input.lookbackDays} day${input.lookbackDays === 1 ? "" : "s"}. First use list_sessions_by_timeframe to find sessions in the window, then use get_top_insights to surface the most interesting technical moments, then create a newsletter post with create_post using contentType "newsletter".\n\nAdditional instructions: ${input.customInstructions}`
        : `Generate a newsletter email digest for the last ${input.lookbackDays} day${input.lookbackDays === 1 ? "" : "s"}. First use list_sessions_by_timeframe to find sessions in the window, then use get_top_insights to surface the most interesting technical moments, then create a newsletter post with create_post using contentType "newsletter".`;

      const messages: Anthropic.MessageParam[] = [
        { role: "user", content: userMessage },
      ];

      send("status", {
        phase: "starting",
        message: "Generating newsletter digest...",
      });

      let response = await client.messages.create({
        model,
        max_tokens: 8192,
        system: NEWSLETTER_PROMPT,
        tools: tools as Anthropic.Tool[],
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
          system: NEWSLETTER_PROMPT,
          tools: tools as Anthropic.Tool[],
          messages,
        });
      }

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
 * Supports session reader, insight, and post manager tools.
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
  if (
    toolName === "create_post" ||
    toolName === "update_post" ||
    toolName === "get_post" ||
    toolName === "get_markdown"
  ) {
    return handlePostManagerTool(workspaceId, toolName, toolInput);
  }
  throw new Error(`Unknown tool: ${toolName}`);
}
