/**
 * SSE broadcaster — manages per-workspace SSE connections and fans out
 * events from the in-process event bus to connected clients.
 */

import { eventBus } from "./event-bus";
import type { AgentEvent } from "./event-types";

interface SSEConnection {
  controller: ReadableStreamDefaultController;
  workspaceId: string;
  filters?: {
    traceId?: string;
    agentType?: string;
  };
}

class SSEBroadcaster {
  private connections = new Map<string, Set<SSEConnection>>();
  constructor() {
    // Subscribe to all events from the bus
    eventBus.subscribe((event) => {
      this.broadcast(event);
    });

    // Heartbeat every 30s to detect dead connections
    setInterval(() => {
      this.sendHeartbeats();
    }, 30_000);
  }

  /** Register a new SSE connection for a workspace. */
  addConnection(
    workspaceId: string,
    controller: ReadableStreamDefaultController,
    filters?: { traceId?: string; agentType?: string },
  ): SSEConnection {
    const conn: SSEConnection = { controller, workspaceId, filters };

    if (!this.connections.has(workspaceId)) {
      this.connections.set(workspaceId, new Set());
    }
    this.connections.get(workspaceId)!.add(conn);

    // Send buffered recent events for catch-up
    const recent = eventBus.getRecentEvents({ workspaceId });
    for (const event of recent) {
      if (this.matchesFilters(event, filters)) {
        this.sendEvent(conn, event);
      }
    }

    return conn;
  }

  /** Remove a connection (on client disconnect). */
  removeConnection(conn: SSEConnection): void {
    const set = this.connections.get(conn.workspaceId);
    if (set) {
      set.delete(conn);
      if (set.size === 0) {
        this.connections.delete(conn.workspaceId);
      }
    }
  }

  /** Get count of active connections. */
  connectionCount(): number {
    let count = 0;
    for (const set of this.connections.values()) {
      count += set.size;
    }
    return count;
  }

  private broadcast(event: AgentEvent): void {
    const set = this.connections.get(event.workspaceId);
    if (!set || set.size === 0) return;

    for (const conn of set) {
      if (this.matchesFilters(event, conn.filters)) {
        this.sendEvent(conn, event);
      }
    }
  }

  private matchesFilters(
    event: AgentEvent,
    filters?: { traceId?: string; agentType?: string },
  ): boolean {
    if (!filters) return true;
    if (filters.traceId && event.traceId !== filters.traceId) return false;
    if (filters.agentType && event.agentType !== filters.agentType) return false;
    return true;
  }

  private sendEvent(conn: SSEConnection, event: AgentEvent): void {
    try {
      const data = `event: agent_event\ndata: ${JSON.stringify(event)}\n\n`;
      conn.controller.enqueue(new TextEncoder().encode(data));
    } catch {
      // Connection likely closed — remove it
      this.removeConnection(conn);
    }
  }

  private sendHeartbeats(): void {
    const encoder = new TextEncoder();
    const heartbeat = encoder.encode(`event: heartbeat\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);

    for (const set of this.connections.values()) {
      for (const conn of set) {
        try {
          conn.controller.enqueue(heartbeat);
        } catch {
          this.removeConnection(conn);
        }
      }
    }
  }
}

// Singleton via globalThis to survive HMR
const globalKey = "__sseBroadcaster" as const;
export const sseBroadcaster: SSEBroadcaster =
  (globalThis as Record<string, unknown>)[globalKey] as SSEBroadcaster ??
  (() => {
    const instance = new SSEBroadcaster();
    (globalThis as Record<string, unknown>)[globalKey] = instance;
    return instance;
  })();
