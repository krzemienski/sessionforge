/**
 * Blog writer agent that generates blog posts from session insights.
 * Uses the Anthropic SDK with tool use to fetch insight data and create posts,
 * streaming progress events over SSE as the agent works.
 */

import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { getModelForAgent } from "../orchestration/model-selector";
import { getToolsForAgent } from "../orchestration/tool-registry";
import { withRetry, isRateLimitError } from "../orchestration/retry";
import { handleSessionReaderTool } from "../tools/session-reader";
import { handleInsightTool } from "../tools/insight-tools";
import { handlePostManagerTool } from "../tools/post-manager";
import { handleSkillLoaderTool, getActiveSkillsForAgentType, buildSkillSystemPromptSuffix } from "../tools/skill-loader";
import { BLOG_TECHNICAL_PROMPT } from "../prompts/blog/technical";
import { BLOG_TUTORIAL_PROMPT } from "../prompts/blog/tutorial";
import { BLOG_CONVERSATIONAL_PROMPT } from "../prompts/blog/conversational";
import { createSSEStream, sseResponse } from "../orchestration/streaming";
import { db } from "@/lib/db";
import { agentRuns } from "../../../../../../packages/db/src/schema";
import { injectStyleProfile } from "@/lib/style/profile-injector";

const client = new Anthropic();

/** Writing style applied to the generated blog post. */
type BlogTone = "technical" | "tutorial" | "conversational";

const PROMPTS: Record<BlogTone, string> = {
  technical: BLOG_TECHNICAL_PROMPT,
  tutorial: BLOG_TUTORIAL_PROMPT,
  conversational: BLOG_CONVERSATIONAL_PROMPT,
};

/** Input parameters for the blog writer agent. */
interface BlogWriterInput {
  /** ID of the workspace owning the insight and target post. */
  workspaceId: string;
  /** ID of the insight to base the blog post on. */
  insightId: string;
  /** Writing tone for the generated post. Defaults to "technical". */
  tone?: BlogTone;
  /** Optional freeform instructions appended to the agent's prompt. */
  customInstructions?: string;
}

const RETRY_CONFIG = {
  maxAttempts: 3,
  delays: [1000, 4000, 16000],
  rateLimitDelay: 60000,
};


export function streamBlogWriter(input: BlogWriterInput): Response {
  const { stream, send, close } = createSSEStream();

  const run = async () => {
    // Create agent run record for observability
    let agentRunId: string | undefined;
    try {
      const [agentRun] = await db
        .insert(agentRuns)
        .values({
          workspaceId: input.workspaceId,
          agentType: "blog-writer",
          status: "running",
          inputMetadata: {
            insightId: input.insightId,
            tone: input.tone ?? "technical",
            workspaceId: input.workspaceId,
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
      const model = getModelForAgent("blog-writer");
      const tools = getToolsForAgent("blog-writer");
      const activeSkills = await getActiveSkillsForAgentType(input.workspaceId, "blog");
      const styleInjectedPrompt = await injectStyleProfile(PROMPTS[input.tone ?? "technical"], input.workspaceId);
      const systemPrompt = styleInjectedPrompt + buildSkillSystemPromptSuffix(activeSkills);

      const userMessage = input.customInstructions
        ? `Write a blog post about insight "${input.insightId}". First fetch the insight details and related session data. Then create the post. When calling create_post, set aiDraftMarkdown equal to the markdown content.\n\nAdditional instructions: ${input.customInstructions}`
        : `Write a blog post about insight "${input.insightId}". First fetch the insight details and related session data. Then create the post using create_post. When calling create_post, set aiDraftMarkdown equal to the markdown content.`;

      const messages: Anthropic.MessageParam[] = [
        { role: "user", content: userMessage },
      ];

      send("status", { phase: "starting", message: "Initializing blog writer..." });

      const { result: initialResponse, attempts: initialAttempts } =
        await withRetry(
          () =>
            client.messages.create({
              model,
              max_tokens: 8192,
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

        const { result: nextResponse, attempts: nextAttempts } =
          await withRetry(
            () =>
              client.messages.create({
                model,
                max_tokens: 8192,
                system: systemPrompt,
                tools: tools as Anthropic.Tool[],
                messages,
              }),
            retryOptions
          );
        totalAttempts += nextAttempts;
        response = nextResponse;
      }

      // Stream text blocks
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

/**
 * Routes a tool call from the agent to the appropriate tool handler.
 * Supports session reader, insight, post manager, and skill loader tools.
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
  if (
    toolName === "list_available_skills" ||
    toolName === "get_skill_by_name"
  ) {
    return handleSkillLoaderTool(toolName, toolInput);
  }
  throw new Error(`Unknown tool: ${toolName}`);
}
