# Codebase Structure

**Analysis Date:** 2026-03-22

## Directory Layout

```
sessionforge/                        # Monorepo root (bun workspaces + Turborepo)
├── apps/
│   └── dashboard/                   # Main Next.js 14 app (App Router)
│       ├── src/
│       │   ├── app/                 # Next.js App Router tree
│       │   │   ├── (auth)/          # Login/signup route group (no sidebar)
│       │   │   ├── (dashboard)/     # Dashboard route group (auth-gated)
│       │   │   │   ├── layout.tsx   # Session check + onboarding guard
│       │   │   │   ├── page.tsx     # Root redirect to first workspace
│       │   │   │   └── [workspace]/ # Workspace-scoped pages
│       │   │   │       ├── layout.tsx
│       │   │   │       ├── page.tsx            # Dashboard home
│       │   │   │       ├── sessions/           # Session list + detail
│       │   │   │       ├── insights/           # Insight list + detail
│       │   │   │       ├── content/            # Content list + editor
│       │   │   │       ├── analytics/          # Analytics + ROI
│       │   │   │       ├── automation/         # Pipeline automation
│       │   │   │       ├── observability/      # Agent run monitoring
│       │   │   │       ├── calendar/           # Publish calendar
│       │   │   │       ├── writing-coach/      # Style coach
│       │   │   │       └── settings/           # Workspace settings
│       │   │   ├── (onboarding)/    # Onboarding wizard route group
│       │   │   └── api/             # API routes
│       │   │       ├── v1/          # Public REST API (Bearer token auth)
│       │   │       ├── agents/      # AI agent SSE endpoints
│       │   │       ├── content/     # Content CRUD
│       │   │       ├── insights/    # Insights CRUD
│       │   │       ├── sessions/    # Session management
│       │   │       ├── automation/  # Automation triggers/runs
│       │   │       ├── integrations/# Third-party integrations
│       │   │       ├── analytics/   # Analytics sync/metrics
│       │   │       ├── billing/     # Stripe billing
│       │   │       ├── cron/        # Vercel cron handlers
│       │   │       ├── webhooks/    # Outgoing webhook delivery
│       │   │       ├── schedule/    # Scheduled publishing
│       │   │       ├── public/      # Unauthenticated public endpoints
│       │   │       └── auth/        # Better Auth handler
│       │   ├── components/          # React components
│       │   │   ├── ui/              # Primitive UI components
│       │   │   ├── editor/          # Lexical rich-text editor panels
│       │   │   ├── transcript/      # Session transcript viewer
│       │   │   ├── content/         # Content list/pipeline/calendar views
│       │   │   ├── publishing/      # Platform publish modals
│       │   │   ├── preview/         # Content preview renderers
│       │   │   ├── seo/             # SEO checklist/meta/readability
│       │   │   ├── analytics/       # Metrics cards, trend charts
│       │   │   ├── settings/        # Settings tab components
│       │   │   ├── layout/          # WorkspaceShell, sidebar, nav
│       │   │   ├── onboarding/      # Welcome/onboarding modals
│       │   │   ├── scheduling/      # Calendar/publish queue
│       │   │   ├── batch/           # Batch job progress UI
│       │   │   ├── agents/          # Agent status display
│       │   │   ├── pipeline/        # Pipeline progress component
│       │   │   ├── series/          # Series management
│       │   │   ├── templates/       # Template selector/creator
│       │   │   ├── export/          # Static site export modal
│       │   │   ├── search/          # Global search modal
│       │   │   └── sessions/        # Session upload zone/progress
│       │   ├── hooks/               # React Query hooks (client)
│       │   ├── lib/                 # Server-side business logic
│       │   │   ├── ai/              # AI agent layer
│       │   │   │   ├── agent-runner.ts         # Core runAgent/runAgentStreaming
│       │   │   │   ├── mcp-server-factory.ts   # MCP tool wiring per agent type
│       │   │   │   ├── agents/                 # Per-type agent functions
│       │   │   │   ├── tools/                  # MCP tool handlers
│       │   │   │   ├── orchestration/          # SSE streaming, retry, model selector
│       │   │   │   ├── prompts/                # System prompt builders
│       │   │   │   └── skills/                 # Built-in skill definitions
│       │   │   ├── observability/   # Event bus, trace context, SSE broadcaster
│       │   │   ├── sessions/        # Session miner, upload processor
│       │   │   ├── ingestion/       # URL extractor, repo analyzer, source assembler
│       │   │   ├── seo/             # Scoring, readability, frontmatter, generator
│       │   │   ├── publishing/      # Hashnode client
│       │   │   ├── integrations/    # Dev.to, Ghost, GitHub clients
│       │   │   ├── wordpress/       # WordPress client + crypto
│       │   │   ├── billing/         # Usage quota, Stripe helpers
│       │   │   ├── automation/      # Cron utils, file watcher
│       │   │   ├── export/          # Markdown export, RSS, static site
│       │   │   ├── templates/       # Built-in templates, DB operations
│       │   │   ├── webhooks/        # Outgoing webhook delivery + events
│       │   │   ├── social/          # Twitter/LinkedIn parsers
│       │   │   ├── style/           # Edit distance for style learning
│       │   │   ├── auth/            # API key helpers
│       │   │   ├── auth.ts          # Better Auth server instance
│       │   │   ├── auth-client.ts   # Better Auth browser client
│       │   │   ├── api-auth.ts      # Public API key auth + response helpers
│       │   │   ├── api-handler.ts   # withApiHandler() error wrapper
│       │   │   ├── db.ts            # Re-exports db from db-adapter
│       │   │   ├── errors.ts        # AppError class + ERROR_CODES
│       │   │   ├── permissions.ts   # RBAC roles + PERMISSIONS constants
│       │   │   ├── workspace-auth.ts# getAuthorizedWorkspace()
│       │   │   ├── pipeline-status.ts # Shared pipeline status utilities
│       │   │   ├── utils.ts         # cn(), timeAgo(), formatMs(), formatDuration()
│       │   │   └── content-constants.tsx # STATUS_COLORS, TYPE_LABELS, SeoScoreBadge
│       │   ├── types/               # TypeScript augmentations
│       │   └── middleware.ts        # Next.js middleware (legacy route redirects)
│       ├── public/                  # Static assets
│       └── next.config.ts
└── packages/
    └── db/                          # Shared Drizzle schema package
        └── src/
            ├── schema.ts            # All 30 tables + enums
            └── index.ts             # Exports schema + db client
```

## Directory Purposes

**`apps/dashboard/src/app/(dashboard)/[workspace]/`:**
- Purpose: All workspace-scoped pages
- Contains: `"use client"` page components that use React Query hooks
- Key files: `layout.tsx` (workspace auth guard + WorkspaceShell), `page.tsx` (dashboard home), `content/[postId]/page.tsx` (editor)

**`apps/dashboard/src/app/api/`:**
- Purpose: All API route handlers
- Internal routes (session-cookie auth): everything except `v1/`
- Public routes (Bearer token): `v1/content`, `v1/sessions`, `v1/insights`, `v1/webhooks`
- Key pattern: every handler wraps with `withApiHandler()` from `src/lib/api-handler.ts`

**`apps/dashboard/src/components/`:**
- Purpose: All React UI components
- `ui/` — primitive components (Button, Toast, etc.)
- Feature subdirectories named after domain (editor, content, seo, publishing, etc.)

**`apps/dashboard/src/hooks/`:**
- Purpose: All client-side data hooks
- Contains: `useQuery`/`useMutation` wrappers; `useAgentRun` for SSE; domain hooks like `useContent`, `useInsights`, `useSessions`
- Naming: `use-<domain>.ts` (kebab-case file, camelCase hook export)

**`apps/dashboard/src/lib/ai/`:**
- Purpose: Entire AI agent layer
- `agent-runner.ts` — the only place `query()` is called from
- `mcp-server-factory.ts` — creates MCP servers with workspace-scoped tools
- `agents/` — one file per agent type: `blog-writer.ts`, `social-writer.ts`, `newsletter-writer.ts`, `changelog-writer.ts`, `evidence-writer.ts`
- `tools/` — one file per tool group: `session-reader.ts`, `insight-tools.ts`, `post-manager.ts`, `markdown-editor.ts`, etc.

**`packages/db/src/`:**
- Purpose: Shared PostgreSQL schema (Drizzle ORM)
- `schema.ts` — defines all 30 tables and ~20 enums
- Imported in app as `import { tableName } from "@sessionforge/db"`

## Key File Locations

**Entry Points:**
- `apps/dashboard/src/app/layout.tsx`: Root HTML shell, `<Providers>` wrapper
- `apps/dashboard/src/app/(dashboard)/layout.tsx`: Auth guard, onboarding redirect
- `apps/dashboard/src/app/(dashboard)/[workspace]/layout.tsx`: Workspace membership check

**Configuration:**
- `apps/dashboard/next.config.ts`: Next.js config
- `apps/dashboard/src/middleware.ts`: Route redirect rules
- `package.json` (root): Bun workspace + Turborepo scripts
- `packages/db/drizzle.config.ts`: Drizzle Kit config

**Core Logic:**
- `apps/dashboard/src/lib/api-handler.ts`: Error wrapper for all API routes
- `apps/dashboard/src/lib/api-auth.ts`: Public API auth + response envelope
- `apps/dashboard/src/lib/errors.ts`: AppError + ERROR_CODES
- `apps/dashboard/src/lib/workspace-auth.ts`: `getAuthorizedWorkspace()`
- `apps/dashboard/src/lib/permissions.ts`: RBAC roles and permission constants
- `apps/dashboard/src/lib/ai/agent-runner.ts`: `runAgentStreaming()`, `runAgent()`
- `apps/dashboard/src/lib/ai/mcp-server-factory.ts`: `createAgentMcpServer()`, `createCustomMcpServer()`

**Shared Utilities:**
- `apps/dashboard/src/lib/utils.ts`: `cn()`, `timeAgo()`, `formatMs()`, `formatDuration()`
- `apps/dashboard/src/lib/pipeline-status.ts`: `PipelineRun` interface, `statusBadgeClass()`, `statusLabel()`
- `apps/dashboard/src/lib/content-constants.tsx`: `STATUS_COLORS`, `TYPE_LABELS`, `SeoScoreBadge`

**Database:**
- `packages/db/src/schema.ts`: All table definitions
- `packages/db/src/index.ts`: Exports (tables, enums, db client)

## Naming Conventions

**Files:**
- `kebab-case.ts` for all TypeScript/TSX files: `api-handler.ts`, `blog-writer.ts`, `use-agent-run.ts`
- Exception: Next.js reserved names use their required names: `page.tsx`, `layout.tsx`, `route.ts`, `error.tsx`, `middleware.ts`

**Directories:**
- `kebab-case` throughout: `ai/`, `mcp-server-factory`, `session-reader`
- Feature directories inside `components/` match domain: `editor/`, `publishing/`, `transcript/`

**Exports:**
- React hooks: `camelCase` starting with `use`: `useAgentRun`, `useContent`
- Functions: `camelCase`: `withApiHandler`, `createAgentMcpServer`, `runAgentStreaming`
- Classes: `PascalCase`: `AppError`
- Constants: `UPPER_SNAKE_CASE`: `ERROR_CODES`, `PERMISSIONS`, `STATUS_COLORS`
- Types/interfaces: `PascalCase`: `AgentRunOptions`, `AgentRunResult`, `MinerDocument`

## Where to Add New Code

**New API route (internal, session auth):**
- Create: `apps/dashboard/src/app/api/<domain>/route.ts`
- Pattern: Wrap handler with `withApiHandler()`, call `auth.api.getSession()`, call `getAuthorizedWorkspace()` if workspace-scoped

**New API route (public v1):**
- Create: `apps/dashboard/src/app/api/v1/<resource>/route.ts`
- Pattern: Call `authenticateApiKey(request)`, use `apiResponse()` / `apiError()` from `apps/dashboard/src/lib/api-auth.ts`

**New dashboard page:**
- Create: `apps/dashboard/src/app/(dashboard)/[workspace]/<name>/page.tsx`
- Mark `"use client"`, use `useParams()` to get `workspace`, use React Query hooks for data

**New React component:**
- Create: `apps/dashboard/src/components/<domain>/<component-name>.tsx`
- Prefer co-locating with the domain it belongs to

**New React Query hook:**
- Create: `apps/dashboard/src/hooks/use-<domain>.ts`
- Wrap `useQuery`/`useMutation` from `@tanstack/react-query`

**New AI agent:**
1. Add agent type to `packages/db/src/schema.ts` `agentTypeEnum`
2. Define tool groups in `AGENT_TOOL_GROUPS` in `apps/dashboard/src/lib/ai/mcp-server-factory.ts`
3. Create `apps/dashboard/src/lib/ai/agents/<name>-writer.ts` calling `runAgentStreaming()` / `runAgent()`
4. Create API route at `apps/dashboard/src/app/api/agents/<name>/route.ts`

**New MCP tool:**
1. Add tool name → group mapping in `TOOL_NAME_TO_GROUP` in `apps/dashboard/src/lib/ai/mcp-server-factory.ts`
2. Add Zod schema in `TOOL_SCHEMAS`
3. Add handler in `apps/dashboard/src/lib/ai/tools/<group>-tools.ts`
4. Register group in `TOOL_GROUP_HANDLERS` if new group

**New database table:**
- Add to `packages/db/src/schema.ts`
- Run `bun run db:push` from monorepo root
- Import table in app as `import { tableName } from "@sessionforge/db"`

**New utility function:**
- General: `apps/dashboard/src/lib/utils.ts`
- Pipeline-related: `apps/dashboard/src/lib/pipeline-status.ts`
- Content display: `apps/dashboard/src/lib/content-constants.tsx`

## Special Directories

**`packages/db/`:**
- Purpose: Shared Drizzle ORM schema and client
- Generated: No (hand-authored schema)
- Committed: Yes
- Note: `drizzle-kit push` may hang on interactive prompts for new enums — use direct `ALTER TABLE` as workaround

**`apps/dashboard/.next/`:**
- Purpose: Next.js build output
- Generated: Yes
- Committed: No

**`apps/dashboard/public/`:**
- Purpose: Static assets served at root
- Generated: No
- Committed: Yes

**`.planning/codebase/`:**
- Purpose: GSD codebase analysis documents consumed by plan/execute commands
- Generated: Yes (by gsd-codebase-mapper)
- Committed: Yes

---

*Structure analysis: 2026-03-22*
