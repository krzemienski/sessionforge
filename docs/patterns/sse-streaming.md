# SSE Streaming Pattern

> **Category:** Technical Pattern
> **Last Updated:** 2026-04-18
> **Status:** Active

## Purpose

Provides a standardized approach for streaming agent responses to clients via Server-Sent Events (SSE), enabling real-time UI updates during long-running operations.

## Context

**When to use this pattern:**
- Long-running agent operations (blog writing, content generation)
- Real-time progress updates needed in UI
- Tool invocation tracing during agentic loops

**When NOT to use this pattern:**
- Simple request/response operations (use standard fetch)
- Batch operations with no progress feedback

## Implementation

### Overview

Routes that use SSE streaming delegate to `runAgentStreaming()` which:
1. Executes agent via Agent SDK `query()` function
2. Emits SSE events for each state change (running, tool_use, complete, error)
3. Client-side `useAgentRun()` hook parses events and updates UI state

### Key Components

**runAgentStreaming Function**
- Purpose: Execute agent with streaming response
- Location: `apps/dashboard/src/lib/ai/agent-runner.ts:1-100`
- Returns: SSE `Response` with event stream

**useAgentRun Hook**
- Purpose: Client-side SSE consumer with retry state
- Location: `apps/dashboard/src/hooks/use-agent-run.ts:36-175`
- Parses SSE, handles retry logic, exposes typed state

**SSE Event Types**
- `status` — agent status change
- `tool_use` — tool invocation
- `tool_result` — tool result received
- `retry_status` — retry attempt info
- `complete` — stream finished successfully
- `error` — operation failed
- `done` — marker for stream end

## Usage Examples

### Example 1: Streaming Blog Generation

**Situation:** User clicks "Generate Blog Post" button

**Implementation:**

Frontend component:
```typescript
"use client";
const { run, status, error, retry } = useAgentRun("/api/content/generate-blog");

const handleGenerate = async () => {
  await run({ contentId, templateId });
};

return (
  <div>
    {status === "running" && <Spinner />}
    {status === "completed" && <Success />}
    {status === "failed" && (
      <Error message={error} onRetry={retry} />
    )}
  </div>
);
```

Backend route:
```typescript
export const POST = withApiHandler(async (req) => {
  const { contentId } = await parseBody(req, schema);
  const mcpServer = createMcpServer("blog-writer", workspaceId);
  
  return await runAgentStreaming({
    agentType: "blog-writer",
    workspaceId,
    systemPrompt: BLOG_WRITER_PROMPT,
    userMessage: `Generate blog for content ${contentId}`,
    mcpServer,
  });
});
```

**Result:** Client receives streaming events, UI updates in real-time

### Example 2: Handling Stream Abort on Client Disconnect

**Situation:** User closes browser mid-generation

**Implementation:**
```typescript
const controller = new AbortController();
return await runAgentStreaming({
  agentType: "editor-chat",
  workspaceId,
  systemPrompt: EDITOR_PROMPT,
  userMessage: userMessage,
  mcpServer,
  abortSignal: controller.signal, // from request
});
```

**Result:** When client disconnects, `abortSignal` fires, agent loop exits, run marked as failed

## Edge Cases and Gotchas

### Edge Case 1: SSE Message Framing

**Problem:** Incomplete SSE messages if chunks split mid-JSON

**Solution:** `useAgentRun` buffers incomplete lines, processes only complete `\n\n`-delimited messages

### Edge Case 2: Retry State Transitions

**Problem:** "retrying" status could be overwritten by incoming status events

**Solution:** Event handler only updates status if state is currently "running" (not "retrying")

### Edge Case 3: Tool Error Mid-Stream

**Problem:** Tool execution error should not crash agent loop

**Solution:** Agent SDK handles tool failures internally, emits `error` event to client

## Best Practices

1. **Always include AbortSignal** — allows cleanup on client disconnect
2. **Emit progress events frequently** — improves perceived responsiveness
3. **Track run ID in DB** — enables resumption and observability
4. **Validate agent type before MCP setup** — prevents tool misconfiguration
5. **Use retry state on client** — don't retry same payload without user interaction

## Anti-Patterns

❌ **Don't:** Ignore AbortSignal — wastes resources on disconnected clients
**Why:** Agent continues running even after user closed tab
**Instead:** Pass AbortSignal from request, check it in loop

❌ **Don't:** Emit too many events — floods event stream
**Why:** Parser gets overwhelmed, browser performance degrades
**Instead:** Batch updates, emit every 100ms minimum

## Testing Strategy

- Mock agent responses with controlled SSE events
- Verify client state transitions: idle → running → completed
- Test stream abort: send AbortSignal, verify cleanup
- Test retry: fail once, succeed on retry

## Performance Considerations

- SSE connection stays open for duration of agent run (seconds to minutes)
- Each event is small JSON (<1KB typically)
- Parser is non-blocking (runs in event loop)
- Agent SDK subprocess spawning is one-time cost per request

## Related Patterns

- [api-route-wrapper](./api-route-wrapper.md) — error handling in SSE routes
- [claudecode-env-fix](./claudecode-env-fix.md) — ensures CLI auth before query()
- [mcp-tool-factory](./mcp-tool-factory.md) — creates tools for agent

## Code References

- `apps/dashboard/src/lib/ai/agent-runner.ts:1-100` — runAgentStreaming
- `apps/dashboard/src/hooks/use-agent-run.ts:36-175` — useAgentRun hook
- `apps/dashboard/src/lib/ai/orchestration/streaming.ts` — SSE framing

## Version History

| Date | Change | Author |
|------|--------|--------|
| 2026-04-18 | Initial documentation | capture-docs |
