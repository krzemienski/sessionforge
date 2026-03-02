# SessionForge

> Turn your Claude Code sessions into publication-ready technical content.

SessionForge ingests JSONL session files from `~/.claude/projects/`, analyzes developer workflows through a 6-dimension weighted scoring algorithm, and orchestrates multi-agent pipelines to produce blog posts, Twitter threads, LinkedIn posts, changelogs, and newsletters — all sourced from real coding sessions with real code snippets.

---

## Table of Contents

- [What It Does](#what-it-does)
- [Tech Stack](#tech-stack)
- [Monorepo Structure](#monorepo-structure)
- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Running the App](#running-the-app)
- [Key Concepts](#key-concepts)
- [Content Pipeline](#content-pipeline)
- [Deployment](#deployment)

---

## What It Does

1. **Scans** your `~/.claude/projects/` directory for Claude Code session JSONL files
2. **Parses** each session — extracting tool usage, file modifications, errors, costs, and timestamps
3. **Scores** sessions across 6 dimensions to identify which ones contain publishable insights
4. **Extracts** insights using the AI Insight Extractor agent (Claude Opus)
5. **Generates** content using specialized agents: Blog Writer, Social Writer, Changelog Writer
6. **Edits** content interactively via an AI chat sidebar (streaming)
7. **Publishes** or exports drafts through the Lexical-powered markdown editor

### Who Is This For?

Solo developers and engineering leads who:
- Use Claude Code daily and have `~/.claude/projects/` populated with sessions
- Want to build a technical personal brand from authentic, real-work content
- Are comfortable deploying a Vercel + Neon + Upstash stack

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) + React 19 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Editor | Lexical (rich text, markdown import/export) |
| Server state | TanStack Query v5 |
| Client state | Zustand |
| Auth | better-auth (email + GitHub OAuth) |
| Database | PostgreSQL via Drizzle ORM (Neon serverless) |
| Queue | Upstash QStash (cron + scheduled jobs) |
| Cache | Upstash Redis |
| AI SDK | `@anthropic-ai/sdk` |
| AI Models | `claude-opus-4-5-20250514` (generation), `claude-haiku-4-5-20251001` (routing) |
| Deployment | Vercel |
| Monorepo | Turborepo + Bun |

---

## Monorepo Structure

```
sessionforge/
├── turbo.json                 # Turborepo task graph
├── package.json               # Root workspace (bun)
├── .env.example               # Environment variable template
│
├── apps/
│   └── dashboard/             # Next.js 15 application
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       └── src/
│           ├── app/
│           │   ├── (auth)/    # Login + signup pages
│           │   ├── (dashboard)/[workspace]/
│           │   │   ├── page.tsx          # Dashboard home
│           │   │   ├── sessions/         # Session browser + detail
│           │   │   ├── insights/         # Ranked insights list + detail
│           │   │   ├── content/          # Content library + Lexical editor
│           │   │   ├── automation/       # Trigger management
│           │   │   └── settings/         # Workspace, style, API keys
│           │   └── api/
│           │       ├── auth/             # better-auth handler
│           │       ├── sessions/scan/    # POST: trigger JSONL scan
│           │       ├── insights/extract/ # POST: run insight extractor
│           │       ├── agents/           # blog, social, changelog, chat (SSE)
│           │       └── automation/       # Triggers + QStash execute endpoint
│           ├── components/
│           │   ├── ui/          # shadcn/ui base components
│           │   ├── layout/      # Sidebar, workspace selector, user menu
│           │   ├── sessions/    # Session cards, timeline, scan button
│           │   ├── insights/    # Insight cards, score badge, dimension chart
│           │   ├── content/     # Content editor, AI chat sidebar, publish button
│           │   └── automation/  # Trigger cards + cron input
│           └── lib/
│               ├── auth.ts           # better-auth client
│               ├── db.ts             # Drizzle client
│               ├── redis.ts          # Upstash Redis client
│               ├── qstash.ts         # Upstash QStash client
│               ├── sessions/
│               │   ├── scanner.ts    # JSONL file discovery
│               │   ├── parser.ts     # Line-by-line JSONL parsing
│               │   ├── normalizer.ts # Typed NormalizedSession mapping
│               │   └── indexer.ts    # Drizzle upsert to PostgreSQL
│               └── ai/
│                   ├── orchestration/
│                   │   ├── tool-registry.ts  # MCP tool set composition
│                   │   ├── model-selector.ts # Opus vs Haiku routing
│                   │   └── streaming.ts      # SSE response helpers
│                   ├── tools/            # MCP tool implementations
│                   ├── agents/           # AI agent implementations
│                   └── prompts/          # System prompt templates
│
└── packages/
    ├── db/                    # Drizzle schema + migrations
    │   ├── src/schema.ts      # All tables, enums, relations
    │   └── migrations/        # drizzle-kit generated
    └── tsconfig/              # Shared TypeScript configs
```

---

## Architecture Overview

### Session Pipeline

```
~/.claude/projects/           JSONL files on disk
       │
       ▼
  scanner.ts                  Discovers files, decodes project paths
       │
       ▼
  parser.ts                   Streams JSONL line-by-line via readline
       │                       Extracts: messages, tools, file edits, errors, costs
       ▼
  normalizer.ts               Maps parsed data → NormalizedSession type
       │
       ▼
  indexer.ts                  Drizzle upsert → claude_sessions table
```

### AI Content Pipeline

```
claude_sessions (DB)
       │
       ▼
  Insight Extractor           Claude Opus agent
  (insight-extractor.ts)      Reads session transcript via MCP tools
       │                       Scores 6 dimensions, produces insights
       ▼
  insights (DB)               Ranked by composite score (0–65)
       │
       ▼
  ┌────┴──────────────────────┐
  │                           │
Blog Writer              Social Writer            Changelog Writer
(blog-writer.ts)         (social-writer.ts)       (changelog-writer.ts)
  │                           │                           │
  └────────────┬──────────────┘                          │
               ▼                                         │
          SSE Stream → content editor             SSE Stream → content editor
               │
               ▼
          posts (DB)           Draft → Publish → Archive
```

### Agent Pattern

All agents follow an identical agentic loop:

```typescript
// Typed input → Anthropic messages → tool loop → SSE stream
while (response.stop_reason === 'tool_use') {
  const toolResult = await dispatchTool(toolCall);
  messages.push(toolResult);
  response = await anthropic.messages.create(messages);
}
```

Each agent has a restricted tool set via `AGENT_TOOL_SETS`:

| Agent | Tool Sets Available |
|-------|-------------------|
| insight-extractor | session, insight |
| blog-writer | session, insight, post, skill |
| social-writer | session, insight, post, skill |
| changelog-writer | session, insight, post |
| editor-chat | post, markdown |

---

## Prerequisites

- **Bun** ≥ 1.2.4 — [install](https://bun.sh)
- **Node.js** ≥ 20 (for Next.js compatibility)
- **PostgreSQL** — recommended: [Neon](https://neon.tech) (serverless, free tier available)
- **Upstash** account — for [Redis](https://upstash.com) and [QStash](https://upstash.com/qstash)
- **Anthropic API key** — [console.anthropic.com](https://console.anthropic.com)
- **GitHub OAuth App** (optional) — for GitHub login

---

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-username/sessionforge.git
cd sessionforge
```

### 2. Install dependencies

```bash
bun install
```

### 3. Configure environment variables

```bash
cp .env.example apps/dashboard/.env.local
```

Edit `apps/dashboard/.env.local` with your credentials (see [Environment Variables](#environment-variables) below).

### 4. Set up the database

```bash
bun db:push
```

This runs `drizzle-kit push` against your Neon database to create all tables.

### 5. Start the development server

```bash
bun dev
```

The dashboard will be available at [http://localhost:3000](http://localhost:3000).

### 6. Create your first workspace

1. Sign up at `http://localhost:3000/signup`
2. Create a workspace — it will default to scanning `~/.claude`
3. Click **Scan Sessions** on the Sessions page
4. Once sessions are indexed, click **Extract Insights** to run the AI analysis

---

## Environment Variables

Copy `.env.example` to `apps/dashboard/.env.local`. All variables are required unless marked optional.

### Database

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string (Neon format) | `postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/sessionforge` |

Get this from your [Neon dashboard](https://neon.tech) after creating a database named `sessionforge`.

### Authentication

| Variable | Description | Example |
|----------|-------------|---------|
| `BETTER_AUTH_SECRET` | Random secret for session signing — generate with `openssl rand -base64 32` | `your-random-32-char-secret` |
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID (optional — enables GitHub login) | `Iv1.abc123` |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret (optional) | `abc123def456` |

To create a GitHub OAuth App:
1. Go to GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
2. Set **Authorization callback URL** to `http://localhost:3000/api/auth/callback/github`

### AI

| Variable | Description | Example |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude agents | `sk-ant-api03-...` |

Get this from [console.anthropic.com/keys](https://console.anthropic.com/keys). The app uses `claude-opus-4-5-20250514` for content generation and `claude-haiku-4-5-20251001` for routing/classification.

### Cache & Queue (Upstash)

| Variable | Description | Example |
|----------|-------------|---------|
| `UPSTASH_REDIS_URL` | Upstash Redis REST URL | `https://your-db.upstash.io` |
| `UPSTASH_REDIS_TOKEN` | Upstash Redis REST token | `AXxx...` |
| `UPSTASH_QSTASH_TOKEN` | QStash publishing token | `eyJ...` |
| `UPSTASH_QSTASH_CURRENT_SIGNING_KEY` | QStash webhook signing key | `sig_...` |
| `UPSTASH_QSTASH_NEXT_SIGNING_KEY` | QStash next signing key (rotation) | `sig_...` |

Create a Redis database and QStash queue at [console.upstash.com](https://console.upstash.com). Both have free tiers sufficient for development.

### Application

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_APP_URL` | Public URL for the app (used in OAuth callbacks and QStash webhooks) | `http://localhost:3000` |

For production: set this to your Vercel deployment URL (e.g., `https://sessionforge.vercel.app`).

---

## Database Setup

SessionForge uses Drizzle ORM with a Neon PostgreSQL database.

### Push schema (development)

```bash
bun db:push
```

Introspects the Drizzle schema in `packages/db/src/schema.ts` and applies it to your database. Safe to run repeatedly — it only adds/modifies, does not drop.

### Generate migrations (production)

```bash
bun db:generate
```

Generates SQL migration files in `packages/db/migrations/`. Commit these and apply via `drizzle-kit migrate` on your production database.

### Schema overview

| Table | Purpose |
|-------|---------|
| `users` | User accounts (better-auth managed) |
| `auth_sessions` | Active login sessions |
| `accounts` | OAuth provider links |
| `workspaces` | User workspaces (maps to Claude project paths) |
| `style_settings` | Per-workspace writing style configuration |
| `claude_sessions` | Indexed Claude Code session records |
| `insights` | AI-extracted insights with composite scores |
| `posts` | Generated content drafts and published posts |
| `content_triggers` | Automation trigger rules (manual, scheduled, file_watch) |
| `api_keys` | External publishing API keys |

---

## Running the App

### Development

```bash
bun dev          # Start all apps in watch mode (turbopack)
bun build        # Production build
bun lint         # Run ESLint across all packages
```

### Individual apps

```bash
cd apps/dashboard && bun dev   # Dashboard only
cd packages/db && bun generate # Regenerate Drizzle migrations
```

---

## Key Concepts

### Workspaces

A workspace maps to a Claude session base path (default: `~/.claude`). Each workspace has its own sessions, insights, posts, and style settings. Multiple workspaces are useful if you have sessions in different locations (e.g., separate personal and work Claude accounts).

### Session Scanning

The scanner discovers JSONL files at:
- `~/.claude/projects/*/sessions/*.jsonl` — per-project sessions
- `~/.claude/sessions/*.jsonl` — global sessions

Project directory names are encoded paths (`-Users-nick-projects-my-app` → `/Users/nick/projects/my-app`). The scanner decodes these to populate `project_path` and `project_name`.

### Insight Scoring

Each insight is scored on 6 dimensions (1–5 scale):

| Dimension | Weight | What Makes a 5 |
|-----------|--------|----------------|
| Novel Problem-Solving | 3× | Technique nobody has written about |
| Tool/Pattern Discovery | 3× | Novel MCP usage or workflow pattern |
| Before/After Transformation | 2× | Dramatic improvement with hard numbers |
| Failure + Recovery | 3× | Deep debugging, satisfying resolution |
| Reproducibility | 1× | Universal technique any developer can use |
| Scale/Performance | 1× | Hard numbers: X% faster, Y hours saved |

**Composite score** = `(novelty×3) + (tool×3) + (transform×2) + (failure×3) + (repro×1) + (scale×1)`

Maximum: **65**. Insights scoring ≥ 45 are flagged as exceptional content candidates.

### Content Types

| Type | Description |
|------|-------------|
| `blog_post` | Long-form technical post (default target: 2500 words) |
| `twitter_thread` | Multi-tweet thread with code snippets |
| `linkedin_post` | Professional narrative post |
| `devto_post` | Dev.to formatted post with frontmatter |
| `changelog` | Developer-focused changelog entry |
| `newsletter` | Newsletter section (curated insights) |

---

## Content Pipeline

### Manual generation

1. Browse **Sessions** → select a session → click **Extract Insights**
2. Browse **Insights** → sort by composite score → select a high-scoring insight
3. Click **Generate Blog Post** (or Social, Changelog)
4. Wait for SSE streaming to complete → review in the Lexical editor
5. Use the **AI Chat Sidebar** to request revisions
6. Click **Publish** or export as markdown

### Automated generation (Automation tab)

1. Create a trigger with type `scheduled` and a cron expression (e.g., `0 9 * * 1` = Monday 9am)
2. Set the lookback window (e.g., `last_7_days`)
3. Set the content type to generate
4. QStash will call `/api/automation/execute` on schedule — scans recent sessions, extracts insights, and drafts content automatically

---

## Deployment

### Vercel (recommended)

1. Push this repo to GitHub
2. Import to [Vercel](https://vercel.com) — it will detect the Turborepo monorepo
3. Set root directory to `apps/dashboard`
4. Add all environment variables from `.env.example` in the Vercel dashboard
5. Set `NEXT_PUBLIC_APP_URL` to your Vercel deployment URL
6. Update your GitHub OAuth App callback URL to `https://your-app.vercel.app/api/auth/callback/github`

**Note:** Session scanning reads from the local filesystem (`~/.claude/`). On Vercel, this path does not exist — scanning is only possible from a locally running instance or a self-hosted deployment. The Vercel deployment serves the UI and AI generation; pair it with a local instance running the scan endpoint if you need automated scanning.

### Self-hosted

Any Node.js 20+ host works. Build with `bun build` and start with `bun start` from `apps/dashboard`.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for code style, branch conventions, and PR process.
