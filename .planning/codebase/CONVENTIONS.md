# Coding Conventions

**Analysis Date:** 2026-03-22

## Naming Patterns

**Files:**
- kebab-case for all TypeScript/TSX files: `api-handler.ts`, `content-list-view.tsx`, `blog-writer.ts`
- Route files always named `route.ts` (Next.js App Router convention)
- Hook files prefixed with `use-`: `use-agent-run.ts`, `use-generate.ts`, `use-workspace.ts`
- Test files use `.test.ts` suffix and live in `__tests__/` subdirectories co-located with source
- Type definition files use `.d.ts` or `types.ts`: `next-augment.d.ts`, `types/templates.ts`

**Functions:**
- camelCase for all functions: `withApiHandler`, `formatErrorResponse`, `buildTemplateInstructions`
- React components: PascalCase: `ContentListView`, `SeoScoreBadge`, `AgentStatus`
- React hooks: camelCase prefixed with `use`: `useAgentRun`, `useGenerateFormats`
- Server-side helpers: camelCase verbs: `authenticateApiKey`, `getAuthorizedWorkspace`, `parseBody`
- Pure utility functions: descriptive camelCase verbs: `formatDuration`, `timeAgo`, `formatMs`

**Variables:**
- camelCase throughout: `workspaceSlug`, `sortCol`, `lastPayloadRef`
- Constants: SCREAMING_SNAKE_CASE for module-level constants: `ERROR_CODES`, `ACTIVE_STATUSES`, `INITIAL_STATUSES`, `PERMISSIONS`, `ROLES`, `STATUS_COLORS`
- Boolean variables: `is`/`has`/`can` prefix: `isLoading`, `hasActivity`, `canRetry`, `isPending`

**Types and Interfaces:**
- PascalCase: `AppError`, `ErrorCode`, `AgentRunState`, `PipelineRun`, `BlogWriterInput`
- Union string types preferred for status/state: `"idle" | "running" | "retrying" | "completed" | "failed"`
- `type` for unions and aliases; `interface` for object shapes with multiple properties
- Type-only imports use `import type {}`: `import type { ContentTemplate, BuiltInTemplate } from "@/types/templates"`

**Enums:**
- Prefer `as const` objects over TypeScript enums:
  ```ts
  export const ERROR_CODES = {
    UNAUTHORIZED: "UNAUTHORIZED",
    NOT_FOUND: "NOT_FOUND",
  } as const;
  export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
  ```

## Code Style

**Formatting:**
- No `.prettierrc` found at project root — formatting enforced via ESLint (`next/core-web-vitals`)
- Consistent 2-space indentation throughout
- Double quotes for strings in TypeScript/TSX
- Trailing commas in multi-line object/array literals
- Arrow functions for callbacks; named `function` declarations for exports

**Linting:**
- Config: `apps/dashboard/.eslintrc.json` — extends `next/core-web-vitals`
- `@typescript-eslint/no-throw-literal` disabled inside `__tests__/` directories
- `// eslint-disable-next-line react-hooks/exhaustive-deps` used when intentionally omitting stable deps

## Import Organization

**Order (observed pattern):**
1. `"use client"` directive (if needed) — must be first line
2. Framework imports: `next/server`, `next/navigation`, `react`
3. Internal path-aliased imports from `@/lib/`, `@/hooks/`, `@/components/`
4. Workspace package imports: `@sessionforge/db`
5. Type-only imports last: `import type { ... }`

**Example:**
```ts
"use client";

import { useState, useCallback } from "react";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { ContentTemplate } from "@/types/templates";
```

**Path Aliases:**
- `@/*` → `apps/dashboard/src/*` (all internal source imports)
- `@sessionforge/db` → `packages/db/src/index` (shared database schema/types)
- Never use relative paths for `src/` imports — always use `@/`

## Error Handling

**Pattern: Custom `AppError` class with typed error codes**

All API routes throw `AppError` — never generic `Error` — for known error conditions:
```ts
// src/lib/errors.ts
throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);
throw new AppError("workspace query param required", ERROR_CODES.VALIDATION_ERROR);
```

**Route wrapper pattern:** Every internal API route uses `withApiHandler()` from `src/lib/api-handler.ts`:
```ts
export async function GET(request: Request) {
  return withApiHandler(async () => {
    // handler body — throw AppError for known errors
  })(request);
}
```
The wrapper catches `AppError` → structured JSON response with `{ error, code }`. Unknown errors → `500 Internal Server Error` (internal details never exposed to client).

**Public v1 API routes** use `apiResponse()` / `apiError()` helpers from `src/lib/api-auth.ts`:
```ts
return apiResponse(rows, { total, limit, offset });  // { data, meta, error: null }
return apiError("Unauthorized", 401);                // { data: null, meta: {}, error }
```

**Client-side error handling:**
- `try/catch` on fetch calls; errors surfaced as state strings, not thrown
- `err instanceof Error ? err.message : String(err)` pattern for safe message extraction
- SSE stream errors: set state to `{ status: "failed", error: message, canRetry: true }`

**Validation:** Zod schemas in `src/lib/validation.ts` — `parseBody(schema, body)` throws `AppError` on failure:
```ts
import { parseBody, contentCreateSchema } from "@/lib/validation";
const body = await parseBody(contentCreateSchema, await req.json());
```

## Logging

**Framework:** `console.error` with structured JSON — no external logging library

**Pattern:** All server-side errors are logged as JSON with fixed shape before responding:
```ts
console.error(JSON.stringify({
  level: "error",
  timestamp: new Date().toISOString(),
  method,
  url,
  error: error.message,
  code: error.code,
}));
```

**Client-side:** No structured logging; errors surfaced through state only

## Comments

**File-level JSDoc blocks** on lib modules describe purpose and architectural role:
```ts
/**
 * SSE streaming helpers for agent responses.
 * Wraps Anthropic SDK streaming into Server-Sent Events format.
 */
```

**Interface/type JSDoc:** Properties documented with `/** ... */` on complex types (especially agent inputs):
```ts
/** ID of the workspace owning the insight and target post. */
workspaceId: string;
```

**Inline comments:** Used to explain non-obvious logic:
```ts
// Fire-and-forget usage tracking
void incrementTemplateUsage(dbTemplate.id);

// Process complete SSE messages (separated by double newline)
const messages = buffer.split("\n\n");
```

**Section dividers** in large files use dashed comment lines:
```ts
// ---------------------------------------------------------------------------
// Sitemap generator unit tests
// ---------------------------------------------------------------------------
```

## Function Design

**Size:** Functions kept small and single-purpose; complex operations decomposed into named helpers
- `buildTemplateInstructions()`, `buildRequest()`, `consumeSSEStream()` — private helpers extracted from large functions

**Parameters:** Options objects preferred over positional args for 3+ params:
```ts
interface BlogWriterInput {
  workspaceId: string;
  insightId: string;
  tone?: BlogTone;
  customInstructions?: string;
  templateId?: string;
}
```

**Return Values:**
- Async functions return typed Promises or `Response` (for streaming routes)
- Never return `undefined` where `null` is intended — use explicit `null`
- Early returns preferred over nested if-else

**Fire-and-forget:** `void` keyword used explicitly for intentional floating promises:
```ts
void incrementTemplateUsage(dbTemplate.id);
```

## React Component Design

**Server vs Client components:**
- `"use client"` directive on components using hooks, browser APIs, or event handlers
- Server components are the default (no directive) — fetch data directly
- Pages in `app/(dashboard)/` are server components unless they require interactivity

**Props interfaces:**
- Always typed with a `Props` or descriptive `...Props` interface defined above the component
- `any[]` used pragmatically in list components when full DB type is verbose (known shortcut)

**Tailwind CSS patterns:**
- Custom design tokens via `sf-` prefixed classes: `text-sf-text-primary`, `bg-sf-bg-tertiary`, `text-sf-accent`
- `cn()` utility (clsx + tailwind-merge) for conditional class merging:
  ```tsx
  className={cn("px-3 py-1.5 text-sm rounded-sf", condition ? "bg-sf-accent-bg" : "hover:bg-sf-bg-hover")}
  ```
- Minimum touch target sizes enforced: `min-h-[44px] min-w-[44px]` on interactive elements

## Module Design

**Exports:**
- Named exports throughout — no default exports except Next.js page/layout components
- Barrel files (`index.ts`) used only in `packages/db` — not in app source

**Shared modules:**
- `src/lib/utils.ts` — `cn()`, `timeAgo()`, `formatMs()`, `formatDuration()`, `formatDate()`
- `src/lib/errors.ts` — `AppError`, `ERROR_CODES`, `formatErrorResponse()`
- `src/lib/content-constants.tsx` — `STATUS_COLORS`, `TYPE_LABELS`, `STATUS_TABS`, `SeoScoreBadge`
- `src/lib/pipeline-status.ts` — `PipelineRun`, `RunStatus`, `ACTIVE_STATUSES`, `statusBadgeClass()`, `statusLabel()`
- `src/lib/validation.ts` — Zod schemas + `parseBody()` helper
- `src/lib/api-auth.ts` — `authenticateApiKey()`, `apiResponse()`, `apiError()` for v1 public API
- `src/lib/api-handler.ts` — `withApiHandler()` for internal API routes

---

*Convention analysis: 2026-03-22*
