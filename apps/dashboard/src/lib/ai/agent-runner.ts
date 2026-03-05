/**
 * Agent runner utility for the Agent SDK.
 * Replaces the repeated pattern of client.messages.create() + manual tool
 * dispatch loop with query() + MCP servers.
 *
 * Provides two entry points:
 * - runAgentStreaming(): For SSE-streaming agents (blog-writer, social-writer, etc.)
 * - runAgent(): For non-streaming agents (insight-extractor, content-generator, etc.)
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { createSSEStream, sseResponse } from "./orchestration/streaming";
import { getModelForAgent } from "./orchestration/model-selector";
import { db } from "@/lib/db";
import { agentRuns } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import type { AgentType } from "./orchestration/tool-registry";

// Allow the Agent SDK to spawn Claude subprocesses even when running
// inside a Claude Code session (which sets CLAUDECODE env var).
delete process.env.CLAUDECODE;

type McpServer = ReturnType<typeof import("@anthropic-ai/claude-agent-sdk").createSdkMcpServer>;

/** Options for running an agent. */
export interface AgentRunOptions {
  /** The agent type for model selection and observability. */
  agentType: AgentType | string;
  /** The workspace owning the data. */
  workspaceId: string;
  /** System prompt for the agent. */
  systemPrompt: string;
  /** User message to send to the agent. */
  userMessage: string;
  /** Pre-configured MCP server with tools. */
  mcpServer: McpServer;
  /** Model override (defaults to model-selector lookup for AgentType). */
  model?: string;
  /** Max turns for the agent loop. */
  maxTurns?: number;
  /** Whether to track the agent run in the DB. */
  trackRun?: boolean;
  /** Tool names to pre-approve (glob patterns supported). */
  allowedTools?: string[];
}

/** Result from a non-streaming agent run. */
export interface AgentRunResult {
  /** The final text output from the agent. */
  text: string | null;
  /** Tool results captured during the run (name → result pairs). */
  toolResults: Array<{ tool: string; result: unknown }>;
}

// ── Helpers ──

async function createAgentRunRecord(
  workspaceId: string,
  agentType: string,
  inputMetadata: Record<string, unknown>,
): Promise<string | undefined> {
  try {
    const [run] = await db
      .insert(agentRuns)
      .values({
        workspaceId,
        agentType: agentType as typeof agentRuns.$inferInsert.agentType,
        status: "running",
        inputMetadata,
      })
      .returning();
    return run.id;
  } catch {
    return undefined;
  }
}

async function updateAgentRun(
  agentRunId: string,
  status: "completed" | "failed",
  extra: Record<string, unknown> = {},
): Promise<void> {
  try {
    await db
      .update(agentRuns)
      .set({ status, completedAt: new Date(), ...extra })
      .where(eq(agentRuns.id, agentRunId));
  } catch {
    // DB update failure should not block agent execution
  }
}

function resolveModel(opts: AgentRunOptions): string {
  if (opts.model) return opts.model;
  // Only use getModelForAgent for known AgentType values
  try {
    return getModelForAgent(opts.agentType as AgentType);
  } catch {
    return "claude-sonnet-4-6";
  }
}

// ── Streaming runner (returns SSE Response) ──

/**
 * Runs an agent with SSE streaming, returning a Response suitable for
 * Next.js API route handlers.
 *
 * Emits events: status, tool_use, tool_result, text, complete, error, done
 */
export function runAgentStreaming(
  opts: AgentRunOptions,
  inputMetadata: Record<string, unknown> = {},
): Response {
  if (process.env.DISABLE_AI_AGENTS === "true") {
    const { stream, send, close } = createSSEStream();
    send("error", { message: "AI features are disabled in this environment. Set DISABLE_AI_AGENTS=false or remove the variable to enable them." });
    close();
    return sseResponse(stream);
  }

  const { stream, send, close } = createSSEStream();

  const run = async () => {
    let agentRunId: string | undefined;
    if (opts.trackRun !== false) {
      agentRunId = await createAgentRunRecord(
        opts.workspaceId,
        opts.agentType,
        inputMetadata,
      );
    }

    try {
      send("status", { phase: "starting", message: "Initializing agent..." });

      let finalText = "";

      for await (const message of query({
        prompt: opts.userMessage,
        options: {
          systemPrompt: opts.systemPrompt,
          model: resolveModel(opts),
          maxTurns: opts.maxTurns ?? 15,
          mcpServers: { tools: opts.mcpServer },
          allowedTools: opts.allowedTools ?? ["mcp__tools__*"],
        },
      })) {
        const msg = message as Record<string, unknown>;

        switch (msg.type) {
          case "assistant": {
            // BetaMessage content blocks: text and tool_use
            const betaMsg = msg.message as { content?: Array<{ type: string; text?: string; name?: string; input?: unknown }> } | undefined;
            if (betaMsg?.content) {
              for (const block of betaMsg.content) {
                if (block.type === "text" && block.text) {
                  send("text", { content: block.text });
                  finalText += block.text;
                } else if (block.type === "tool_use") {
                  send("tool_use", { tool: block.name, input: block.input });
                }
              }
            }
            break;
          }

          case "tool_progress": {
            send("status", {
              phase: "tool_progress",
              message: `Running ${msg.tool_name as string}...`,
            });
            break;
          }

          case "tool_use_summary": {
            send("tool_result", {
              tool: "summary",
              summary: msg.summary as string,
            });
            break;
          }

          case "result": {
            if ("result" in msg && typeof msg.result === "string") {
              finalText = msg.result;
            }
            break;
          }
          // system, rate_limit_event, etc. — skip silently
        }
      }

      if (agentRunId) {
        await updateAgentRun(agentRunId, "completed");
      }

      send("complete", { message: "Agent completed successfully" });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (agentRunId) {
        await updateAgentRun(agentRunId, "failed", { errorMessage });
      }

      send("error", { message: errorMessage });
    } finally {
      close();
    }
  };

  run();
  return sseResponse(stream);
}

// ── Non-streaming runner (returns result) ──

/**
 * Runs an agent to completion and returns the final text result.
 * Used for background/non-streaming agents like insight-extractor
 * and content-generator.
 */
export async function runAgent(
  opts: AgentRunOptions,
  inputMetadata: Record<string, unknown> = {},
): Promise<AgentRunResult> {
  if (process.env.DISABLE_AI_AGENTS === "true") {
    throw new Error("AI features are disabled in this environment. Set DISABLE_AI_AGENTS=false or remove the variable to enable them.");
  }

  let agentRunId: string | undefined;
  if (opts.trackRun !== false) {
    agentRunId = await createAgentRunRecord(
      opts.workspaceId,
      opts.agentType,
      inputMetadata,
    );
  }

  const toolResults: Array<{ tool: string; result: unknown }> = [];

  try {
    let finalText: string | null = null;

    for await (const message of query({
      prompt: opts.userMessage,
      options: {
        systemPrompt: opts.systemPrompt,
        model: resolveModel(opts),
        maxTurns: opts.maxTurns ?? 15,
        mcpServers: { tools: opts.mcpServer },
        allowedTools: opts.allowedTools ?? ["mcp__tools__*"],
      },
    })) {
      const msg = message as Record<string, unknown>;

      if (msg.type === "assistant") {
        const betaMsg = msg.message as { content?: Array<{ type: string; text?: string; name?: string; input?: unknown }> } | undefined;
        if (betaMsg?.content) {
          for (const block of betaMsg.content) {
            if (block.type === "text" && block.text) {
              finalText = (finalText ?? "") + block.text;
            } else if (block.type === "tool_use" && block.name) {
              toolResults.push({ tool: block.name, result: block.input });
            }
          }
        }
      } else if (msg.type === "result" && typeof msg.result === "string") {
        finalText = msg.result;
      }
    }

    if (agentRunId) {
      await updateAgentRun(agentRunId, "completed");
    }

    return { text: finalText, toolResults };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (agentRunId) {
      await updateAgentRun(agentRunId, "failed", { errorMessage });
    }

    throw error;
  }
}
