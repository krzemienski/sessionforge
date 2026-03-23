# Technology Stack

**Analysis Date:** 2026-03-22

## Languages

**Primary:**
- TypeScript 5.7 - All application code across monorepo
- TSX - React component files in `apps/dashboard/src`

**Secondary:**
- JSON - Configuration files

## Runtime

**Environment:**
- Node.js (compatible) — Next.js 15 server runtime
- Bun 1.2.4 — package manager and script runner (NOT used as runtime; Next.js dev/build runs via bun scripts)

**Package Manager:**
- Bun 1.2.4
- Lockfile: `bun.lock` (present at monorepo root)

## Monorepo Structure

**Build Orchestration:**
- Turbo 2.x — workspace task pipeline, config at `turbo.json`
- Root workspace: `package.json` with `workspaces: ["apps/*", "packages/*"]`

**Packages:**
- `apps/dashboard` — Next.js web application (`@sessionforge/dashboard`)
- `packages/db` — Drizzle schema and DB client (`@sessionforge/db`)
- `packages/tsconfig` — Shared TypeScript configs (`@sessionforge/tsconfig`)

## Frameworks

**Core:**
- Next.js 15.1 — App Router, SSR, API routes, standalone output
  - Config: `apps/dashboard/next.config.ts`
  - Output mode: `standalone` (Docker-friendly)
  - `serverExternalPackages: ["ssh2"]`
- React 19 — UI rendering
- React DOM 19 — DOM rendering

**State Management:**
- Zustand 5.0 — client-side global state
- TanStack React Query 5.90 — server state / data fetching

**Rich Text Editor:**
- Lexical 0.41 — core editor engine (`apps/dashboard/src`)
- `@lexical/react`, `@lexical/rich-text`, `@lexical/markdown`, `@lexical/list`, `@lexical/link`, `@lexical/code`, `@lexical/utils` — Lexical plugins
- `@lexical/headless` (dev) — server-side Lexical for export

## Database

**ORM:**
- Drizzle ORM 0.39 — query builder and schema definition
- Schema: `packages/db/src/schema.ts` (single file, 30+ tables)
- Client: `apps/dashboard/src/lib/db.ts` (not explored directly but imported throughout)

**Driver:**
- `@neondatabase/serverless` 0.10 — HTTP-based Postgres driver for serverless/edge
- `postgres` 3.4 — standard Postgres driver (fallback / migrations)

**Migration Tool:**
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

**Environment:**
- App URL: `NEXT_PUBLIC_APP_URL` (client) / `BETTER_AUTH_URL` (server)
- Database: connection string env var (consumed via `@neondatabase/serverless`)
- Redis: `UPSTASH_REDIS_URL` + `UPSTASH_REDIS_TOKEN` (Upstash) OR `REDIS_URL` (ioredis)
- QStash: `UPSTASH_QSTASH_TOKEN`, `UPSTASH_QSTASH_CURRENT_SIGNING_KEY`, `UPSTASH_QSTASH_NEXT_SIGNING_KEY`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_SOLO_MONTHLY/ANNUAL`, `STRIPE_PRICE_PRO_MONTHLY/ANNUAL`, `STRIPE_PRICE_TEAM_MONTHLY/ANNUAL`
- GitHub OAuth: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- Cron: `CRON_SECRET`
- AI disable flag: `DISABLE_AI_AGENTS=true` disables all AI routes gracefully

**Build:**
- `turbo.json` — pipeline config at monorepo root
- `apps/dashboard/next.config.ts` — Next.js config

## Platform Requirements

**Development:**
- Bun 1.2.4+
- PostgreSQL (Neon recommended; any Postgres compatible)
- `next dev` (NOT `--turbopack` — known drizzle-orm relation bugs with Turbopack)
- Dev server: port 3000

**Production:**
- Next.js standalone output — Docker/container deployment
- Neon Postgres (serverless Postgres, `@neondatabase/serverless`)
- Vercel Cron: `GET /api/cron/automation` — runs every 5 minutes, protected by `CRON_SECRET`

---

*Stack analysis: 2026-03-22*
