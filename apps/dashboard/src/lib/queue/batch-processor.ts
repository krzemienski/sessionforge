/**
 * Batch processor for background job execution.
 * Processes extract_insights, generate_content, batch_archive, and batch_delete jobs
 * with concurrency-limited parallelism, progress tracking, and error isolation.
 * AI-heavy operations (extract insights, generate content) are capped at
 * MAX_CONCURRENT_AI_CALLS simultaneous Anthropic API calls to prevent rate limit errors.
 */

import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { posts } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";
import { extractInsight } from "@/lib/ai/agents/insight-extractor";
import { getModelForAgent } from "@/lib/ai/orchestration/model-selector";
import { getToolsForAgent } from "@/lib/ai/orchestration/tool-registry";
import { handleSessionReaderTool } from "@/lib/ai/tools/session-reader";
import { handleInsightTool } from "@/lib/ai/tools/insight-tools";
import { handlePostManagerTool } from "@/lib/ai/tools/post-manager";
import { handleSkillLoaderTool } from "@/lib/ai/tools/skill-loader";
import { BLOG_TECHNICAL_PROMPT } from "@/lib/ai/prompts/blog/technical";
import { getJob, updateJobProgress, completeJob, failJob } from "./job-tracker";

const client = new Anthropic();

/**
 * Records usage for a single batch operation item toward workspace plan limits.
 *
 * TODO: Wire this to the usage metering system when one is implemented.
 * Each item in a batch operation should count individually toward the workspace's
 * plan limits (e.g., AI insight extractions per month, content generations per month).
 * The metering system should:
 *   1. Look up the workspace's active subscription/plan
 *   2. Increment the usage counter for the given operation type
 *   3. Throw or return false if the workspace has exceeded its plan limits
 *
 * @param _workspaceId - The workspace to record usage for.
 * @param _operationType - The type of operation being metered (e.g. 'extract_insights', 'generate_content').
 * @param _itemCount - The number of items to count toward usage (defaults to 1).
 */
async function recordBatchUsage(
  _workspaceId: string,
  _operationType: "extract_insights" | "generate_content" | "batch_archive" | "batch_delete",
  _itemCount = 1
): Promise<void> {
  // TODO: Implement usage metering integration.
  // Example integration point:
  //   await usageMeter.increment(workspaceId, operationType, itemCount);
}

/** Maximum number of concurrent Anthropic API calls allowed at once. */
const MAX_CONCURRENT_AI_CALLS = 5;

/**
 * Semaphore that limits concurrent Anthropic API calls to prevent rate limit errors.
 * Queues requests beyond the concurrency cap and releases slots as calls complete.
 */
class Semaphore {
  private permits: number;
  private readonly queue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.permits++;
    }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

/** Shared rate limiter for all Anthropic API calls in the batch processor. */
const aiRateLimiter = new Semaphore(MAX_CONCURRENT_AI_CALLS);

/**
 * Routes a blog-writer tool call to the appropriate handler.
 *
 * @param workspaceId - Workspace context for tool execution.
 * @param toolName - Name of the tool requested by the model.
 * @param toolInput - Input arguments provided by the model.
 * @returns The tool result to pass back to the model.
 * @throws {Error} If `toolName` does not match any registered handler.
 */
async function dispatchBlogTool(
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

/**
 * Generates a blog post from a single insight without SSE streaming.
 * Runs the blog-writer agent to completion and returns the result.
 *
 * @param workspaceId - The workspace that owns the insight.
 * @param insightId - The insight to generate content from.
 * @param contentType - The type of content to generate (defaults to blog_post).
 * @returns The final model response text and token usage.
 */
async function generateContentFromInsight(
  workspaceId: string,
  insightId: string,
  contentType?: string
): Promise<{ result: string | null; usage: Anthropic.Usage }> {
  const model = getModelForAgent("blog-writer");
  const tools = getToolsForAgent("blog-writer");

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Generate a ${contentType ?? "blog_post"} from insight "${insightId}". First fetch the insight details, then create the post using create_post.`,
    },
  ];

  let response = await client.messages.create({
    model,
    max_tokens: 8192,
    system: BLOG_TECHNICAL_PROMPT,
    tools: tools as Anthropic.Tool[],
    messages,
  });

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
            const result = await dispatchBlogTool(
              workspaceId,
              toolUse.name,
              toolUse.input as Record<string, unknown>
            );
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
      max_tokens: 8192,
      system: BLOG_TECHNICAL_PROMPT,
      tools: tools as Anthropic.Tool[],
      messages,
    });
  }

  const textBlock = response.content.find((b) => b.type === "text");
  return {
    result: textBlock?.type === "text" ? textBlock.text : null,
    usage: response.usage,
  };
}

/**
 * Processes a batch insight extraction job.
 * Runs the insight-extractor agent for each session concurrently (up to
 * MAX_CONCURRENT_AI_CALLS at once), updating job progress after each item.
 * Stops early if the job is cancelled.
 *
 * @param jobId - The batch job record to track progress.
 * @param workspaceId - The workspace that owns the sessions.
 * @param sessionIds - Ordered list of session IDs to process.
 */
export async function processExtractInsights(
  jobId: string,
  workspaceId: string,
  sessionIds: string[]
): Promise<void> {
  let processedItems = 0;
  let successCount = 0;
  let errorCount = 0;
  let cancelled = false;

  try {
    await Promise.all(
      sessionIds.map((sessionId) =>
        aiRateLimiter.run(async () => {
          if (cancelled) return;

          // Check for cancellation before each item
          const job = await getJob(jobId);
          if (!job || job.status === "cancelled") {
            cancelled = true;
            return;
          }

          try {
            await extractInsight({ workspaceId, sessionId });
            successCount++;
            await recordBatchUsage(workspaceId, "extract_insights");
          } catch {
            errorCount++;
          }

          processedItems++;
          await updateJobProgress(jobId, { processedItems, successCount, errorCount });
        })
      )
    );

    await completeJob(jobId, { processedItems, successCount, errorCount });
  } catch (error) {
    await failJob(
      jobId,
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Processes a batch content generation job.
 * Runs the blog-writer agent for each insight concurrently (up to
 * MAX_CONCURRENT_AI_CALLS at once), updating job progress after each item.
 * Stops early if the job is cancelled.
 *
 * @param jobId - The batch job record to track progress.
 * @param workspaceId - The workspace that owns the insights.
 * @param insightIds - Ordered list of insight IDs to generate content from.
 * @param contentType - The type of content to generate for each insight.
 */
export async function processGenerateContent(
  jobId: string,
  workspaceId: string,
  insightIds: string[],
  contentType?: string
): Promise<void> {
  let processedItems = 0;
  let successCount = 0;
  let errorCount = 0;
  let cancelled = false;

  try {
    await Promise.all(
      insightIds.map((insightId) =>
        aiRateLimiter.run(async () => {
          if (cancelled) return;

          // Check for cancellation before each item
          const job = await getJob(jobId);
          if (!job || job.status === "cancelled") {
            cancelled = true;
            return;
          }

          try {
            await generateContentFromInsight(workspaceId, insightId, contentType);
            successCount++;
            await recordBatchUsage(workspaceId, "generate_content");
          } catch {
            errorCount++;
          }

          processedItems++;
          await updateJobProgress(jobId, { processedItems, successCount, errorCount });
        })
      )
    );

    await completeJob(jobId, { processedItems, successCount, errorCount });
  } catch (error) {
    await failJob(
      jobId,
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Processes a batch post operation job (archive, delete, publish, unpublish).
 * Applies the operation to each post in sequence, updating progress after each.
 * Stops early if the job is cancelled.
 *
 * @param jobId - The batch job record to track progress.
 * @param workspaceId - The workspace that owns the posts.
 * @param postIds - Ordered list of post IDs to operate on.
 * @param operation - The operation to apply: archive, delete, publish, or unpublish.
 */
export async function processPostBatch(
  jobId: string,
  workspaceId: string,
  postIds: string[],
  operation: "archive" | "delete" | "publish" | "unpublish"
): Promise<void> {
  let processedItems = 0;
  let successCount = 0;
  let errorCount = 0;

  try {
    for (const postId of postIds) {
      // Check for cancellation before each item
      const job = await getJob(jobId);
      if (!job || job.status === "cancelled") {
        return;
      }

      try {
        if (operation === "delete") {
          await db
            .delete(posts)
            .where(and(eq(posts.id, postId), eq(posts.workspaceId, workspaceId)));
        } else {
          const statusMap = {
            archive: "archived",
            publish: "published",
            unpublish: "draft",
          } as const;

          await db
            .update(posts)
            .set({ status: statusMap[operation] })
            .where(and(eq(posts.id, postId), eq(posts.workspaceId, workspaceId)));
        }
        successCount++;
        const usageType = operation === "delete" ? "batch_delete" : "batch_archive";
        await recordBatchUsage(workspaceId, usageType);
      } catch {
        errorCount++;
      }

      processedItems++;
      await updateJobProgress(jobId, { processedItems, successCount, errorCount });
    }

    await completeJob(jobId, { processedItems, successCount, errorCount });
  } catch (error) {
    await failJob(
      jobId,
      error instanceof Error ? error.message : String(error)
    );
  }
}
