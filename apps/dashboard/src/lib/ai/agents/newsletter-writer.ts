/**
 * Newsletter writer agent that generates email digest posts from recent sessions.
 * Uses the Agent SDK with MCP tools to list sessions by timeframe, aggregate top
 * insights, and create a newsletter post, streaming progress events over SSE.
 */

import { NEWSLETTER_PROMPT } from "../prompts/newsletter";
import { createAgentMcpServer } from "../mcp-server-factory";
import { runAgentStreaming } from "../agent-runner";

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
 *
 * @param input - Configuration for the newsletter run.
 * @returns A streaming SSE {@link Response} with status, tool, and text events.
 */
export function streamNewsletterWriter(input: NewsletterWriterInput): Response {
  const userMessage = input.customInstructions
    ? `Generate a newsletter email digest for the last ${input.lookbackDays} day${input.lookbackDays === 1 ? "" : "s"}. First use list_sessions_by_timeframe to find sessions in the window, then use get_top_insights to surface the most interesting technical moments, then create a newsletter post with create_post using contentType "newsletter".\n\nAdditional instructions: ${input.customInstructions}`
    : `Generate a newsletter email digest for the last ${input.lookbackDays} day${input.lookbackDays === 1 ? "" : "s"}. First use list_sessions_by_timeframe to find sessions in the window, then use get_top_insights to surface the most interesting technical moments, then create a newsletter post with create_post using contentType "newsletter".`;

  const mcpServer = createAgentMcpServer("newsletter-writer", input.workspaceId);

  return runAgentStreaming(
    {
      agentType: "newsletter-writer",
      workspaceId: input.workspaceId,
      systemPrompt: NEWSLETTER_PROMPT,
      userMessage,
      mcpServer,
      trackRun: false,
    },
  );
}
