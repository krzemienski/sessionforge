/**
 * Helper to instrument bare query() calls with observability events.
 * Used for direct AI callers that don't go through agent-runner.ts
 * (seo/generator, diagram-generator, suggest-arcs, evidence-classifier, style-learner).
 */

import { eventBus } from "./event-bus";
import { createAgentEvent } from "./event-types";
import { generateTraceId } from "./trace-context";

/**
 * Wraps an async function with agent:start and agent:complete/error events.
 * Returns the function's result unchanged.
 */
export async function instrumentQuery<T>(
  callerName: string,
  workspaceId: string,
  fn: () => Promise<T>,
  options?: { traceId?: string; model?: string },
): Promise<T> {
  if (eventBus.isDisabled()) return fn();

  const traceId = options?.traceId ?? generateTraceId();
  const startTime = Date.now();

  eventBus.emit(
    createAgentEvent(traceId, workspaceId, callerName, "agent:start", {
      model: options?.model ?? "unknown",
      type: "direct-query",
    })
  );

  try {
    const result = await fn();
    eventBus.emit(
      createAgentEvent(traceId, workspaceId, callerName, "agent:complete", {
        durationMs: Date.now() - startTime,
      })
    );
    return result;
  } catch (err) {
    eventBus.emit(
      createAgentEvent(traceId, workspaceId, callerName, "agent:error", {
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startTime,
      })
    );
    throw err;
  }
}
