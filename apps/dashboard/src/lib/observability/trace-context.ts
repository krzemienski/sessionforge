/**
 * Trace context for correlating events across agents and pipelines.
 * A traceId links all events in a single operation chain.
 */

export function generateTraceId(): string {
  return `trace_${crypto.randomUUID()}`;
}

/**
 * Holds trace context that propagates through agent and pipeline calls.
 * Create one at the start of a user-initiated operation, pass it through.
 */
export class TraceContext {
  readonly traceId: string;
  readonly workspaceId: string;
  private parentEventId?: string;

  constructor(workspaceId: string, traceId?: string) {
    this.traceId = traceId ?? generateTraceId();
    this.workspaceId = workspaceId;
  }

  /** Create a child context that links back to a parent event. */
  child(parentEventId: string): TraceContext {
    const ctx = new TraceContext(this.workspaceId, this.traceId);
    ctx.parentEventId = parentEventId;
    return ctx;
  }

  getParentEventId(): string | undefined {
    return this.parentEventId;
  }
}
