/**
 * Changelog writer agent that summarizes recent sessions into a changelog post.
 * Uses tool-calling to list sessions, fetch summaries, and create a published post.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getModelForAgent } from "../orchestration/model-selector";
import { getToolsForAgent } from "../orchestration/tool-registry";
import { handleSessionReaderTool } from "../tools/session-reader";
import { handlePostManagerTool } from "../tools/post-manager";
import { CHANGELOG_PROMPT } from "../prompts/changelog";
import { createSSEStream, sseResponse } from "../orchestration/streaming";

const client = new Anthropic();

/** Input parameters for the changelog writer agent. */
interface ChangelogWriterInput {
  /** Workspace to read sessions from and publish the changelog post to. */
  workspaceId: string;
  /** Number of past days to include in the changelog. */
  lookbackDays: number;
  /** Optional project name to narrow the session query. */
  projectFilter?: string;
  /** Optional extra instructions appended to the agent prompt. */
  customInstructions?: string;
}

/**
 * Starts a streaming changelog generation run and returns an SSE response.
 * The agent lists sessions in the lookback window, fetches their summaries,
 * and creates a changelog post via tool calls.
 *
 * @param input - Configuration for the changelog run.
 * @returns A streaming SSE {@link Response} with status, tool, and text events.
 */
export function streamChangelogWriter(input: ChangelogWriterInput): Response {
  const { stream, send, close } = createSSEStream();

  const run = async () => {
    try {
      const model = getModelForAgent("changelog-writer");
      const tools = getToolsForAgent("changelog-writer");

      const userMessage = input.customInstructions
        ? `Generate a changelog for the last ${input.lookbackDays} days${input.projectFilter ? ` for project "${input.projectFilter}"` : ""}. First list sessions in the timeframe, then get summaries for each, then create a changelog post.\n\nAdditional instructions: ${input.customInstructions}`
        : `Generate a changelog for the last ${input.lookbackDays} days${input.projectFilter ? ` for project "${input.projectFilter}"` : ""}. First use list_sessions_by_timeframe, then get_session_summary for notable sessions, then create a changelog post with create_post.`;

      const messages: Anthropic.MessageParam[] = [
        { role: "user", content: userMessage },
      ];

      send("status", { phase: "starting", message: "Generating changelog..." });

      let response = await client.messages.create({
        model,
        max_tokens: 8192,
        system: CHANGELOG_PROMPT,
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
                const errMsg = error instanceof Error ? error.message : String(error);
                send("tool_result", { tool: toolUse.name, success: false, error: errMsg });
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
          system: CHANGELOG_PROMPT,
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
      send("error", { message: error instanceof Error ? error.message : String(error) });
    } finally {
      close();
    }
  };

  run();
  return sseResponse(stream);
}

async function dispatchTool(
  workspaceId: string,
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<unknown> {
  if (toolName.startsWith("get_session") || toolName === "list_sessions_by_timeframe") {
    return handleSessionReaderTool(workspaceId, toolName, toolInput);
  }
  if (toolName === "create_post" || toolName === "update_post" || toolName === "get_post" || toolName === "get_markdown") {
    return handlePostManagerTool(workspaceId, toolName, toolInput);
  }
  throw new Error(`Unknown tool: ${toolName}`);
}
