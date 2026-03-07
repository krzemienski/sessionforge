/**
 * Helper to instrument pipeline stages with observability events.
 * Used for scan, automation, and ingestion pipelines.
 */

import { eventBus } from "./event-bus";
import { createAgentEvent } from "./event-types";
import { generateTraceId } from "./trace-context";

/** Create a pipeline instrumentation context. */
export function createPipelineInstrumentation(
  pipelineName: string,
  workspaceId: string,
  traceId?: string,
) {
  const tid = traceId ?? generateTraceId();

  return {
    traceId: tid,

    /** Emit a pipeline stage transition event. */
    stage(stageName: string, metadata: Record<string, unknown> = {}) {
      if (eventBus.isDisabled()) return;
      eventBus.emit(
        createAgentEvent(tid, workspaceId, pipelineName, "pipeline:stage", {
          stage: stageName,
          ...metadata,
        })
      );
    },

    /** Emit a pipeline progress event (e.g., 3/10 files scanned). */
    progress(current: number, total: number, metadata: Record<string, unknown> = {}) {
      if (eventBus.isDisabled()) return;
      eventBus.emit(
        createAgentEvent(tid, workspaceId, pipelineName, "pipeline:progress", {
          current,
          total,
          percent: total > 0 ? Math.round((current / total) * 100) : 0,
          ...metadata,
        }, { level: "debug" })
      );
    },

    /** Emit pipeline start event. */
    start(metadata: Record<string, unknown> = {}) {
      if (eventBus.isDisabled()) return;
      eventBus.emit(
        createAgentEvent(tid, workspaceId, pipelineName, "agent:start", {
          type: "pipeline",
          ...metadata,
        })
      );
    },

    /** Emit pipeline complete event. */
    complete(metadata: Record<string, unknown> = {}) {
      if (eventBus.isDisabled()) return;
      eventBus.emit(
        createAgentEvent(tid, workspaceId, pipelineName, "agent:complete", {
          type: "pipeline",
          ...metadata,
        })
      );
    },

    /** Emit pipeline error event. */
    error(err: unknown) {
      if (eventBus.isDisabled()) return;
      eventBus.emit(
        createAgentEvent(tid, workspaceId, pipelineName, "agent:error", {
          type: "pipeline",
          error: err instanceof Error ? err.message : String(err),
        })
      );
    },
  };
}
