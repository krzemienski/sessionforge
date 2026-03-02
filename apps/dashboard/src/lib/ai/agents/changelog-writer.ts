import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { getModelForAgent } from "../orchestration/model-selector";
import { getToolsForAgent } from "../orchestration/tool-registry";
import { withRetry, isRateLimitError } from "../orchestration/retry";
import { handleSessionReaderTool } from "../tools/session-reader";
import { handlePostManagerTool } from "../tools/post-manager";
import { CHANGELOG_PROMPT } from "../prompts/changelog";
import { createSSEStream, sseResponse } from "../orchestration/streaming";
import { db } from "@/lib/db";
import { agentRuns } from "../../../../../../packages/db/src/schema";

const client = new Anthropic();

interface ChangelogWriterInput {
  workspaceId: string;
  lookbackDays: number;
  projectFilter?: string;
  customInstructions?: string;
}

const RETRY_CONFIG = {
  maxAttempts: 3,
  delays: [1000, 4000, 16000],
  rateLimitDelay: 60000,
};

export function streamChangelogWriter(input: ChangelogWriterInput): Response {
  const { stream, send, close } = createSSEStream();

  const run = async () => {
    // Create agent run record for observability
    let agentRunId: string | undefined;
    try {
      const [agentRun] = await db
        .insert(agentRuns)
        .values({
          workspaceId: input.workspaceId,
          agentType: "changelog-writer",
          status: "running",
          inputMetadata: {
            lookbackDays: input.lookbackDays,
            projectFilter: input.projectFilter,
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
      const model = getModelForAgent("changelog-writer");
      const tools = getToolsForAgent("changelog-writer");

      const userMessage = input.customInstructions
        ? `Generate a changelog for the last ${input.lookbackDays} days${input.projectFilter ? ` for project "${input.projectFilter}"` : ""}. First list sessions in the timeframe, then get summaries for each, then create a changelog post.\n\nAdditional instructions: ${input.customInstructions}`
        : `Generate a changelog for the last ${input.lookbackDays} days${input.projectFilter ? ` for project "${input.projectFilter}"` : ""}. First use list_sessions_by_timeframe, then get_session_summary for notable sessions, then create a changelog post with create_post.`;

      const messages: Anthropic.MessageParam[] = [
        { role: "user", content: userMessage },
      ];

      send("status", { phase: "starting", message: "Generating changelog..." });

      const { result: initialResponse, attempts: initialAttempts } =
        await withRetry(
          () =>
            client.messages.create({
              model,
              max_tokens: 8192,
              system: CHANGELOG_PROMPT,
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

        const { result: nextResponse, attempts: nextAttempts } =
          await withRetry(
            () =>
              client.messages.create({
                model,
                max_tokens: 8192,
                system: CHANGELOG_PROMPT,
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
  if (toolName === "create_post" || toolName === "update_post" || toolName === "get_post" || toolName === "get_markdown") {
    return handlePostManagerTool(workspaceId, toolName, toolInput);
  }
  throw new Error(`Unknown tool: ${toolName}`);
}
