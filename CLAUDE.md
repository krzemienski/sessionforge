# SessionForge Project Instructions

## AI / Agent SDK Architecture (CRITICAL — READ EVERY SESSION)

This project uses `@anthropic-ai/claude-agent-sdk` exclusively for all AI features. The SDK's `query()` function inherits authentication directly from the Claude CLI session — there are NO API keys, NO ANTHROPIC_API_KEY env vars, NO local AI configuration. The SDK spawns the `claude` CLI subprocess which uses the logged-in user's credentials automatically.

**NEVER:**
- Suggest setting up ANTHROPIC_API_KEY or any AI-related env vars
- Assume the AI features need "local environment" API key configuration
- Propose alternative AI SDKs or direct API calls — everything goes through `query()`

**ALWAYS:**
- Remember: `delete process.env.CLAUDECODE` is required before any `query()` call in dev (prevents nested session rejection)
- All 12 SDK files already have this fix applied
- MCP tools provided to agents query the SessionForge database only — no external API keys needed

## Codebase Exploration First

NEVER plan or propose fixes based on prior session context or stale audit data. ALWAYS read the actual current codebase files before producing any plan, remediation, or audit. If you catch yourself writing a plan without having used Read/Grep/Glob first, stop and explore.

## Dev Server Management

After making code changes to routes or schema, always restart the dev server before running smoke tests. Stale Turbopack/Next.js caches cause false 500 errors. Prefer `next dev` over `next dev --turbopack` unless explicitly asked — Turbopack has known issues with drizzle-orm relations resolving to undefined and broken workspace symlinks in bun monorepos.

## Database Migrations

When using drizzle-kit push, it may hang on interactive prompts for new enums or columns. Prefer direct SQL ALTER TABLE statements as a workaround. Always verify the live database schema matches the drizzle schema — tables and columns may be missing from the live DB even if defined in code.

## Git Operations

Always verify CWD before running git commands. In monorepo subdirectories, use paths relative to the current directory, not the monorepo root. Be aware that git hooks may block certain bash commands — if a command is blocked, switch to dedicated tools (Glob, Read, Edit) instead of bash workarounds.

## Observer/Memory Agent Auth

Before spawning observer or memory agents, verify they are authenticated. If an agent reports 'Not logged in', do not continue feeding it events — stop and fix auth first. This is a known recurring blocker.

<!-- GSD:project-start source:PROJECT.md -->
## Project

**SessionForge — v0.1.0-alpha Release**

SessionForge is a content pipeline platform that ingests Claude Code session JSONL files, extracts insights, and generates multi-format content (blog posts, social threads, newsletters, changelogs) using AI agents built on `@anthropic-ai/claude-agent-sdk`. It features a Lexical rich text editor with live AI chat, publishing integrations (Hashnode, WordPress, Dev.to), and a public v1 REST API. This milestone takes the existing brownfield codebase — with 10 active feature worktrees, 30+ tables, 76+ API routes, and 6 AI agents — and converges, containerizes, deploys, documents, and validates it as a production-ready alpha release.

**Core Value:** Every feature branch merged cleanly into main, the full stack running identically in local Docker and Vercel production, and 50+ features proven functional end-to-end — nothing ships unvalidated.

### Constraints

- **No mocks**: NEVER write test files, mocks, or stubs — build and run the real system, validate through actual UI
- **Agent SDK auth**: Claude Agent SDK inherits from CLI session — no ANTHROPIC_API_KEY, no alternative SDKs
- **Dev server**: Use `next dev` (NOT --turbopack) — Turbopack has drizzle-orm relation bugs in bun monorepos
- **Merge safety**: One merge at a time, validate after each, never force-push to main
- **Container portability**: No provider-specific code inside containers — all specifics in env vars
- **Schema parity**: Local Docker Postgres must use identical schema to Neon production
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.7 - All application code across monorepo
- TSX - React component files in `apps/dashboard/src`
- JSON - Configuration files
## Runtime
- Node.js (compatible) — Next.js 15 server runtime
- Bun 1.2.4 — package manager and script runner (NOT used as runtime; Next.js dev/build runs via bun scripts)
- Bun 1.2.4
- Lockfile: `bun.lock` (present at monorepo root)
## Monorepo Structure
- Turbo 2.x — workspace task pipeline, config at `turbo.json`
- Root workspace: `package.json` with `workspaces: ["apps/*", "packages/*"]`
- `apps/dashboard` — Next.js web application (`@sessionforge/dashboard`)
- `packages/db` — Drizzle schema and DB client (`@sessionforge/db`)
- `packages/tsconfig` — Shared TypeScript configs (`@sessionforge/tsconfig`)
## Frameworks
- Next.js 15.1 — App Router, SSR, API routes, standalone output
- React 19 — UI rendering
- React DOM 19 — DOM rendering
- Zustand 5.0 — client-side global state
- TanStack React Query 5.90 — server state / data fetching
- Lexical 0.41 — core editor engine (`apps/dashboard/src`)
- `@lexical/react`, `@lexical/rich-text`, `@lexical/markdown`, `@lexical/list`, `@lexical/link`, `@lexical/code`, `@lexical/utils` — Lexical plugins
- `@lexical/headless` (dev) — server-side Lexical for export
## Database
- Drizzle ORM 0.39 — query builder and schema definition
- Schema: `packages/db/src/schema.ts` (single file, 30+ tables)
- Client: `apps/dashboard/src/lib/db.ts` (not explored directly but imported throughout)
- `@neondatabase/serverless` 0.10 — HTTP-based Postgres driver for serverless/edge
- `postgres` 3.4 — standard Postgres driver (fallback / migrations)
- drizzle-kit 0.31 (dashboard), 0.30 (db package)
- Commands: `bun run db:push`, `bun run db:generate`, `bun run src/migrate.ts`
## Authentication
- better-auth 1.2 — auth server (`apps/dashboard/src/lib/auth.ts`)
- `@better-auth/drizzle-adapter` 1.5 — Drizzle integration
- Strategies: email/password (enabled), GitHub OAuth (conditional on env vars)
- Client: `apps/dashboard/src/lib/auth-client.ts` — `createAuthClient` from `better-auth/react`
## AI
- `@anthropic-ai/claude-agent-sdk` 0.2.63 — primary AI runtime; uses `query()` function
- `@anthropic-ai/sdk` 0.78 — low-level Anthropic SDK (secondary)
- Auth: inherits from Claude CLI session — NO API keys required
- Entry point: `apps/dashboard/src/lib/ai/agent-runner.ts`
- Critical: `delete process.env.CLAUDECODE` required before every `query()` call
## Billing
- Stripe 17 — payments SDK (`apps/dashboard/src/lib/stripe.ts`)
## Queue / Cache
- `@upstash/qstash` 2.7 — message queue for scheduled triggers (`apps/dashboard/src/lib/qstash.ts`)
- `@upstash/redis` 1.34 — HTTP Redis client for serverless
- `ioredis` 5 — TCP Redis client for self-hosted Redis
- Redis wrapper: `apps/dashboard/src/lib/redis.ts` — auto-selects Upstash or ioredis by env vars
## UI / Styling
- Tailwind CSS 4 — utility-first CSS (PostCSS plugin via `@tailwindcss/postcss`)
- `tailwind-merge` 3.5 — conditional class merging
- `clsx` 2.1 — conditional class utility
- `lucide-react` 0.576 — icon library
- Recharts 2.15 — charting/analytics visualizations
- `react-resizable-panels` 4.7 — split-pane layout
- `react-markdown` 9.0, `remark-gfm` 4.0, `rehype-highlight` 7.0 — Markdown rendering
## Content Processing
- `marked` 15.0 — Markdown-to-HTML
- `highlight.js` 11.11, `prismjs` 1.29 — syntax highlighting
- `mermaid` 11.4 — diagram rendering
- `cheerio` 1.2 — HTML parsing / scraping
- `diff` 7.0 — text diffing for revision comparison
- `jszip` 3.10 — ZIP export
- `minisearch` 7.2 — full-text search (client-side)
- `simple-git` 3.32 — Git operations for repo ingestion
- `ssh2` 1.17 — SSH connections (server external package)
- `sharp` 0.34 — image processing
## Validation
- Zod 3.24 — runtime schema validation throughout API routes
## Scheduling
- `cron-parser` 5.5 — cron expression parsing for automation triggers
## Testing
- Vitest 4.0 — unit/integration test runner
- Playwright 1.58 — E2E tests
- `@testing-library/react` 16.0, `@testing-library/user-event` 14.5 — React component testing
- `happy-dom` 15.0 — DOM environment for Vitest
- `msw` 2.7 — mock service worker (dev dependency; user mandate prohibits writing test files)
## Build / Dev Tools
- ESLint 8 + `eslint-config-next` 15 — linting
- TypeScript 5.7 — type checking
- PostCSS 8 — CSS processing
- drizzle-kit — schema migrations
## Path Aliases (tsconfig)
- `@/*` → `apps/dashboard/src/*`
- `@sessionforge/db` → `packages/db/src/index`
## Configuration
- App URL: `NEXT_PUBLIC_APP_URL` (client) / `BETTER_AUTH_URL` (server)
- Database: connection string env var (consumed via `@neondatabase/serverless`)
- Redis: `UPSTASH_REDIS_URL` + `UPSTASH_REDIS_TOKEN` (Upstash) OR `REDIS_URL` (ioredis)
- QStash: `UPSTASH_QSTASH_TOKEN`, `UPSTASH_QSTASH_CURRENT_SIGNING_KEY`, `UPSTASH_QSTASH_NEXT_SIGNING_KEY`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_SOLO_MONTHLY/ANNUAL`, `STRIPE_PRICE_PRO_MONTHLY/ANNUAL`, `STRIPE_PRICE_TEAM_MONTHLY/ANNUAL`
- GitHub OAuth: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- Cron: `CRON_SECRET`
- AI disable flag: `DISABLE_AI_AGENTS=true` disables all AI routes gracefully
- `turbo.json` — pipeline config at monorepo root
- `apps/dashboard/next.config.ts` — Next.js config
## Platform Requirements
- Bun 1.2.4+
- PostgreSQL (Neon recommended; any Postgres compatible)
- `next dev` (NOT `--turbopack` — known drizzle-orm relation bugs with Turbopack)
- Dev server: port 3000
- Next.js standalone output — Docker/container deployment
- Neon Postgres (serverless Postgres, `@neondatabase/serverless`)
- Vercel Cron: `GET /api/cron/automation` — runs every 5 minutes, protected by `CRON_SECRET`
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- kebab-case for all TypeScript/TSX files: `api-handler.ts`, `content-list-view.tsx`, `blog-writer.ts`
- Route files always named `route.ts` (Next.js App Router convention)
- Hook files prefixed with `use-`: `use-agent-run.ts`, `use-generate.ts`, `use-workspace.ts`
- Test files use `.test.ts` suffix and live in `__tests__/` subdirectories co-located with source
- Type definition files use `.d.ts` or `types.ts`: `next-augment.d.ts`, `types/templates.ts`
- camelCase for all functions: `withApiHandler`, `formatErrorResponse`, `buildTemplateInstructions`
- React components: PascalCase: `ContentListView`, `SeoScoreBadge`, `AgentStatus`
- React hooks: camelCase prefixed with `use`: `useAgentRun`, `useGenerateFormats`
- Server-side helpers: camelCase verbs: `authenticateApiKey`, `getAuthorizedWorkspace`, `parseBody`
- Pure utility functions: descriptive camelCase verbs: `formatDuration`, `timeAgo`, `formatMs`
- camelCase throughout: `workspaceSlug`, `sortCol`, `lastPayloadRef`
- Constants: SCREAMING_SNAKE_CASE for module-level constants: `ERROR_CODES`, `ACTIVE_STATUSES`, `INITIAL_STATUSES`, `PERMISSIONS`, `ROLES`, `STATUS_COLORS`
- Boolean variables: `is`/`has`/`can` prefix: `isLoading`, `hasActivity`, `canRetry`, `isPending`
- PascalCase: `AppError`, `ErrorCode`, `AgentRunState`, `PipelineRun`, `BlogWriterInput`
- Union string types preferred for status/state: `"idle" | "running" | "retrying" | "completed" | "failed"`
- `type` for unions and aliases; `interface` for object shapes with multiple properties
- Type-only imports use `import type {}`: `import type { ContentTemplate, BuiltInTemplate } from "@/types/templates"`
- Prefer `as const` objects over TypeScript enums:
## Code Style
- No `.prettierrc` found at project root — formatting enforced via ESLint (`next/core-web-vitals`)
- Consistent 2-space indentation throughout
- Double quotes for strings in TypeScript/TSX
- Trailing commas in multi-line object/array literals
- Arrow functions for callbacks; named `function` declarations for exports
- Config: `apps/dashboard/.eslintrc.json` — extends `next/core-web-vitals`
- `@typescript-eslint/no-throw-literal` disabled inside `__tests__/` directories
- `// eslint-disable-next-line react-hooks/exhaustive-deps` used when intentionally omitting stable deps
## Import Organization
- `@/*` → `apps/dashboard/src/*` (all internal source imports)
- `@sessionforge/db` → `packages/db/src/index` (shared database schema/types)
- Never use relative paths for `src/` imports — always use `@/`
## Error Handling
- `try/catch` on fetch calls; errors surfaced as state strings, not thrown
- `err instanceof Error ? err.message : String(err)` pattern for safe message extraction
- SSE stream errors: set state to `{ status: "failed", error: message, canRetry: true }`
## Logging
## Comments
## Function Design
- `buildTemplateInstructions()`, `buildRequest()`, `consumeSSEStream()` — private helpers extracted from large functions
- Async functions return typed Promises or `Response` (for streaming routes)
- Never return `undefined` where `null` is intended — use explicit `null`
- Early returns preferred over nested if-else
## React Component Design
- `"use client"` directive on components using hooks, browser APIs, or event handlers
- Server components are the default (no directive) — fetch data directly
- Pages in `app/(dashboard)/` are server components unless they require interactivity
- Always typed with a `Props` or descriptive `...Props` interface defined above the component
- `any[]` used pragmatically in list components when full DB type is verbose (known shortcut)
- Custom design tokens via `sf-` prefixed classes: `text-sf-text-primary`, `bg-sf-bg-tertiary`, `text-sf-accent`
- `cn()` utility (clsx + tailwind-merge) for conditional class merging:
- Minimum touch target sizes enforced: `min-h-[44px] min-w-[44px]` on interactive elements
## Module Design
- Named exports throughout — no default exports except Next.js page/layout components
- Barrel files (`index.ts`) used only in `packages/db` — not in app source
- `src/lib/utils.ts` — `cn()`, `timeAgo()`, `formatMs()`, `formatDuration()`, `formatDate()`
- `src/lib/errors.ts` — `AppError`, `ERROR_CODES`, `formatErrorResponse()`
- `src/lib/content-constants.tsx` — `STATUS_COLORS`, `TYPE_LABELS`, `STATUS_TABS`, `SeoScoreBadge`
- `src/lib/pipeline-status.ts` — `PipelineRun`, `RunStatus`, `ACTIVE_STATUSES`, `statusBadgeClass()`, `statusLabel()`
- `src/lib/validation.ts` — Zod schemas + `parseBody()` helper
- `src/lib/api-auth.ts` — `authenticateApiKey()`, `apiResponse()`, `apiError()` for v1 public API
- `src/lib/api-handler.ts` — `withApiHandler()` for internal API routes
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Server components handle auth-gated data fetching at the layout level; pages are client components using React Query hooks
- All AI work runs through a central `runAgentStreaming()` / `runAgent()` abstraction that wraps `query()` from the Agent SDK
- Agent tools are wired via an MCP server factory — each agent type gets a pre-configured toolset; tools query the Drizzle/Neon database directly
- Two distinct API surfaces: internal session-cookie API (all routes under `/api/` except `/api/v1/`) and a public REST API (`/api/v1/`) authenticated via hashed Bearer tokens
- Database schema lives in a shared `packages/db` workspace package imported as `@sessionforge/db`
## Layers
- Purpose: URL routing, layout nesting, server-side auth guards
- Location: `apps/dashboard/src/app/`
- Contains: Layouts, pages, API route handlers
- Depends on: lib layer
- Used by: Next.js runtime
- `apps/dashboard/src/app/(dashboard)/layout.tsx` — checks session, redirects unauthenticated users to `/login`, auto-creates workspace if missing
- `apps/dashboard/src/app/(dashboard)/[workspace]/layout.tsx` — validates workspace membership via `getAuthorizedWorkspace()`, renders `WorkspaceShell`
- Purpose: Client-side UI rendering and state management
- Location: `apps/dashboard/src/app/(dashboard)/[workspace]/`
- Contains: `"use client"` page components consuming React Query hooks
- Depends on: hooks layer, components layer
- Used by: layouts
- Purpose: Server-side request handling
- Location: `apps/dashboard/src/app/api/`
- Contains: Route handlers wrapped in `withApiHandler()` for error normalization
- Depends on: lib layer, auth, db
- Used by: browser fetch, webhooks, cron
- Purpose: Client-side data fetching and mutation wrappers
- Location: `apps/dashboard/src/hooks/`
- Contains: `useQuery`/`useMutation` wrappers over internal fetch calls; `useAgentRun` for SSE streaming
- Depends on: React Query, fetch
- Used by: page components
- Purpose: Reusable UI
- Location: `apps/dashboard/src/components/`
- Contains: Feature components (editor, transcript, publishing) + `ui/` primitives
- Depends on: hooks layer, lib utilities
- Used by: page components, layouts
- Purpose: All server-side business logic, AI agents, integrations, utilities
- Location: `apps/dashboard/src/lib/`
- Contains: Agent runners, MCP server factory, tool handlers, publishing integrations, SEO, billing, webhooks, observability
- Depends on: `@sessionforge/db`, `@anthropic-ai/claude-agent-sdk`, external SDKs
- Used by: API routes, server components
- Purpose: Shared schema and Drizzle client
- Location: `packages/db/src/`
- Contains: `schema.ts` (30 tables, all enums), `index.ts` (exports)
- Depends on: `drizzle-orm`, `@neondatabase/serverless`
- Used by: `apps/dashboard` via `@sessionforge/db` workspace alias
## Data Flow
- Server state: React Query (`@tanstack/react-query`, 30s stale time, no window-focus refetch)
- Local UI state: `useState` / `useReducer` in components
- No global client store (no Redux/Zustand)
## Key Abstractions
- Purpose: Catches `AppError` and unhandled errors, formats responses consistently
- Location: `apps/dashboard/src/lib/api-handler.ts`
- Pattern: Decorator/wrapper — every internal API route uses this
- Purpose: Typed error with HTTP status and error code
- Location: `apps/dashboard/src/lib/errors.ts`
- Pattern: Custom error class with `ERROR_CODES` enum; `formatErrorResponse()` produces JSON
- Purpose: Single entry point for all AI agent execution; handles DB run tracking, observability events, SSE framing
- Location: `apps/dashboard/src/lib/ai/agent-runner.ts`
- Pattern: Two overloads — streaming (returns SSE `Response`) and batch (returns `AgentRunResult`)
- Purpose: Builds a typed MCP server scoped to a workspace with only the tools the agent needs
- Location: `apps/dashboard/src/lib/ai/mcp-server-factory.ts`
- Pattern: Factory — maps `AgentType` → tool groups → Zod-validated tool instances
- Purpose: React hook for consuming SSE agent endpoints with retry state
- Location: `apps/dashboard/src/hooks/use-agent-run.ts`
- Pattern: Custom hook returning `{ status, run, retry, error, retryInfo }`
- Purpose: Resolves workspace by slug, validates membership and optional permission
- Location: `apps/dashboard/src/lib/workspace-auth.ts`
- Pattern: Used in every workspace-scoped API route and the workspace layout
## Entry Points
- Location: `apps/dashboard/src/app/layout.tsx` (root layout)
- Triggers: Browser navigation
- Responsibilities: `<Providers>` (React Query + ThemeProvider + ToastContainer), HTML shell
- Location: `apps/dashboard/src/app/(dashboard)/layout.tsx`
- Triggers: Any dashboard route
- Responsibilities: Session check, workspace auto-creation, onboarding redirect
- Location: `apps/dashboard/src/app/(dashboard)/[workspace]/layout.tsx`
- Triggers: Any workspace route
- Responsibilities: Membership validation, renders `WorkspaceShell` with sidebar nav
- Location: `apps/dashboard/src/app/api/cron/automation/route.ts`
- Triggers: Vercel cron schedule
- Responsibilities: Fires automation pipeline runs
- Location: `apps/dashboard/src/app/api/stripe/webhook/route.ts`
- Triggers: Stripe events
- Responsibilities: Subscription lifecycle updates
- Location: `apps/dashboard/src/app/api/integrations/github/webhooks/route.ts`
- Triggers: GitHub push/PR events
- Responsibilities: Syncs repository activity
## Error Handling
- All internal API routes use `withApiHandler()` — catches `AppError` (returns structured JSON) and unknown errors (returns 500 with sanitized message)
- `AppError(message, ERROR_CODES.X)` — auto-derives HTTP status from code
- Agent errors emitted as `error` SSE event; `useAgentRun` surfaces `error` string in hook state
- Unhandled agent DB failures swallowed (run tracking is best-effort, not blocking)
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
