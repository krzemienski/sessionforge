import type { BuiltInTemplate } from "@/types/templates";

/**
 * Architecture Decision Record (ADR) Template
 *
 * A template for documenting significant architectural decisions. Based on the
 * ADR format but adapted for developer audiences. Helps teams understand why
 * systems are built the way they are and the trade-offs involved.
 */
export const architectureDecisionTemplate: BuiltInTemplate = {
  name: "Architecture Decision",
  slug: "architecture-decision",
  contentType: "blog_post",
  description:
    "Document significant architectural decisions and their rationale. Perfect for ADRs, design docs, and sharing the 'why' behind your system's structure with your team or the community.",
  structure: {
    sections: [
      {
        heading: "Context and Problem Statement",
        description:
          "What's the situation? What decision needs to be made? Describe the forces at play - technical constraints, business requirements, team dynamics.",
        required: true,
      },
      {
        heading: "Decision Drivers",
        description:
          "What factors influenced this decision? List the key considerations: scalability needs, team expertise, time constraints, cost, maintainability, etc.",
        required: true,
      },
      {
        heading: "Options Considered",
        description:
          "What alternatives did you evaluate? Briefly describe each option with its core approach. Be comprehensive - show you did your homework.",
        required: true,
      },
      {
        heading: "Decision Outcome",
        description:
          "What did you decide? State the choice clearly and explain the reasoning. Why is this the best option given your constraints?",
        required: true,
      },
      {
        heading: "Consequences",
        description:
          "What are the implications? Cover both positive outcomes and trade-offs. What are you gaining? What are you giving up? Be honest about the downsides.",
        required: true,
      },
      {
        heading: "Implementation Notes",
        description:
          "How are you actually building this? Include architecture diagrams, key code patterns, or infrastructure setup. Make it concrete.",
        required: false,
      },
      {
        heading: "Validation and Monitoring",
        description:
          "How will you know if this decision was right? What metrics are you tracking? What would trigger a reevaluation?",
        required: false,
      },
    ],
  },
  toneGuidance: `Write as a thoughtful technical decision document. Be clear about assumptions and constraints. Don't oversell the chosen approach - acknowledge its limitations.

Style: Structured and analytical. Like a well-reasoned RFC or design doc.
Voice: Confident but humble. Show you've thought it through, but you're not dogmatic.
Length: 1500-2500 words with diagrams, code snippets, or architecture visuals.

Avoid: Justifying decisions you already made without genuine consideration of alternatives. Hand-waving about "industry best practices" without context. Hiding trade-offs or downsides. Being overly academic - ground it in your specific situation.`,
  exampleContent: `# ADR: Adopting Event Sourcing for Order Management

## Context and Problem Statement

Our e-commerce platform processes 50k orders/day. We're struggling with:

1. **Audit requirements**: Finance needs complete order history for compliance
2. **State conflicts**: Concurrent updates cause race conditions
3. **Debug nightmares**: "How did this order end up in this state?" is our most common question
4. **Feature requests**: Business wants order analytics, replays, and time-travel queries

Current approach: CRUD with an audit log table. The audit log is unreliable (we forget to log things), and reconstructing state is brittle.

We need a better way to handle complex order state machines with full history.

## Decision Drivers

- **Auditability**: Must capture complete order history for 7 years
- **Debugging**: Need to understand how any order reached its current state
- **Reliability**: Cannot lose state transitions or create inconsistent states
- **Team familiarity**: Team has strong SQL background, limited event-driven experience
- **Migration path**: Must work alongside existing CRUD code during transition
- **Performance**: Can't add significant latency to order processing
- **Complexity budget**: Limited - we're a small team

## Options Considered

### Option 1: Enhanced Audit Logging

Keep CRUD, make audit logging bulletproof with triggers and event tracking.

**Pros:** Minimal change, team knows this pattern
**Cons:** Audit log separate from source of truth, still have state conflicts

### Option 2: Event Sourcing

Store events as source of truth, rebuild state from event stream.

**Pros:** Perfect audit trail, state is deterministic, enables time-travel
**Cons:** Paradigm shift, schema changes harder, eventual consistency

### Option 3: Hybrid - Event Log + Materialized Views

Event sourcing for orders, but keep read models in traditional tables.

**Pros:** Best of both worlds, easier queries, gradual migration
**Cons:** Complexity of maintaining projections, potential sync issues

## Decision Outcome

**Chosen:** Option 3 - Hybrid Event Sourcing with Materialized Views

We'll event-source the order domain but maintain traditional read tables. Here's why:

1. **Auditability**: Event stream is the source of truth - perfect audit trail
2. **Query performance**: Materialized views keep queries fast and familiar
3. **Migration**: Can migrate one aggregate at a time
4. **Team ramp-up**: Read models use familiar SQL patterns

We're not going full event-sourcing everywhere - just for orders where we need it most.

## Consequences

### Positive

- Complete, immutable audit trail for all order state changes
- Can rebuild order state at any point in time
- Easier debugging - trace exact sequence of events
- Enables new analytics features business has been requesting
- Handles concurrent operations better (optimistic concurrency on event stream)

### Negative

- **Eventual consistency**: Read models lag behind events (mitigated: <100ms)
- **Schema evolution**: Changing event schemas needs careful versioning
- **Team learning curve**: New patterns to learn, especially event handling
- **Infrastructure**: Need event bus (using Postgres for now, may need Kafka later)
- **Complexity**: More moving parts than simple CRUD

### Trade-offs We're Making

We're trading simplicity for auditability and reliability. This makes sense for our order domain where we have compliance requirements and complex state machines. We're NOT doing this everywhere - user profiles, catalog data, etc. stay CRUD.

## Implementation Notes

\`\`\`typescript
// Event-sourced order aggregate
class Order {
  private uncommittedEvents: OrderEvent[] = [];

  static reconstitute(events: OrderEvent[]): Order {
    const order = new Order();
    events.forEach(event => order.apply(event));
    return order;
  }

  place(items: OrderItem[], customer: Customer): void {
    const event = new OrderPlaced({ items, customer, timestamp: Date.now() });
    this.applyAndRecord(event);
  }

  private applyAndRecord(event: OrderEvent): void {
    this.apply(event);
    this.uncommittedEvents.push(event);
  }

  private apply(event: OrderEvent): void {
    // Update internal state based on event type
  }
}
\`\`\`

Materialized view gets updated by event handlers:

\`\`\`sql
-- Read model - traditional table for queries
CREATE TABLE order_read_model (
  id UUID PRIMARY KEY,
  status VARCHAR(50),
  total_amount DECIMAL,
  customer_id UUID,
  -- ... other denormalized fields
  event_version INTEGER -- optimistic locking
);
\`\`\`

## Validation and Monitoring

Success criteria:
- **Zero audit gaps**: Every state change captured in event stream
- **Query performance**: Read model queries <50ms p95
- **Projection lag**: Events to read model <100ms p99
- **Team velocity**: Shipping features at same rate within 2 months

We'll revisit in 6 months if:
- Projection lag consistently exceeds 500ms
- Event schema versioning becomes unmanageable
- Team velocity drops >30% and doesn't recover

Monitoring:
- Event stream lag dashboard
- Projection rebuild time (should be <5 min)
- Event schema version distribution`,
};

export default architectureDecisionTemplate;
