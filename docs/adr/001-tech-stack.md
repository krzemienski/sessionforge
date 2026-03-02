# ADR 001: Tech Stack

**Date:** 2026-03-01
**Status:** Accepted
**Deciders:** Nick (Engineering Lead)

---

## Context

SessionForge is a solo-developer tool that ingests Claude Code session JSONL files from the local filesystem, scores them with a weighted algorithm, and orchestrates multi-agent AI pipelines to produce publication-ready technical content. The stack had to satisfy several constraints simultaneously:

- **Local filesystem access** — reads from `~/.claude/projects/` on the developer's machine
- **Serverless-first deployment** — target hosting on Vercel with no persistent server processes
- **AI-heavy workloads** — streaming content generation taking 10–60 seconds per request
- **Solo maintainability** — a single engineer needs to understand, deploy, and extend every layer
- **Authentic content** — all output must be traceable back to real session data; no fabrication

This document records the reasoning behind each major technical choice. It is intended as a reference for future contributors and for the maintainer returning after a break.

---

## Decisions

### 1. Next.js 15 (App Router) + React 19

**Decision:** Use Next.js 15 with the App Router as the full-stack framework.

**Rationale:**

- The App Router's Route Handlers replace a separate Express/Hapi API layer entirely, keeping the codebase in a single `apps/dashboard` package.
- React Server Components eliminate boilerplate data-fetching code on read-heavy pages (session list, insight list, content library).
- Native streaming support via `Response` with `ReadableStream` is required for SSE-based content generation. Next.js 15 passes these responses directly to the edge without buffering.
- Vercel has first-party Next.js support — zero deployment configuration needed for App Router, middleware, and caching semantics.
- Turbopack (via `next dev --turbopack`) provides sub-second hot reload on the large component tree.

**Alternatives considered:**
- **Remix** — excellent streaming support but weaker Vercel integration and a smaller ecosystem.
- **SvelteKit** — smaller runtime but requires retraining; ecosystem mismatch with shadcn/ui.

**Consequences:**
- All API logic lives in `src/app/api/` as Route Handlers — no separate backend process.
- Server Actions are avoided in favour of explicit REST Route Handlers to keep the AI streaming endpoints testable and OpenAPI-documentable.

---

### 2. Turborepo + Bun (Monorepo Tooling)

**Decision:** Manage the project as a Turborepo monorepo with Bun as the package manager and runtime.

**Rationale:**

- Turborepo's task graph (`turbo.json`) enables `bun build` to build `packages/db` before `apps/dashboard`, caching intermediate artefacts across builds.
- The `packages/db` workspace (`@sessionforge/db`) shares the Drizzle schema and client between the dashboard app and any future CLI tooling without duplicating types.
- Bun's native TypeScript execution eliminates the need for `ts-node` or compilation scripts for seeding and migration commands (`bun db:push`).
- Bun's install speed (~3× faster than npm) matters during Vercel CI builds where cold installs are common.

**Alternatives considered:**
- **npm workspaces + tsc** — too slow; no task graph caching.
- **pnpm workspaces + Turborepo** — valid combination; Bun chosen for unified runtime and faster cold installs.

**Consequences:**
- All `bun` commands run from the workspace root and are delegated via Turborepo's pipeline.
- Adding a new package requires a `packages/<name>/package.json` with `"name": "@sessionforge/<name>"` and an entry in the root `package.json` workspaces array.

---

### 3. PostgreSQL via Drizzle ORM (Neon Serverless)

**Decision:** Use Drizzle ORM with a Neon serverless PostgreSQL database.

**Rationale:**

- **Drizzle over Prisma:** Drizzle generates zero-abstraction SQL at build time and ships no runtime query engine binary. This is critical for Vercel serverless functions where cold-start size directly affects latency. Prisma's query engine binary adds ~40 MB to the bundle.
- **Neon over PlanetScale/Supabase:** Neon's HTTP-mode driver (`@neondatabase/serverless`) works inside Vercel Edge Functions without a TCP connection pool, and it has a generous free tier (0.5 GB storage, 190 compute hours/month).
- The schema-first approach (`packages/db/src/schema.ts`) keeps all table definitions, enums, and relations in one file — easy to audit for a solo project.
- `drizzle-kit push` enables rapid local iteration without generating migration files until production-readiness.

**Alternatives considered:**
- **Prisma + PlanetScale** — PlanetScale dropped its free tier; Prisma bundle size is prohibitive for edge.
- **SQLite (Turso/Cloudflare D1)** — appealing for local development but adds complexity for multi-workspace data and Vercel deployment.
- **Supabase** — includes its own auth, queue, and storage which overlap with better-auth, Upstash QStash, and Vercel, creating redundancy.

**Consequences:**
- Schema changes require running `bun db:push` (dev) or `bun db:generate` + `bun db:migrate` (prod).
- All tables are UUID-keyed (`text` type) to support distributed generation without auto-increment collisions.
- The `(workspaceId, sessionId)` unique index on `claude_sessions` is the idempotency guarantee for re-scanning.

---

### 4. better-auth (Authentication)

**Decision:** Use `better-auth` for email and GitHub OAuth authentication.

**Rationale:**

- **better-auth over NextAuth v5:** better-auth has a simpler configuration model, ships TypeScript types out of the box, and manages its own database tables (no adapter boilerplate). It also supports session extension with custom fields (e.g., `activeWorkspaceId`) without patching.
- **better-auth over Clerk:** Clerk is a hosted SaaS that charges per monthly active user. SessionForge is self-hosted; using Clerk would introduce an external dependency and cost for a tool meant to be fully owned by the developer.
- GitHub OAuth is the primary login method for the target audience (developers), with email/password as fallback.

**Alternatives considered:**
- **NextAuth v5 (Auth.js)** — more community adoption but requires adapter configuration and has weaker TypeScript ergonomics.
- **Clerk** — excellent DX but SaaS lock-in and per-MAU pricing are incompatible with a self-hosted philosophy.
- **Roll-your-own JWT** — too much undifferentiated work for a solo project.

**Consequences:**
- `lib/auth.ts` exports both the server-side `auth` handler and the client-side `authClient`.
- The Route Handler at `app/api/auth/[...all]/route.ts` catches all better-auth routes (sign-in, sign-out, OAuth callbacks, session refresh).
- Auth tables (`users`, `accounts`, `auth_sessions`, `verifications`) are managed by better-auth and should not be manually migrated.

---

### 5. Upstash QStash + Redis (Queue and Cache)

**Decision:** Use Upstash QStash for job scheduling and Upstash Redis for caching.

**Rationale:**

- **Serverless-compatible queue:** Vercel has no persistent processes, so there is no place to run a traditional job queue (Bull, BullMQ, Bee-Queue). QStash is an HTTP-based message queue that POSTs to a webhook URL on a cron schedule — a perfect fit for Vercel.
- **Upstash Redis over Vercel KV:** Upstash's REST API driver works in both serverless and edge functions. Rate limiting and scan-result caching are the two primary use cases; Redis is the industry-standard solution for both.
- **Upstash over self-hosted:** A Redis server would require a persistent host, negating the Vercel-first deployment model. Upstash's free tier (10,000 commands/day, 256 MB) is sufficient for a personal tool.

**Alternatives considered:**
- **Vercel Cron + in-process execution** — Vercel Cron can trigger a route, but it does not provide message durability, retry logic, or queue visibility. QStash provides all three.
- **Inngest** — feature-rich workflow engine but more complex than needed; QStash's simpler model is sufficient.

**Consequences:**
- The `/api/automation/execute` route must validate the `Upstash-Signature` header to prevent unauthorized trigger execution.
- Scheduled triggers store their `cronExpression` in `content_triggers` and register with QStash via the dashboard UI.
- If Upstash is unavailable, scanning and content generation still work; only scheduled automation is affected.

---

### 6. Anthropic SDK (Direct) — No AI Abstraction Layer

**Decision:** Use `@anthropic-ai/sdk` directly, not Vercel AI SDK or LangChain.

**Rationale:**

- SessionForge's agentic loop is a custom `while (stop_reason === 'tool_use')` pattern tuned for the Anthropic Messages API's tool-use protocol. An abstraction layer would hide the stop reasons, content block structure, and token usage needed for cost tracking.
- The Vercel AI SDK's `streamText` and `useChat` hooks target chat-completion patterns, not multi-turn tool-use loops producing structured output.
- LangChain adds significant bundle weight and opinionated abstractions that conflict with the direct MCP-style tool dispatch pattern in `lib/ai/orchestration/tool-registry.ts`.
- Keeping the dependency surface minimal (one SDK, direct API) means the codebase ages better — Anthropic SDK breaking changes are rare and well-documented.

**Alternatives considered:**
- **Vercel AI SDK** — excellent for chatbot patterns; the `tool()` helper does not map cleanly to the custom `dispatchTool()` registry pattern.
- **LangChain** — rich ecosystem but heavyweight; overkill for five well-defined agents.

**Consequences:**
- Each agent file implements its own agentic loop — the pattern is repeated but intentionally so for clarity.
- Model selection (`claude-opus-4-5` vs `claude-haiku-4-5`) is centralised in `lib/ai/orchestration/model-selector.ts`.
- SSE streaming is implemented manually in `lib/ai/orchestration/streaming.ts` using `TransformStream`.

---

### 7. TanStack Query v5 + Zustand (State Management)

**Decision:** Use TanStack Query for server state and Zustand for client state. No Redux, no Context API for data.

**Rationale:**

- **TanStack Query** handles all async data fetching (sessions list, insights list, content list) with automatic caching, background refetching, optimistic updates, and request deduplication. This eliminates `useEffect` + `useState` data-fetching boilerplate entirely.
- **Zustand** handles purely client-side state: editor dirty flags, selected session IDs, sidebar open/close, streaming status. Zustand's minimal API (no reducers, no actions) matches the solo-maintainability requirement.
- Combining both keeps a clear boundary: anything persisted server-side goes through TanStack Query; anything ephemeral and local goes in Zustand.

**Alternatives considered:**
- **Redux Toolkit** — overkill for a project of this size; boilerplate overhead is significant.
- **React Context API for server state** — no caching, no deduplication, causes excessive re-renders on large session lists.
- **SWR** — similar to TanStack Query but smaller ecosystem and fewer features (no optimistic updates, no infinite queries).

**Consequences:**
- All data mutations use TanStack Query's `useMutation` and invalidate relevant query keys on success.
- Zustand stores are defined in `src/lib/stores/` (one store per feature domain).
- React Query DevTools should be enabled in development for query cache inspection.

---

### 8. Tailwind CSS 4 + shadcn/ui (Styling)

**Decision:** Use Tailwind CSS 4 with shadcn/ui components and a flat-black custom design system.

**Rationale:**

- **Tailwind CSS 4** ships with a PostCSS plugin (`@tailwindcss/postcss`) and a new CSS-native variable system, eliminating the `tailwind.config.js` for most configuration. Design tokens are defined directly in `app/globals.css` as CSS custom properties.
- **shadcn/ui** is not a dependency — it is a collection of copy-pasted, unstyled Radix UI primitives that the project owns directly. This means zero breaking changes from upstream and full customisation freedom.
- The **flat-black design aesthetic** (black backgrounds, white text, zinc accents, sharp borders, no shadows) is intentional: it matches the developer tool category and avoids the visual weight of a SaaS marketing site.

**Alternatives considered:**
- **Chakra UI / MUI** — opinionated theme systems that conflict with the custom design direction.
- **CSS Modules** — valid but verbose; Tailwind utility classes are faster to iterate on for a solo developer.

**Consequences:**
- Component customisation is done by editing files under `src/components/ui/` directly.
- New shadcn components are added via `npx shadcn add <component>` and then modified as needed.
- Tailwind's `@apply` directive should be avoided in favour of direct utility class usage.

---

### 9. Local Filesystem over Webhook Integrations

**Decision:** Ingest session data by reading JSONL files from `~/.claude/projects/` on the local filesystem rather than connecting to external APIs (GitHub, Linear, Slack).

**Rationale:**

- SessionForge's core value proposition is authenticity: content sourced directly from real developer sessions, not reconstructed from PR descriptions or commit messages.
- Direct filesystem access requires zero API keys, rate limits, or webhook infrastructure for the data ingestion path.
- The JSONL format produced by Claude Code is stable and richly structured — each line contains role, content, tool use, token counts, and timestamps.
- This is the key architectural divergence from Notra (the inspiration project), which uses webhooks. The local-first approach trades multi-team support for reliability and simplicity.

**Alternatives considered:**
- **GitHub API + Claude Code CLI** — would reconstruct sessions from commits/PRs rather than reading actual tool invocations. Data loss is unacceptable.
- **Webhook from Claude Code** — Claude Code does not currently emit webhooks; filesystem polling is the only viable ingestion method.

**Consequences:**
- Session scanning only works from a locally running instance. The Vercel deployment handles the UI and AI generation; scanning must be triggered from the local dev server or a self-hosted environment with filesystem access.
- The scanner's `basePath` is configurable per workspace (`sessionBasePath` column) to support non-standard Claude Code installation paths.
- Session file paths change if Claude Code is reinstalled; re-scanning will re-index with updated paths without data loss (upsert by `sessionId`).

---

## Summary Table

| Decision | Choice | Key Reason |
|---|---|---|
| Full-stack framework | Next.js 15 (App Router) | Vercel-native; Route Handlers + SSE streaming; RSC for read pages |
| Monorepo | Turborepo + Bun | Task graph caching; fast installs; unified TS runtime for scripts |
| Database | Drizzle ORM + Neon PostgreSQL | Zero-binary ORM; serverless HTTP driver; free tier |
| Auth | better-auth | Self-hosted; TypeScript-native; no per-MAU cost |
| Queue / Cache | Upstash QStash + Redis | HTTP-based; works in Vercel serverless; free tier |
| AI SDK | `@anthropic-ai/sdk` direct | Direct tool-use loop control; no abstraction overhead |
| Client state | TanStack Query v5 + Zustand | Server vs client state boundary; minimal boilerplate |
| Styling | Tailwind CSS 4 + shadcn/ui | Utility-first; owned components; custom design freedom |
| Data ingestion | Local JSONL filesystem | Authenticity; no API keys required; Claude Code native format |

---

## Related Documents

- [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) — detailed pipeline diagrams and schema reference
- [`README.md`](../../README.md) — setup instructions and environment variable guide
- [`sessionforge-prd.md`](../../sessionforge-prd.md) — product requirements and Notra feature parity map
