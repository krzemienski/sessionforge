# Anthropic Agent SDK Integration

> **Category:** External Interface
> **Service:** Anthropic Claude Agent SDK
> **Last Updated:** 2026-04-18
> **Status:** Active

## Overview

**Service:** Anthropic Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)
**Provider:** Anthropic
**Purpose:** Autonomous agent execution with tool use and agentic loops
**Documentation:** https://github.com/anthropics/anthropic-sdk-python (see agent-sdk-js branch)

## Authentication

### Method

The Agent SDK authenticates via the Claude CLI session. It does NOT use ANTHROPIC_API_KEY.

When `query()` is called, the SDK spawns the `claude` CLI subprocess which uses the logged-in user's credentials (from `~/.config/anthropic.yml` or session env).

### Setup

**Requirement:** User must be logged into Claude CLI:
```bash
claude login
```

**No API Key Configuration Required:** The SDK inherits authentication from the CLI session automatically.

**Environment Variables:**
```bash
# DELETE this to allow spawned subprocess to authenticate:
delete process.env.CLAUDECODE  # Only set by parent Claude Code session
```

### Authentication Example

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import { ensureCliAuth } from "@/lib/ai/ensure-cli-auth";

// Ensure CLAUDECODE is deleted (prevents nested session error)
ensureCliAuth();

const response = await query({
  model: "claude-opus-4-7",
  messages: [{ role: "user", content: "Hello" }],
});
```

## API Endpoints Used

### query() — Agent Loop Execution

**URL:** Invokes `claude` CLI subprocess (not HTTP)
**Purpose:** Execute agent with tool use, iterate until done

**Request:**
```typescript
{
  model: "claude-opus-4-7" | "claude-sonnet-4-6",
  messages: [{ role: "user", content: string }],
  tools?: Tool[],
  system?: string,
  maxTokens?: number,
  temperature?: number,
}
```

**Response:**
```typescript
AsyncIterable<ContentBlock> // text, tool_use blocks
```

**Tool Use Flow:**
1. Agent returns tool_use block with tool name + input
2. Caller executes tool via MCP server
3. Send tool result back via messages
4. Agent continues loop

**Error Handling:**
- Spawned CLI not found → Error("claude CLI not available")
- Nested session (CLAUDECODE set) → Error("Nested session rejected")
- API rate limit → Retry via error event + exponential backoff

### createSdkMcpServer() — Tool Registration

**URL:** N/A (creates in-process MCP server)
**Purpose:** Register tools for agent to call

**Request:**
```typescript
{
  name: string,
  description: string,
  inputSchema: ZodSchema,
  handler: (input) => Promise<unknown>,
}[]
```

**Response:**
Returns MCP server object passed to `query()`

## Tool Use Integration

### Tool Definition Pattern

```typescript
import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const tools = [
  tool({
    name: "get_post",
    description: "Retrieve a post by ID",
    inputSchema: z.object({
      id: z.string(),
    }),
    handler: async ({ id }) => {
      return await db.query.posts.findFirst({
        where: eq(posts.id, id),
      });
    },
  }),
];

const mcpServer = createSdkMcpServer("tool-server", tools);
```

## Rate Limits

- **Requests per minute:** Depends on Claude model (Opus more generous than Sonnet)
- **Token limits:** 200k context window for Opus 4.7, 200k for Sonnet 4.6
- **Burst limit:** Single request can use full context window

**Handling Strategy:** Agent SDK respects model token limits automatically. Long-running agents may hit rate limits; implement exponential backoff in retry logic.

## Data Mapping

### Agent Message Format → API

| Agent Property | API Field | Transformation |
|---|---|---|
| `role: "user"` | `role: "user"` | Direct |
| `content: string` | `content: string` | Direct |
| `role: "assistant"` | `role: "assistant"` | Auto-filled by SDK |
| Tool use | `content.tool_use` | SDK wraps blocks |

### API Response → Agent State

| API Block | Agent State | Handling |
|---|---|---|
| `TextBlock` | Assistant text | Display to user |
| `ToolUseBlock` | Tool invocation request | Execute tool, return result |
| `ToolResultBlock` | Tool output | Pass to agent for next turn |

## Error Handling

### Common Errors

**Error 1: "claude CLI not found"**
- **Cause:** `claude` binary not in PATH
- **Recovery:** Install Claude CLI: `npm install -g @anthropic-ai/claude`
- **Retry:** Yes, with exponential backoff

**Error 2: "Nested session rejected"**
- **Cause:** CLAUDECODE env var set (running inside Claude Code session)
- **Recovery:** Call `ensureCliAuth()` to delete CLAUDECODE
- **Retry:** Yes, immediate

**Error 3: Rate limit exceeded**
- **Cause:** Too many requests to Claude API in short time
- **Recovery:** Implement exponential backoff (wait 1s, 2s, 4s, etc.)
- **Retry:** Yes, with backoff

### Retry Strategy

```typescript
async function queryWithRetry(options: QueryOptions, maxRetries = 3) {
  let delay = 1000; // 1 second
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await query(options);
    } catch (err) {
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, delay));
        delay *= 2; // exponential backoff
      } else {
        throw err;
      }
    }
  }
}
```

## Testing

### Mock Server

No official mock available. For testing, use stub agents that return canned responses instead of calling real API.

```typescript
const stubQuery = async (options) => {
  return {
    text: "Stubbed response for testing",
  };
};
```

### Integration Tests

Use real agent in test environment (cheaper models), verify:
- Agent calls expected tools
- Tool responses update agent state correctly
- Agent loop exits on completion

```typescript
test("agent generates post title", async () => {
  const response = await runAgentStreaming({
    agentType: "blog-writer",
    workspaceId: "test",
    systemPrompt: "Generate a blog title",
    userMessage: "Title about AI",
    mcpServer,
  });
  
  expect(response).toContain("title");
});
```

## Monitoring

### Health Checks

**Endpoint:** No explicit health check. Test with simple query:
```typescript
const health = await query({
  model: "claude-opus-4-7",
  messages: [{ role: "user", content: "ping" }],
});
```

**Frequency:** Optional; SDK handles CLI availability automatically

### Metrics to Track

- Query success rate (% of queries that complete)
- Tool invocation count (tools called per agent run)
- Error rate by type (nested session, rate limit, CLI not found)
- Agent loop iterations (turns to completion)

### Alerts

- **Critical:** CLI not found in PATH (agent can't run at all)
- **Warning:** Rate limit errors (approaching quota)
- **Warning:** High iteration count (agent looping excessively)

## Security Considerations

- Agent SDK spawns `claude` CLI subprocess — inherit parent env vars
- All model inputs are sent to Anthropic API (no on-prem processing)
- Tool handlers run in your process (can access your database, filesystems)
- MCP server is local-only (doesn't expose to internet)

## Compliance

**Data Handling:**
- PII fields: Agent can access any data passed in messages/tool results
- Retention policy: Anthropic retains conversations per API terms
- Geographic restrictions: API available globally

**Regulations:**
- GDPR: Ensure GDPR compliance when sending user data to Anthropic
- CCPA: Anthropic does not store personal data for deletion
- SOC2: Anthropic is SOC2 Type II compliant

## Cost Considerations

**Pricing Model:** Per-token (input + output)

**Cost per request:** Opus ~$0.015 per 1K input tokens, ~$0.075 per 1K output tokens

**Monthly estimate:** High variance. Blog writer agent with 10 tool invocations costs ~$0.50-$1.50 per run depending on model and context size.

## Migration/Upgrade Path

**Current Version:** 0.2.63 (Node.js SDK)

**Next Versions:** Monitor GitHub releases for breaking changes

**Breaking Changes:** None documented yet; SDK is in active development

## Related Documentation

- [Patterns: SSE Streaming](../patterns/sse-streaming.md) — how agent-runner uses SDK
- [Patterns: MCP Tool Factory](../patterns/mcp-tool-factory.md) — tool registration
- [Patterns: Workspace Auth](../patterns/workspace-auth.md) — access control for agent data

## External Resources

- [Agent SDK GitHub](https://github.com/anthropics/anthropic-sdk-python) (see agent-sdk-js)
- [Claude API Docs](https://docs.anthropic.com)
- [SDK Status Page](https://status.anthropic.com)

## Support

**Support:** Anthropic Discord / GitHub Issues
**Account Manager:** N/A (community/self-serve)
**Escalation:** File GitHub issue for blocking bugs

## Version History

| Date | Change | Author |
|------|--------|--------|
| 2026-04-18 | Initial integration | capture-docs |
