/**
 * Structured event types for the observability system.
 * Every agent, pipeline, and AI call emits events through these types.
 */

export type AgentEventType =
  // Lifecycle
  | "agent:start"
  | "agent:complete"
  | "agent:error"
  // Tool use
  | "tool:call"
  | "tool:result"
  | "tool:error"
  // Content
  | "text:chunk"
  | "text:complete"
  // Pipeline
  | "pipeline:stage"
  | "pipeline:progress"
  // System
  | "system:rate_limit"
  | "system:retry";

export type EventLevel = "debug" | "info" | "warn" | "error";

export interface AgentEvent {
  id: string;
  traceId: string;
  parentEventId?: string;
  workspaceId: string;
  agentType: string;
  agentRunId?: string;
  eventType: AgentEventType;
  level: EventLevel;
  payload: Record<string, unknown>;
  timestamp: Date;
}

/** Create an agent lifecycle event. */
export function createAgentEvent(
  traceId: string,
  workspaceId: string,
  agentType: string,
  eventType: AgentEventType,
  payload: Record<string, unknown> = {},
  options: {
    level?: EventLevel;
    parentEventId?: string;
    agentRunId?: string;
  } = {}
): AgentEvent {
  return {
    id: crypto.randomUUID(),
    traceId,
    parentEventId: options.parentEventId,
    workspaceId,
    agentType,
    agentRunId: options.agentRunId,
    eventType,
    level: options.level ?? inferLevel(eventType),
    payload,
    timestamp: new Date(),
  };
}

function inferLevel(eventType: AgentEventType): EventLevel {
  switch (eventType) {
    case "agent:error":
    case "tool:error":
      return "error";
    case "system:rate_limit":
    case "system:retry":
      return "warn";
    case "text:chunk":
      return "debug";
    default:
      return "info";
  }
}
