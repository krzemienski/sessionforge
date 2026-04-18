# Claude Code Environment Fix Pattern

> **Category:** Technical Pattern
> **Last Updated:** 2026-04-18
> **Status:** Active

## Purpose

Prevents "nested session" errors when Agent SDK spawns Claude CLI subprocess by deleting the `CLAUDECODE` environment variable once per process.

## Context

**When to use this pattern:**
- Before any `query()` call from `@anthropic-ai/claude-agent-sdk`
- Node.js processes that may inherit CLAUDECODE from parent Claude Code session

**When NOT to use this pattern:**
- Non-Agent SDK code
- Environments where CLAUDECODE doesn't exist

## Implementation

### Overview

The `ensureCliAuth()` function clears the `CLAUDECODE` env var exactly once per Node process, allowing the spawned `claude` CLI to authenticate as the logged-in user rather than rejecting as a nested session.

### Key Components

**ensureCliAuth Function**
- Purpose: Delete CLAUDECODE once, early in module load
- Location: `apps/dashboard/src/lib/ai/ensure-cli-auth.ts`
- Logic: Check boolean flag, delete once, set flag to prevent repeats
- Timing: Called before any SDK query() invocation

**CLAUDECODE Env Var**
- Purpose: Set by parent Claude Code session to prevent nested invocation
- Set by: Parent Claude Code CLI when spawning Node.js server
- Value: Random token (not used by child; just presence matters)
- Problem: Agent SDK interprets this as "running in nested session" and rejects

**Module-Level Invocation**
- Purpose: Clear env var early, before any query() call
- Location: Top of files importing @anthropic-ai/claude-agent-sdk
- Pattern: `ensureCliAuth()` called at module load time

## Usage Examples

### Example 1: Agent Runner

**Situation:** /api/content/generate starts agent which spawns Claude CLI

**Implementation:**
```typescript
// apps/dashboard/src/lib/ai/agent-runner.ts (top of file)

import { ensureCliAuth } from "@/lib/ai/ensure-cli-auth";
import { query } from "@anthropic-ai/claude-agent-sdk";

// Call before any SDK usage
ensureCliAuth();

export async function runAgentStreaming(...) {
  const response = await query({
    model: "claude-opus-4-7",
    messages: [...],
    tools: [...],
  });
  // ... handle response
}
```

**Result:** When query() spawns `claude` subprocess, CLAUDECODE is undefined, CLI authenticates normally

### Example 2: Multiple Files with Agent SDK

**Situation:** 12 files import @anthropic-ai/claude-agent-sdk, each calls query()

**Implementation:**
```typescript
// apps/dashboard/src/lib/seo/generator.ts
import { ensureCliAuth } from "@/lib/ai/ensure-cli-auth";
import { query } from "@anthropic-ai/claude-agent-sdk";

ensureCliAuth(); // Called once per module load

export async function generateSeoTitle(...) {
  const response = await query({...});
}
```

**Result:** Despite 12 imports, `delete process.env.CLAUDECODE` executes only once (module load), not per function call

## Edge Cases and Gotchas

### Edge Case 1: Module Load Order

**Problem:** ensureCliAuth() called after query() won't work

**Solution:** Call ensureCliAuth() at module top level, before any exports/functions

### Edge Case 2: Multiple Process Forks

**Problem:** Child process spawned via `child_process.fork()` inherits CLAUDECODE again

**Solution:** Child process must also call ensureCliAuth() independently (each process has own NODE_OPTIONS)

### Edge Case 3: Env Var Already Deleted

**Problem:** What if CLAUDECODE is already undefined?

**Solution:** `delete process.env.CLAUDECODE` is idempotent; safe to call even if undefined

## Best Practices

1. **Call at module top level** — before any SDK usage
2. **No need to check if CLAUDECODE exists** — delete is safe either way
3. **One call per file** — no performance penalty, prevents mistakes
4. **Call before query() only** — other SDK methods don't need this

## Anti-Patterns

❌ **Don't:** Call ensureCliAuth() inside functions
**Why:** Repeats overhead, harder to reason about
**Instead:** Call once at module top level

❌ **Don't:** Guard with `if (process.env.CLAUDECODE)` check
**Why:** Delete is already safe on undefined
**Instead:** Just call ensureCliAuth() unconditionally

## Testing Strategy

- Verify CLAUDECODE is deleted before query() runs
- Verify deletion only happens once per process (check flag)
- Test in actual Claude Code session to reproduce original error
- Verify agent query() succeeds without "nested session" error

## Performance Considerations

- First call: O(1) delete operation
- Subsequent calls: O(1) flag check (no delete, no overhead)
- Memory: Single boolean flag per process

## Related Patterns

- [sse-streaming](./sse-streaming.md) — calls query() via agent-runner
- [mcp-tool-factory](./mcp-tool-factory.md) — creates tools for agents

## Code References

- `apps/dashboard/src/lib/ai/ensure-cli-auth.ts` — ensureCliAuth implementation
- Used in: `agent-runner.ts`, `mcp-server-factory.ts`, and 10+ other files importing @anthropic-ai/claude-agent-sdk

## Version History

| Date | Change | Author |
|------|--------|--------|
| 2026-04-18 | Initial documentation | capture-docs |
