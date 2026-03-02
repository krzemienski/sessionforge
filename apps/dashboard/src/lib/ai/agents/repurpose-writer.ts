import Anthropic from "@anthropic-ai/sdk";
import { getModelForAgent } from "../orchestration/model-selector";
import { getToolsForAgent } from "../orchestration/tool-registry";
import type { AgentType } from "../orchestration/tool-registry";
import { handlePostManagerTool } from "../tools/post-manager";
import { handleInsightTool } from "../tools/insight-tools";
import { TWITTER_THREAD_PROMPT } from "../prompts/social/twitter-thread";
import { LINKEDIN_PROMPT } from "../prompts/social/linkedin-post";
import { CHANGELOG_FROM_POST_PROMPT } from "../prompts/repurpose/changelog-from-post";
import { TLDR_PROMPT } from "../prompts/repurpose/tldr";
import { createSSEStream, sseResponse } from "../orchestration/streaming";

const client = new Anthropic();

type TargetFormat = "twitter_thread" | "linkedin_post" | "changelog" | "tldr";

const PROMPTS: Record<TargetFormat, string> = {
  twitter_thread: TWITTER_THREAD_PROMPT,
  linkedin_post: LINKEDIN_PROMPT,
  changelog: CHANGELOG_FROM_POST_PROMPT,
  tldr: TLDR_PROMPT,
};

const CONTENT_TYPES: Record<
  TargetFormat,
  "twitter_thread" | "linkedin_post" | "changelog" | "custom"
> = {
  twitter_thread: "twitter_thread",
  linkedin_post: "linkedin_post",
  changelog: "changelog",
  tldr: "custom",
};

const FORMAT_LABELS: Record<TargetFormat, string> = {
  twitter_thread: "Twitter thread",
  linkedin_post: "LinkedIn post",
  changelog: "changelog entry",
  tldr: "TL;DR summary",
};

interface RepurposeWriterInput {
  workspaceId: string;
  sourcePostId: string;
  targetFormat: TargetFormat;
  customInstructions?: string;
}

export function streamRepurposeWriter(input: RepurposeWriterInput): Response {
  const { stream, send, close } = createSSEStream();

  const run = async () => {
    try {
      const model = getModelForAgent("repurpose-writer" as unknown as AgentType);
      const tools = getToolsForAgent("repurpose-writer" as unknown as AgentType);
      const systemPrompt = PROMPTS[input.targetFormat];
      const formatLabel = FORMAT_LABELS[input.targetFormat];
      const contentType = CONTENT_TYPES[input.targetFormat];

      const userMessage = input.customInstructions
        ? `Create a ${formatLabel} from the blog post with ID "${input.sourcePostId}". First fetch the post content using get_post. Then create the derived post using create_post with content_type "${contentType}" and sourceMetadata.parentPostId set to "${input.sourcePostId}".\n\nAdditional instructions: ${input.customInstructions}`
        : `Create a ${formatLabel} from the blog post with ID "${input.sourcePostId}". First fetch the post content using get_post. Then create the derived post using create_post with content_type "${contentType}" and sourceMetadata.parentPostId set to "${input.sourcePostId}".`;

      const messages: Anthropic.MessageParam[] = [
        { role: "user", content: userMessage },
      ];

      send("status", { phase: "starting", message: `Writing ${formatLabel}...` });

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

async function dispatchTool(
  workspaceId: string,
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<unknown> {
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
