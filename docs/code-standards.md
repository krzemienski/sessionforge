# SessionForge Code Standards

Conventions and patterns for the SessionForge codebase. All new code should follow these standards.

---

## File Naming

**All files use kebab-case.** No exceptions.

```
# Components
export-panel.tsx
ai-chat-sidebar.tsx
content-list-view.tsx
mobile-bottom-nav.tsx

# Hooks
use-content.ts
use-integrations.ts
use-editor-chat.ts

# Library modules
api-handler.ts
content-constants.tsx
pipeline-status.ts

# API routes
app/api/content/[id]/seo/route.ts
app/api/automation/triggers/route.ts
```

**Folders** also use kebab-case: `lib/ai/prompts/`, `components/content/`, `hooks/`.

---

## File Size

- **Target:** 200-400 lines
- **Maximum:** 800 lines
- Extract components, utilities, and constants into separate files when a file grows beyond 400 lines
- Example: Content page was decomposed from 471 lines into `ExportPanel`, `ContentListView`, `CalendarView`, and `content-constants.tsx`

---

## Components

### Exports

**Named exports only.** No default exports.

```tsx
// CORRECT
export function ExportPanel({ showExport, onClose }: ExportPanelProps) {
  // ...
}

// WRONG
export default function ExportPanel() { ... }
```

### Props

**Use `interface` for component props.** Name as `<ComponentName>Props`.

```tsx
interface ExportPanelProps {
  showExport: boolean;
  onClose: () => void;
  exportType: string;
  setExportType: (v: string) => void;
}

export function ExportPanel({ showExport, onClose, exportType, setExportType }: ExportPanelProps) {
  // ...
}
```

### Client Directive

Add `"use client"` at the top of every client component (components using hooks, event handlers, or browser APIs).

```tsx
"use client";

import { useState } from "react";
// ...
```

---

## API Routes

### Handler Signature

```typescript
export async function GET(request: Request) { ... }
export async function POST(request: Request, ctx?: RouteContext) { ... }
```

### Authentication

Check auth at the top of every handler. Return early on failure.

```typescript
const session = await auth.api.getSession({ headers: await headers() });
if (!session) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

### Error Handling

Two patterns depending on complexity:

**Simple routes — direct error responses:**

```typescript
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspace = searchParams.get("workspace");
  if (!workspace) return NextResponse.json({ error: "workspace required" }, { status: 400 });

  // ... logic
  return NextResponse.json({ data });
}
```

**Complex routes — `withApiHandler` wrapper:**

```typescript
import { withApiHandler, AppError, ERROR_CODES } from "@/lib/errors";

export const POST = withApiHandler(async (req: Request) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

  const body = await req.json();
  const input = parseBody(mySchema, body);

  // ... logic
  return NextResponse.json({ data });
});
```

### Validation

Use Zod schemas for request body validation. Define schemas in `lib/validation.ts` or inline for route-specific schemas.

```typescript
// In lib/validation.ts (shared schemas)
export const contentCreateSchema = z.object({
  workspaceSlug: z.string().min(1, "workspaceSlug is required"),
  title: z.string().min(1, "title is required"),
  markdown: z.string().min(1, "markdown is required"),
  contentType: z.enum(["blog_post", "twitter_thread", "linkedin_post", "devto_post", "changelog", "newsletter", "custom"]),
});

// In route handler
const input = parseBody(contentCreateSchema, body);
// OR for inline validation:
const parsed = schema.safeParse(body);
if (!parsed.success) {
  return Response.json({
    error: "Validation failed",
    code: ERROR_CODES.VALIDATION_ERROR,
    details: { fields: parsed.error.issues.map(i => ({ path: i.path.join("."), message: i.message })) }
  }, { status: 400 });
}
```

### Response Format

**Success:** `NextResponse.json({ data })` or `NextResponse.json({ items, total, limit, offset })` for paginated responses.

**Error:** Always include `error` message and `code`:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE_CONSTANT"
}
```

**Error codes:** `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `BAD_REQUEST`, `INTERNAL_ERROR`

---

## Hooks

### Naming

`use<Feature>` — always prefix with `use`.

```typescript
export function useContent(workspace: string, params?: ContentParams) { ... }
export function useUpdatePost() { ... }
export function useIntegrations(workspace: string) { ... }
```

### TanStack Query

Use `useQuery` for reads, `useMutation` for writes. Invalidate related queries on mutation success.

```typescript
// Query
export function useContent(workspace: string) {
  return useQuery({
    queryKey: ["content", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/content?workspace=${workspace}`);
      if (!res.ok) throw new Error("Failed to fetch content");
      return res.json();
    },
    enabled: !!workspace,
  });
}

// Mutation with cache invalidation
export function useUpdatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdatePostInput) => {
      const res = await fetch(`/api/content/${id}`, { method: "PUT", body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["post", vars.id] });
      qc.invalidateQueries({ queryKey: ["content"] });
    },
  });
}
```

### Query Key Convention

Array with feature name first, then identifiers and params:

```typescript
["content", workspace]
["content", workspace, { status, type, limit }]
["post", postId]
["integrations", workspace]
["seo", postId]
```

---

## Imports

### Path Aliases

Use `@/` for all local imports. Use `@sessionforge/db` for the shared database package.

```typescript
// Local imports
import { cn } from "@/lib/utils";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { parseBody, contentCreateSchema } from "@/lib/validation";
import { ExportPanel } from "@/components/content/export-panel";

// Monorepo package
import { posts, workspaces, insights } from "@sessionforge/db";

// Next.js
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Link from "next/link";

// Icons (lucide-react)
import { Bot, User, Loader2, Send, ChevronDown } from "lucide-react";
```

### Import Order

1. React / Next.js
2. External packages (lucide-react, zod, drizzle-orm)
3. Monorepo packages (`@sessionforge/db`)
4. Local lib (`@/lib/*`)
5. Local components (`@/components/*`)
6. Local hooks (`@/hooks/*`)

---

## Error Handling

### AppError

Use `AppError` for all application-level errors in API routes. Never expose internal error details to clients.

```typescript
import { AppError, ERROR_CODES } from "@/lib/errors";

// Throw with standard code
throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);
throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);
throw new AppError("Invalid input", ERROR_CODES.VALIDATION_ERROR, 400, { fields });

// withApiHandler catches AppError and formats response
// Non-AppError exceptions return generic 500 with no detail leak
```

### Client-Side Errors

In hooks and components, throw `Error` for fetch failures. Handle in UI with error boundaries or conditional rendering.

```typescript
const res = await fetch(`/api/content/${id}`);
if (!res.ok) throw new Error("Failed to fetch post");
```

---

## State Management

### Server State

**TanStack Query** for all server data. No manual fetch + setState.

### Client State

**React Context** for cross-cutting concerns (theme, workspace). **useState** for local UI state (modals, form inputs, dropdowns).

```typescript
// Theme context (lib-level)
export const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  resolvedTheme: "dark",
  setTheme: () => {},
});

// Local UI state (component-level)
const [isExporting, setIsExporting] = useState(false);
const [selectedTab, setSelectedTab] = useState("all");
```

### No Zustand Stores

The codebase does not use Zustand. Use TanStack Query for server state and Context/useState for client state.

---

## Database

### Client

Singleton Drizzle client at `lib/db.ts`. Import as `import { db } from "@/lib/db"`.

### Schema

All tables defined in `packages/db/src/schema.ts`. Import table references from `@sessionforge/db`.

```typescript
import { posts, workspaces, insights } from "@sessionforge/db";
import { eq, and, desc } from "drizzle-orm";
```

### Query Patterns

```typescript
// Find one with relations
const post = await db.query.posts.findFirst({
  where: eq(posts.id, id),
  with: { workspace: true, insight: true },
});

// Find many with ordering and limits
const runs = await db.query.automationRuns.findMany({
  where: eq(automationRuns.workspaceId, wsId),
  orderBy: [desc(automationRuns.startedAt)],
  limit: 50,
});

// Upsert (idempotent operations)
await db.insert(claudeSessions)
  .values(record)
  .onConflictDoUpdate({
    target: [claudeSessions.workspaceId, claudeSessions.sessionId],
    set: { ...updates },
  });

// Update
await db.update(posts)
  .set({ status: "published", publishedAt: new Date() })
  .where(eq(posts.id, id));
```

---

## AI / Agent SDK

### SDK Usage

All AI features use `@anthropic-ai/claude-agent-sdk`. The SDK inherits authentication from the Claude CLI — **no API keys**.

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

// REQUIRED in dev: prevent nested session rejection
delete process.env.CLAUDECODE;

const result = await query({
  model: "claude-sonnet-4-20250514",
  messages: [{ role: "user", content: prompt }],
  tools: mcpTools,
  system: systemPrompt,
});
```

### Never

- Import from `@anthropic-ai/sdk` (the direct SDK)
- Set `ANTHROPIC_API_KEY` environment variable
- Use `new Anthropic()` constructor

### Agent Streaming

Agent routes return SSE streams with typed events:

```
event: status       { phase, message }
event: tool_use     { tool, input }
event: tool_result  { tool, success, error? }
event: text         { content }
event: complete     { usage }
event: error        { message }
```

---

## Shared Modules

Reusable utilities extracted to prevent duplication:

| Module | Exports | Purpose |
|--------|---------|---------|
| `lib/utils.ts` | `cn()`, `timeAgo()`, `formatMs()`, `formatDuration()`, `formatDate()` | Common utilities |
| `lib/content-constants.tsx` | `STATUS_COLORS`, `TYPE_LABELS`, `STATUS_TABS`, `SeoScoreBadge` | Content UI constants |
| `lib/pipeline-status.ts` | `RunStatus`, `PipelineRun`, `statusBadgeClass()`, `statusLabel()` | Pipeline status helpers |
| `lib/errors.ts` | `AppError`, `ERROR_CODES`, `formatErrorResponse()` | Error handling |
| `lib/validation.ts` | Zod schemas, `parseBody()`, inferred types | Input validation |

When adding new shared utilities, place them in the appropriate existing module or create a new kebab-case file in `lib/`.

---

## Design Patterns

### SSE Streaming Pattern

Server-sent events for real-time progress updates in long-running operations. Used for pipeline analysis, agent execution, and content generation.

**Server side** (`api/pipeline/analyze/route.ts`):
```typescript
// Create ReadableStream with TextEncoder
const encoder = new TextEncoder();
const stream = new ReadableStream({
  start(controller) {
    const send = (event: PipelineEvent) => {
      const data = JSON.stringify({ ...event, runId: newRun.id });
      controller.enqueue(encoder.encode(`data: ${data}\n\n`));
    };

    // Start async work, emit progress via send()
    executePipeline({ runId, workspace, onProgress: send })
      .then(() => controller.close())
      .catch((err) => {
        send({ stage: "failed", message: err.message });
        controller.close();
      });
  },
});

return new Response(stream, {
  headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  },
});
```

**Client side** (`hooks/use-analysis-pipeline.ts`):
- Use `fetch()` with AbortController for stream management
- TextDecoder to parse incoming chunks
- Split on `\n\n` boundaries and parse `data: ` prefix
- Update React state with each event (immutable state updates)
- Call `reader.read()` in loop until `done` flag

**When to use:** Long operations (30s+) where users need live feedback. Not suitable for quick operations or batch processing.

### Pipeline Orchestration with onProgress Callback

Decouple progress emission from execution. Pass `onProgress` callback to executors.

**Pattern** (`lib/automation/pipeline.ts`):
```typescript
export interface PipelineEvent {
  stage: "scanning" | "extracting" | "generating" | "complete" | "failed";
  message: string;
  data?: Record<string, unknown>;
}

export interface ExecutePipelineOptions {
  runId: string;
  workspace: Workspace;
  lookbackDays?: number;
  onProgress?: (event: PipelineEvent) => void;
}

export async function executePipeline(opts: ExecutePipelineOptions) {
  const emit = (event: PipelineEvent) => opts.onProgress?.(event);

  // At each stage transition
  emit({ stage: "scanning", message: "Starting..." });
  // Do work
  emit({ stage: "scanning", message: "Found X sessions", data: { count: X } });
  // Next stage
  emit({ stage: "extracting", message: "..." });
}
```

**Advantages:** Callback is optional, enables both polling and streaming, testable without mocks.

### Quality Gate Scoring Pattern

Composite score across multiple weighted dimensions. Used in insights and content analysis.

**Pattern** (from mcp-server-factory.ts create_insight schema):
```typescript
scores: z.object({
  novelty: z.number(),              // 0-100 domain novelty
  tool_discovery: z.number(),        // 0-100 new tools/patterns
  before_after: z.number(),          // 0-100 transformation clarity
  failure_recovery: z.number(),      // 0-100 learning value
  reproducibility: z.number(),       // 0-100 repeatable steps
  scale: z.number(),                 // 0-100 impact/scope
})
```

Compute composite as weighted average of dimensions. Normalized to 0-100 range. Store individual scores for UI filtering and trending analysis.

### Graceful Database Fallback Pattern

Try database operation, fall back to defaults on failure without blocking user.

**Pattern** (from templates route, seo generator):
```typescript
try {
  const templates = await db.query.templates.findMany({ ... });
  return NextResponse.json({ templates });
} catch (err) {
  console.error("[templates] DB query failed:", err);
  // Return built-in templates as fallback
  return NextResponse.json({
    templates: getBuiltInTemplates(),
    cached: true
  });
}
```

**When to use:** Read operations where failure is non-critical. Cache busts on DB recovery. Never use for writes.

---

## UI Library

- **Component library:** shadcn/ui (Radix primitives + Tailwind)
- **Icons:** lucide-react
- **Editor:** Lexical (rich text with markdown import/export)
- **Styling:** Tailwind CSS 4 with `cn()` utility for conditional classes

```tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

<div className={cn("rounded-lg border p-4", isActive && "border-blue-500")} />
```

---

**Last Updated:** March 2026
