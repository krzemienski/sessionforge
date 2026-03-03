/**
 * Social writer agent for generating platform-specific social media content.
 * Uses Anthropic tool-calling to fetch insight data and save drafted posts via SSE streaming.
 */

import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { getModelForAgent } from "../orchestration/model-selector";
import { getToolsForAgent } from "../orchestration/tool-registry";
import { withRetry, isRateLimitError } from "../orchestration/retry";
import { handleSessionReaderTool } from "../tools/session-reader";
import { handleInsightTool } from "../tools/insight-tools";
import { handlePostManagerTool } from "../tools/post-manager";
import { getActiveSkillsForAgentType, buildSkillSystemPromptSuffix } from "../tools/skill-loader";
import { TWITTER_THREAD_PROMPT } from "../prompts/social/twitter-thread";
import { LINKEDIN_PROMPT } from "../prompts/social/linkedin-post";
import { createSSEStream, sseResponse } from "../orchestration/streaming";
import { db } from "@/lib/db";
import { agentRuns } from "../../../../../../packages/db/src/schema";
import { injectStyleProfile } from "@/lib/style/profile-injector";

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

const RETRY_CONFIG = {
  maxAttempts: 3,
  delays: [1000, 4000, 16000],
  rateLimitDelay: 60000,
};


export function streamSocialWriter(input: SocialWriterInput): Response {
  const { stream, send, close } = createSSEStream();

  const run = async () => {
    // Create agent run record for observability
    let agentRunId: string | undefined;
    try {
      const [agentRun] = await db
        .insert(agentRuns)
        .values({
          workspaceId: input.workspaceId,
          agentType: "social-writer",
          status: "running",
          inputMetadata: {
            insightId: input.insightId,
            platform: input.platform,
          },
        })
        .returning();
      agentRunId = agentRun.id;
    } catch {
      // Logging failure should not block agent execution
    }

    let totalAttempts = 0;

    const retryOptions = {
      ...RETRY_CONFIG,
      onRetry: (attempt: number, error: unknown, delay: number) => {
        const rateLimit = isRateLimitError(error);
        send("retry_status", {
          attempt,
          maxAttempts: RETRY_CONFIG.maxAttempts,
          delayMs: delay,
          isRateLimit: rateLimit,
          message: rateLimit
            ? `Rate limited. Retrying in ${delay / 1000}s...`
            : `Retrying... attempt ${attempt} of 3`,
        });
      },
    };

    try {
      const model = getModelForAgent("social-writer");
      const tools = getToolsForAgent("social-writer");
      const activeSkills = await getActiveSkillsForAgentType(input.workspaceId, "social");
      const styleInjectedPrompt = await injectStyleProfile(PROMPTS[input.platform], input.workspaceId);
      const systemPrompt = styleInjectedPrompt + buildSkillSystemPromptSuffix(activeSkills);

      const userMessage = input.customInstructions
        ? `Create a ${input.platform} post about insight "${input.insightId}". First fetch insight details. Then create the post with content_type "${CONTENT_TYPES[input.platform]}". When calling create_post, set aiDraftMarkdown equal to the markdown content.\n\nAdditional instructions: ${input.customInstructions}`
        : `Create a ${input.platform} post about insight "${input.insightId}". First fetch insight details and session data. Then save it with create_post using content_type "${CONTENT_TYPES[input.platform]}". When calling create_post, set aiDraftMarkdown equal to the markdown content.`;

      const messages: Anthropic.MessageParam[] = [
        { role: "user", content: userMessage },
      ];

      send("status", { phase: "starting", message: `Writing ${input.platform} content...` });

      const { result: initialResponse, attempts: initialAttempts } =
        await withRetry(
          () =>
            client.messages.create({
              model,
              max_tokens: 4096,
              system: systemPrompt,
              tools: tools as Anthropic.Tool[],
              messages,
            }),
          retryOptions
        );
      totalAttempts += initialAttempts;

      let response = initialResponse;

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

        const { result: nextResponse, attempts: nextAttempts } =
          await withRetry(
            () =>
              client.messages.create({
                model,
                max_tokens: 4096,
                system: systemPrompt,
                tools: tools as Anthropic.Tool[],
                messages,
              }),
            retryOptions
          );
        totalAttempts += nextAttempts;
        response = nextResponse;
      }

      for (const block of response.content) {
        if (block.type === "text") {
          send("text", { content: block.text });
        }
      }

      if (agentRunId) {
        try {
          await db
            .update(agentRuns)
            .set({
              status: "completed",
              completedAt: new Date(),
              attemptCount: totalAttempts,
              resultMetadata: { usage: response.usage },
            })
            .where(eq(agentRuns.id, agentRunId));
        } catch {
          // DB update failure should not prevent success event
        }
      }

      send("complete", { usage: response.usage });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (agentRunId) {
        try {
          await db
            .update(agentRuns)
            .set({
              status: "failed",
              completedAt: new Date(),
              attemptCount: totalAttempts,
              errorMessage,
            })
            .where(eq(agentRuns.id, agentRunId));
        } catch {
          // DB update failure should not prevent error event
        }
      }

      send("error", { message: errorMessage });
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
