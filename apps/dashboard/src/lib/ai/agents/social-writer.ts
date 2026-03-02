/**
 * Social writer agent for generating platform-specific social media content.
 * Uses Anthropic tool-calling to fetch insight data and save drafted posts via SSE streaming.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getModelForAgent } from "../orchestration/model-selector";
import { getToolsForAgent } from "../orchestration/tool-registry";
import { handleSessionReaderTool } from "../tools/session-reader";
import { handleInsightTool } from "../tools/insight-tools";
import { handlePostManagerTool } from "../tools/post-manager";
import { TWITTER_THREAD_PROMPT } from "../prompts/social/twitter-thread";
import { LINKEDIN_PROMPT } from "../prompts/social/linkedin-post";
import { createSSEStream, sseResponse } from "../orchestration/streaming";

const client = new Anthropic();

/** Supported social media platforms for post generation. */
type SocialPlatform = "twitter" | "linkedin";

const PROMPTS: Record<SocialPlatform, string> = {
  twitter: TWITTER_THREAD_PROMPT,
  linkedin: LINKEDIN_PROMPT,
};

const CONTENT_TYPES: Record<SocialPlatform, "twitter_thread" | "linkedin_post"> = {
  twitter: "twitter_thread",
  linkedin: "linkedin_post",
};

/** Input parameters for the social writer agent. */
interface SocialWriterInput {
  /** Workspace context used to scope tool calls. */
  workspaceId: string;
  /** ID of the insight to base the social post on. */
  insightId: string;
  /** Target platform that determines the prompt and content type. */
  platform: SocialPlatform;
  /** Optional freeform guidance appended to the agent's user message. */
  customInstructions?: string;
}

/**
 * Starts the social writer agent and returns a streaming SSE response.
 * The agent fetches the specified insight, drafts platform-appropriate content,
 * and saves the post via tool calls, emitting progress events throughout.
 *
 * @param input - Workspace, insight, platform, and optional instructions.
 * @returns A Server-Sent Events `Response` that streams agent progress and results.
 */
export function streamSocialWriter(input: SocialWriterInput): Response {
  const { stream, send, close } = createSSEStream();

  const run = async () => {
    try {
      const model = getModelForAgent("social-writer");
      const tools = getToolsForAgent("social-writer");
      const systemPrompt = PROMPTS[input.platform];

      const userMessage = input.customInstructions
        ? `Create a ${input.platform} post about insight "${input.insightId}". First fetch insight details. Then create the post with content_type "${CONTENT_TYPES[input.platform]}".\n\nAdditional instructions: ${input.customInstructions}`
        : `Create a ${input.platform} post about insight "${input.insightId}". First fetch insight details and session data. Then save it with create_post using content_type "${CONTENT_TYPES[input.platform]}".`;

      const messages: Anthropic.MessageParam[] = [
        { role: "user", content: userMessage },
      ];

      send("status", { phase: "starting", message: `Writing ${input.platform} content...` });

      let response = await client.messages.create({
        model,
        max_tokens: 4096,
        system: systemPrompt,
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
                send("tool_result", { tool: toolUse.name, success: true, result });
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
          max_tokens: 4096,
          system: systemPrompt,
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
  if (toolName.startsWith("get_insight") || toolName === "get_top_insights" || toolName === "create_insight") {
    return handleInsightTool(workspaceId, toolName, toolInput);
  }
  if (toolName === "create_post" || toolName === "update_post" || toolName === "get_post" || toolName === "get_markdown") {
    return handlePostManagerTool(workspaceId, toolName, toolInput);
  }
  throw new Error(`Unknown tool: ${toolName}`);
}
