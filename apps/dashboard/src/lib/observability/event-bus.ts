/**
 * In-process event bus for observability events.
 * Uses Node.js EventEmitter with a bounded ring buffer for late-joining subscribers.
 */

import { EventEmitter } from "events";
import type { AgentEvent } from "./event-types";

const RING_BUFFER_SIZE = 1000;
const EVENT_NAME = "agent_event";

type EventHandler = (event: AgentEvent) => void;

class ObservabilityEventBus {
  private emitter = new EventEmitter();
  private ringBuffer: AgentEvent[] = [];
  private disabled = false;

  constructor() {
    this.emitter.setMaxListeners(100);
    this.disabled = process.env.DISABLE_OBSERVABILITY === "true";
  }

  /** Emit an event to all subscribers. Fire-and-forget — never blocks. */
  emit(event: AgentEvent): void {
    if (this.disabled) return;

    // Add to ring buffer
    this.ringBuffer.push(event);
    if (this.ringBuffer.length > RING_BUFFER_SIZE) {
      this.ringBuffer.shift();
    }

    // Notify subscribers asynchronously
    try {
      this.emitter.emit(EVENT_NAME, event);
    } catch {
      // Never let subscriber errors propagate to the emitter
    }
  }

  /** Subscribe to all events. Returns unsubscribe function. */
  subscribe(handler: EventHandler): () => void {
    this.emitter.on(EVENT_NAME, handler);
    return () => this.emitter.off(EVENT_NAME, handler);
  }

  /** Get recent events from the ring buffer, optionally filtered. */
  getRecentEvents(filter?: {
    traceId?: string;
    workspaceId?: string;
    agentType?: string;
  }): AgentEvent[] {
    if (!filter) return [...this.ringBuffer];

    return this.ringBuffer.filter((e) => {
      if (filter.traceId && e.traceId !== filter.traceId) return false;
      if (filter.workspaceId && e.workspaceId !== filter.workspaceId)
        return false;
      if (filter.agentType && e.agentType !== filter.agentType) return false;
      return true;
    });
  }

  /** Number of subscribers currently attached. */
  subscriberCount(): number {
    return this.emitter.listenerCount(EVENT_NAME);
  }

  /** Check if observability is disabled. */
  isDisabled(): boolean {
    return this.disabled;
  }
}

/** Singleton event bus — shared across the entire Next.js server process. */
const globalForBus = globalThis as unknown as {
  __observabilityEventBus?: ObservabilityEventBus;
};

export const eventBus: ObservabilityEventBus =
  globalForBus.__observabilityEventBus ??
  (globalForBus.__observabilityEventBus = new ObservabilityEventBus());
