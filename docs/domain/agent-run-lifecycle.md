# Agent Run Lifecycle Domain

> **Category:** Domain Model
> **Last Updated:** 2026-04-18
> **Status:** Active

## Overview

An agent run represents a single execution of an AI agent (blog writer, social writer, etc.). Each run progresses through discrete states from initiation to completion or failure, with full observability and auditability.

## States

Each agent run has one of three terminal states:

### 1. running

**Meaning:** Agent is actively executing

**Characteristics:**
- Agent spawned and processing
- Tool calls may be in progress
- User sees streaming updates (SSE)
- Can be cancelled (becomes failed)

**Transitions:**
- `running` → `completed` (success)
- `running` → `failed` (error or cancellation)

**Duration:** Typically 10 seconds to 2 minutes depending on content length and number of tool invocations

### 2. completed

**Meaning:** Agent finished successfully and produced output

**Characteristics:**
- Content generated and stored
- All tool calls succeeded
- Result accessible for publishing or further editing
- Cannot be re-run (new run must be created)

**Data Available:**
- Generated content (markdown/text)
- Metadata (tokens used, duration, tool count)
- Input parameters and prompt used
- Timestamp of completion

**Transitions:** Terminal state (no further state changes)

### 3. failed

**Meaning:** Agent encountered an error and could not complete

**Characteristics:**
- Error message logged
- Partial output may exist (not saved)
- User can retry or try different parameters
- Failure reason tracked for debugging

**Failure Reasons:**
- API rate limit exceeded
- Invalid input (e.g., empty session)
- Tool invocation error (database unreachable)
- Network timeout
- Agent timeout (>5 minutes)
- User cancellation

**Transitions:** Terminal state; user must create new run to retry

## Database Model

```typescript
export const agentRunStatusEnum = pgEnum("agent_run_status", [
  "running",
  "completed",
  "failed",
]);

// Used in agentRuns table:
{
  id: string;
  workspaceId: string;
  agentType: string;
  status: typeof agentRunStatusEnum.enumValues[number];
  input: JSON;           // Input parameters
  output: string | null; // Generated content
  error: string | null;  // Error message if failed
  startedAt: Date;
  completedAt: Date | null;
  tokensUsed: number;    // Estimated or actual tokens
  toolCallCount: number;
}
```

## Run Types by Agent

### Blog Writer Agent

**Input:**
```typescript
{
  sessionIds: string[];
  contentType: "blog_post" | "devto_post" | "doc_page";
  toneProfile: "technical" | "tutorial" | "professional";
  targetLength: "short" | "medium" | "long";
}
```

**Output:** Markdown blog post (500-3000 words)

**Tools Called:** session-reader, post-manager, seo-optimizer

**Typical Duration:** 30-45 seconds

### Social Writer Agent

**Input:**
```typescript
{
  sessionIds: string[];
  contentType: "twitter_thread" | "linkedin_post";
  platform: "twitter" | "linkedin";
  toneProfile: "casual" | "professional" | "conversational";
}
```

**Output:** Platform-specific content (280 chars per tweet, 500 words for LinkedIn)

**Tools Called:** session-reader, social-formatter

**Typical Duration:** 10-20 seconds

### Changelog Writer Agent

**Input:**
```typescript
{
  sessionIds: string[];
  version: string;
  changes: { type: "added" | "fixed" | "improved"; description: string }[];
}
```

**Output:** Markdown changelog entry

**Tools Called:** session-reader, changelog-formatter

**Typical Duration:** 5-10 seconds

## State Transition Diagram

```
[START]
   |
   v
[running] ----error----> [failed]
   |
   +--success---> [completed]
```

## Monitoring and Observability

### Real-Time Updates (SSE)

During `running` state, client receives SSE events:

```json
{"status":"running","progress":{"toolsCalled":2,"tokensUsed":450}}
{"status":"running","progress":{"toolsCalled":3,"tokensUsed":890}}
{"status":"completed","output":"# Blog Post...", "tokensUsed":1245}
```

### Metrics Tracked

| Metric | Purpose | Tracked |
|--------|---------|---------|
| startedAt | Audit trail | Always |
| completedAt | Duration calculation | On completion |
| tokensUsed | Cost estimation | On completion |
| toolCallCount | Agent efficiency | On completion |
| error | Debugging | On failure |

### Audit Trail

Every run logged with:
- User ID who triggered run
- Workspace ID
- Agent type and parameters
- Start time, end time, duration
- Success/failure status
- Generated content checksum

## Error Recovery

### Automatic Retry (Not Implemented)

Currently, users must manually retry failed runs. Future enhancement: automatic retry with exponential backoff for transient failures.

### Manual Retry Workflow

1. User views failed run in UI
2. Clicks "Retry" button
3. Creates new run with same parameters
4. User can adjust parameters if desired

### Failure Analysis

Failed runs provide:
- Error message (user-facing)
- Error code (for support)
- Full stack trace (in logs, not UI)
- Input parameters (for reproduction)

## Constraints

1. **Immutable Input** — Run input cannot be changed after creation
2. **Write-Once Output** — Output written once at completion, not updated
3. **Terminal States** — `completed` and `failed` cannot transition to other states
4. **Single Agent per Run** — Each run executes exactly one agent
5. **Session Scope** — Run bound to specific workspace, inaccessible cross-workspace

## Performance Characteristics

| Operation | Latency | SLA |
|-----------|---------|-----|
| Start run (SSE endpoint) | <100ms | 99.9% |
| Poll run status | <50ms | 99.95% |
| Streaming token updates | <200ms | 99% |
| Completion write (to DB) | <500ms | 99.5% |
| Total run time (start to completion) | 10s-120s | User-facing |

## Related Documentation

- [Domain: Content Types](./content-types.md) — what agents produce
- [Domain: Workspace Membership](./workspace-membership.md) — who can run agents
- [Patterns: SSE Streaming](../patterns/sse-streaming.md) — real-time updates
- [Patterns: MCP Tool Factory](../patterns/mcp-tool-factory.md) — tool execution

## Version History

| Date | Change | Author |
|------|--------|--------|
| 2026-04-18 | Initial domain model | capture-docs |
