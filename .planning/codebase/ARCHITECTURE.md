# Architecture

**Analysis Date:** 2026-03-22

## Pattern Overview

**Overall:** Full-stack Next.js App Router monorepo with server-component-first data fetching, React Query for client state, and a dedicated AI agent layer built on `@anthropic-ai/claude-agent-sdk`.

**Key Characteristics:**
- Server components handle auth-gated data fetching at the layout level; pages are client components using React Query hooks
- All AI work runs through a central `runAgentStreaming()` / `runAgent()` abstraction that wraps `query()` from the Agent SDK
- Agent tools are wired via an MCP server factory — each agent type gets a pre-configured toolset; tools query the Drizzle/Neon database directly
- Two distinct API surfaces: internal session-cookie API (all routes under `/api/` except `/api/v1/`) and a public REST API (`/api/v1/`) authenticated via hashed Bearer tokens
- Database schema lives in a shared `packages/db` workspace package imported as `@sessionforge/db`

## Layers

**Route Layer (App Router):**
- Purpose: URL routing, layout nesting, server-side auth guards
- Location: `apps/dashboard/src/app/`
- Contains: Layouts, pages, API route handlers
- Depends on: lib layer
- Used by: Next.js runtime

**Layout Guards:**
- `apps/dashboard/src/app/(dashboard)/layout.tsx` — checks session, redirects unauthenticated users to `/login`, auto-creates workspace if missing
- `apps/dashboard/src/app/(dashboard)/[workspace]/layout.tsx` — validates workspace membership via `getAuthorizedWorkspace()`, renders `WorkspaceShell`

**Page Layer:**
- Purpose: Client-side UI rendering and state management
- Location: `apps/dashboard/src/app/(dashboard)/[workspace]/`
- Contains: `"use client"` page components consuming React Query hooks
- Depends on: hooks layer, components layer
- Used by: layouts

**API Route Layer:**
- Purpose: Server-side request handling
- Location: `apps/dashboard/src/app/api/`
- Contains: Route handlers wrapped in `withApiHandler()` for error normalization
- Depends on: lib layer, auth, db
- Used by: browser fetch, webhooks, cron

**Hooks Layer:**
- Purpose: Client-side data fetching and mutation wrappers
- Location: `apps/dashboard/src/hooks/`
- Contains: `useQuery`/`useMutation` wrappers over internal fetch calls; `useAgentRun` for SSE streaming
- Depends on: React Query, fetch
- Used by: page components

**Components Layer:**
- Purpose: Reusable UI
- Location: `apps/dashboard/src/components/`
- Contains: Feature components (editor, transcript, publishing) + `ui/` primitives
- Depends on: hooks layer, lib utilities
- Used by: page components, layouts

**Lib Layer:**
- Purpose: All server-side business logic, AI agents, integrations, utilities
- Location: `apps/dashboard/src/lib/`
- Contains: Agent runners, MCP server factory, tool handlers, publishing integrations, SEO, billing, webhooks, observability
- Depends on: `@sessionforge/db`, `@anthropic-ai/claude-agent-sdk`, external SDKs
- Used by: API routes, server components

**Database Package:**
- Purpose: Shared schema and Drizzle client
- Location: `packages/db/src/`
- Contains: `schema.ts` (30 tables, all enums), `index.ts` (exports)
- Depends on: `drizzle-orm`, `@neondatabase/serverless`
- Used by: `apps/dashboard` via `@sessionforge/db` workspace alias

## Data Flow

**Session → Content Pipeline (core user flow):**
1. Claude session JSONL files are uploaded or file-watched (`apps/dashboard/src/lib/sessions/upload-processor.ts`)
2. Session records stored in `claudeSessions` table with `rawMetadata.messages`
3. Insight extractor agent (`apps/dashboard/src/lib/ai/agents/`) runs via `runAgent()`, calls `create_insight` MCP tool
4. Blog/social/newsletter writer agents run via `runAgentStreaming()`, stream SSE back to the browser via `useAgentRun` hook
5. Content saved to `posts` table; revisions tracked in `postRevisions`

**Agent Execution Flow:**
1. API route (e.g., `apps/dashboard/src/app/api/agents/blog/route.ts`) authenticates session, checks quota
2. Calls domain agent function (e.g., `streamBlogWriter()` in `apps/dashboard/src/lib/ai/agents/blog-writer.ts`)
3. Domain agent builds system prompt, calls `createAgentMcpServer(agentType, workspaceId)` from `apps/dashboard/src/lib/ai/mcp-server-factory.ts`
4. `runAgentStreaming()` in `apps/dashboard/src/lib/ai/agent-runner.ts` calls `query()` from Agent SDK
5. SDK iterates `query()` generator; tool calls dispatched to handler functions in `apps/dashboard/src/lib/ai/tools/`
6. Text/tool_use events forwarded as SSE frames to the client
7. `useAgentRun` hook in the browser parses SSE events, updates component state

**Client Data Fetching:**
1. Page mounts, React Query hook fires `fetch()` to internal API route
2. API route authenticates via `auth.api.getSession()` (Better Auth)
3. Route handler queries Drizzle, returns JSON
4. React Query caches result (30s stale time), component renders

**Public API Flow:**
1. External caller sends `Authorization: Bearer <token>` to `/api/v1/` routes
2. `authenticateApiKey()` in `apps/dashboard/src/lib/api-auth.ts` hashes token with SHA-256, looks up in `apiKeys` table
3. Returns workspace context; route proceeds with `apiResponse()` / `apiError()` envelope format

**State Management:**
- Server state: React Query (`@tanstack/react-query`, 30s stale time, no window-focus refetch)
- Local UI state: `useState` / `useReducer` in components
- No global client store (no Redux/Zustand)

## Key Abstractions

**`withApiHandler(handler)`:**
- Purpose: Catches `AppError` and unhandled errors, formats responses consistently
- Location: `apps/dashboard/src/lib/api-handler.ts`
- Pattern: Decorator/wrapper — every internal API route uses this

**`AppError`:**
- Purpose: Typed error with HTTP status and error code
- Location: `apps/dashboard/src/lib/errors.ts`
- Pattern: Custom error class with `ERROR_CODES` enum; `formatErrorResponse()` produces JSON

**`runAgentStreaming()` / `runAgent()`:**
- Purpose: Single entry point for all AI agent execution; handles DB run tracking, observability events, SSE framing
- Location: `apps/dashboard/src/lib/ai/agent-runner.ts`
- Pattern: Two overloads — streaming (returns SSE `Response`) and batch (returns `AgentRunResult`)

**`createAgentMcpServer(agentType, workspaceId)`:**
- Purpose: Builds a typed MCP server scoped to a workspace with only the tools the agent needs
- Location: `apps/dashboard/src/lib/ai/mcp-server-factory.ts`
- Pattern: Factory — maps `AgentType` → tool groups → Zod-validated tool instances

**`useAgentRun<P>(endpoint)`:**
- Purpose: React hook for consuming SSE agent endpoints with retry state
- Location: `apps/dashboard/src/hooks/use-agent-run.ts`
- Pattern: Custom hook returning `{ status, run, retry, error, retryInfo }`

**`getAuthorizedWorkspace(session, slug, permission?)`:**
- Purpose: Resolves workspace by slug, validates membership and optional permission
- Location: `apps/dashboard/src/lib/workspace-auth.ts`
- Pattern: Used in every workspace-scoped API route and the workspace layout

## Entry Points

**Web Application:**
- Location: `apps/dashboard/src/app/layout.tsx` (root layout)
- Triggers: Browser navigation
- Responsibilities: `<Providers>` (React Query + ThemeProvider + ToastContainer), HTML shell

**Dashboard Shell:**
- Location: `apps/dashboard/src/app/(dashboard)/layout.tsx`
- Triggers: Any dashboard route
- Responsibilities: Session check, workspace auto-creation, onboarding redirect

**Workspace Shell:**
- Location: `apps/dashboard/src/app/(dashboard)/[workspace]/layout.tsx`
- Triggers: Any workspace route
- Responsibilities: Membership validation, renders `WorkspaceShell` with sidebar nav

**Cron:**
- Location: `apps/dashboard/src/app/api/cron/automation/route.ts`
- Triggers: Vercel cron schedule
- Responsibilities: Fires automation pipeline runs

**Stripe Webhook:**
- Location: `apps/dashboard/src/app/api/stripe/webhook/route.ts`
- Triggers: Stripe events
- Responsibilities: Subscription lifecycle updates

**GitHub Webhook:**
- Location: `apps/dashboard/src/app/api/integrations/github/webhooks/route.ts`
- Triggers: GitHub push/PR events
- Responsibilities: Syncs repository activity

## Error Handling

**Strategy:** Centralized wrapper with typed error class; internal details never leaked to clients.

**Patterns:**
- All internal API routes use `withApiHandler()` — catches `AppError` (returns structured JSON) and unknown errors (returns 500 with sanitized message)
- `AppError(message, ERROR_CODES.X)` — auto-derives HTTP status from code
- Agent errors emitted as `error` SSE event; `useAgentRun` surfaces `error` string in hook state
- Unhandled agent DB failures swallowed (run tracking is best-effort, not blocking)

## Cross-Cutting Concerns

**Logging:** Structured JSON logs via `console.error()` in `withApiHandler` — `{ level, timestamp, method, url, error, code }`.

**Validation:** Zod schemas in `apps/dashboard/src/lib/validation.ts`; `parseBody(schema, rawBody)` used in API routes. MCP tool inputs validated via Zod schemas in `mcp-server-factory.ts`.

**Authentication:** Better Auth (`apps/dashboard/src/lib/auth.ts`) for session cookies. SHA-256 hashed API keys for `/api/v1/` routes via `apps/dashboard/src/lib/api-auth.ts`.

**Authorization:** RBAC via `apps/dashboard/src/lib/permissions.ts`; workspace roles: owner, editor, viewer, reviewer, publisher, analyst. `getAuthorizedWorkspace()` enforces permission checks.

**Observability:** In-process event bus at `apps/dashboard/src/lib/observability/event-bus.ts`; agents emit structured events via `createAgentEvent()`. SSE broadcaster at `apps/dashboard/src/lib/observability/sse-broadcaster.ts` for the Observability page.

**Billing/Quota:** `checkQuota()` and `recordUsage()` in `apps/dashboard/src/lib/billing/usage.ts`; called before any content generation agent invocation.

**Agent SDK Auth:** `delete process.env.CLAUDECODE` is present at the top of every file that imports `@anthropic-ai/claude-agent-sdk` — prevents nested session rejection when running inside a Claude Code session.

---

*Architecture analysis: 2026-03-22*
