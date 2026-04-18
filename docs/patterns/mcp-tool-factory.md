# MCP Tool Factory Pattern

> **Category:** Technical Pattern
> **Last Updated:** 2026-04-18
> **Status:** Active

## Purpose

Builds a workspace-scoped MCP server with only the tools needed by a specific agent type, mapping agent types → tool groups → Zod-validated tool instances.

## Context

**When to use this pattern:**
- Agent execution (query() requires MCP server)
- Tool access control by agent type
- Workspace-scoped tool execution

**When NOT to use this pattern:**
- Non-agentic operations
- Routes that don't use Agent SDK

## Implementation

### Overview

`createMcpServer()` wires together:
1. Map of agent type → allowed tool groups (AGENT_TOOL_SETS)
2. Tool group → handler function mapping (TOOL_GROUP_HANDLERS)
3. Tool name → group mapping (TOOL_NAME_TO_GROUP)
4. Zod schema definitions for each tool
5. `tool()` instances passed to createSdkMcpServer()

### Key Components

**createMcpServer Function**
- Purpose: Build MCP server for specific agent type
- Location: `apps/dashboard/src/lib/ai/mcp-server-factory.ts:100+`
- Input: agentType, workspaceId
- Output: Configured MCP server ready for query()

**AGENT_TOOL_SETS**
- Purpose: Map agent type → tool groups it can access
- Example: `"blog-writer" → ["session", "post", "insight", "markdown"]`
- Enforces: Blog writer can't access admin tools

**TOOL_GROUP_HANDLERS**
- Purpose: Route tool execution to handler functions
- Values: Functions like `handleSessionReaderTool()`, `handlePostManagerTool()`
- Called by: MCP server when agent invokes a tool

**TOOL_NAME_TO_GROUP**
- Purpose: Map individual tool names to their group
- Example: `"get_post" → "post"`, `"edit_markdown" → "markdown"`
- Used by: Server to route incoming tool calls

**Tool Definitions**
- Purpose: Zod schemas + descriptions for Agent SDK
- Format: `tool({ name, description, inputSchema: z.object(...), handler })`
- Validation: SDK validates inputs against schema before calling handler

## Usage Examples

### Example 1: Blog Writer Agent with Scoped Tools

**Situation:** Create blog post requires session reading, post management, markdown editing

**Implementation:**
```typescript
// apps/dashboard/src/lib/ai/agent-runner.ts

const mcpServer = createMcpServer("blog-writer", workspaceId);

const response = await runAgentStreaming({
  agentType: "blog-writer",
  workspaceId,
  systemPrompt: BLOG_WRITER_PROMPT,
  userMessage: "Write a blog post about X",
  mcpServer, // tools scoped to blog-writer capabilities
  maxTurns: 10,
});
```

**Result:** Agent can call tools from [session, post, insight, markdown] groups only

### Example 2: Workspace Isolation

**Situation:** Tool handler receives workspace ID, queries only that workspace's data

**Implementation:**
```typescript
// apps/dashboard/src/lib/ai/tools/post-manager.ts

export async function handlePostManagerTool(
  workspaceId: string,
  toolName: string,
  toolInput: Record<string, unknown>
) {
  if (toolName === "get_post") {
    const post = await db.query.posts.findFirst({
      where: and(
        eq(posts.id, toolInput.postId as string),
        eq(posts.workspaceId, workspaceId) // Workspace boundary
      ),
    });
    return post || null;
  }
}
```

**Result:** Agent can only see posts from its workspace

### Example 3: Tool Definition with Schema

**Situation:** Define tool for fetching post with typed inputs

**Implementation:**
```typescript
// In MCP server creation

const getPostTool = tool({
  name: "get_post",
  description: "Retrieve a post by ID",
  inputSchema: z.object({
    postId: z.string().describe("ID of the post"),
  }),
  handler: async (input) => {
    return await handlePostManagerTool(workspaceId, "get_post", input);
  },
});
```

**Result:** Agent can call tool with type-safe input validation

## Edge Cases and Gotchas

### Edge Case 1: Tool Group Not Defined for Agent Type

**Problem:** Agent type references tool group that doesn't exist in AGENT_TOOL_SETS

**Solution:** Verify AGENT_TOOL_SETS maps all agent types to valid groups before deployment

### Edge Case 2: Handler Function Error

**Problem:** Tool handler throws, should not crash agent loop

**Solution:** Agent SDK catches handler errors, emits as tool result (agent can retry or recover)

### Edge Case 3: Workspace Not Found in Handler

**Problem:** Tool handler queries workspace that was deleted

**Solution:** Handler returns null/error result; agent SDK surfaces to agent for recovery

## Best Practices

1. **Define AGENT_TOOL_SETS for each agent type** — enforce least privilege
2. **Validate workspace boundary in every handler** — prevent cross-tenant access
3. **Use Zod for tool input schemas** — SDK validates before calling handler
4. **Document tool descriptions** — helps agent understand when to use
5. **Test tool execution with workspace isolation** — verify no data leaks

## Anti-Patterns

❌ **Don't:** Create tool for every function
**Why:** Too many tools confuse agent, slow down execution
**Instead:** Group related operations (post creation + editing = "post" group)

❌ **Don't:** Skip workspace validation in handlers
**Why:** Agent could access other workspaces' data
**Instead:** Always filter by workspaceId in handler queries

## Testing Strategy

- Verify agent type is mapped to correct tool groups
- Test tool execution with valid workspace ID
- Test tool rejection with invalid workspace ID
- Test schema validation (invalid input rejected)
- Test error handling (handler error doesn't crash agent)

## Performance Considerations

- MCP server creation: O(n) where n = tools assigned to agent (typically 10-20)
- Tool invocation: Single handler call, ~5-20ms depending on DB query
- Tool routing: O(1) lookup via TOOL_NAME_TO_GROUP map

## Related Patterns

- [sse-streaming](./sse-streaming.md) — passes MCP server to runAgentStreaming
- [claudecode-env-fix](./claudecode-env-fix.md) — ensures CLI auth before query()

## Code References

- `apps/dashboard/src/lib/ai/mcp-server-factory.ts` — createMcpServer, tool routing
- `apps/dashboard/src/lib/ai/tools/` — individual tool groups (session-reader, post-manager, etc.)
- `apps/dashboard/src/lib/ai/orchestration/tool-registry.ts` — AGENT_TOOL_SETS mapping

## Version History

| Date | Change | Author |
|------|--------|--------|
| 2026-04-18 | Initial documentation | capture-docs |
