# SessionForge

AI-powered content platform that transforms Claude Code session transcripts into polished blog posts, social content, newsletters, and changelogs.

## Overview

SessionForge extracts technical insights from your Claude Code sessions and automatically generates multi-format content. Scan local sessions or remote SSH servers, use AI agents to draft content, collaborate with an intelligent editor, and publish to 7 platforms with one click.

## Key Features

- **Session Scanning Pipeline** — Index JSONL transcripts from `~/.claude/` (local or SSH remote) into structured database records
- **6 AI Agents** — Blog writer, social content, newsletter, changelog, content repurpose, and editor chat (powered by Claude Opus + Haiku)
- **7 Content Types** — Blog posts, Twitter threads, LinkedIn posts, Dev.to articles, changelogs, newsletters, and custom formats
- **Multi-Platform Publishing** — Hashnode, WordPress, Dev.to, Ghost, Medium, Twitter/X, LinkedIn with one-click scheduling
- **AI-Powered Editor** — Lexical rich text with streaming AI chat, split view, and revision history
- **SEO Analysis** — Readability scoring, keyword optimization, and meta tag generation
- **Unified Pipeline** — QStash-scheduled scanning, extraction, and generation with SSE progress streaming and observable run logs
- **Start Analysis** — Configurable lookback window for automated content extraction and recommendations
- **Analytics Dashboard** — Social engagement metrics and publishing streak tracking
- **Workspace Isolation** — Multiple projects per user with per-workspace configuration

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15 (App Router) + React 19 + Tailwind CSS 4 |
| **UI** | shadcn/ui + Lexical editor (rich text, markdown) |
| **Server State** | TanStack Query v5 |
| **Client State** | React Context + useState |
| **Auth** | better-auth (email + GitHub/LinkedIn OAuth) |
| **Database** | PostgreSQL (Neon serverless) + Drizzle ORM (30 tables) |
| **Queue/Scheduling** | Upstash QStash |
| **Cache** | Upstash Redis |
| **AI** | @anthropic-ai/claude-agent-sdk (zero API keys — inherits from CLI) |
| **Deployment** | Vercel (frontend + serverless API routes) |
| **Package Manager** | Bun + Turborepo |

## Repository Structure

```
sessionforge/
├── apps/
│   └── dashboard/                  # Next.js 15 application (21 user-facing pages)
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/         # Login / signup pages
│       │   │   ├── (dashboard)/    # Protected pages
│       │   │   │   ├── sessions/      # Session browser
│       │   │   │   ├── insights/      # AI-ranked insights
│       │   │   │   ├── content/       # Editor + library (list/calendar/pipeline views)
│       │   │   │   ├── analytics/     # Social media analytics
│       │   │   │   ├── automation/    # Trigger management
│       │   │   │   ├── observability/ # Pipeline status + visualization
│       │   │   │   └── settings/      # General, Style, API Keys, Integrations, Webhooks, Sources
│       │   │   └── api/            # 149 internal + 10 public v1 routes
│       │   ├── components/         # React UI components
│       │   └── lib/
│       │       ├── sessions/       # Scanner → Parser → Normalizer → Indexer + SSH scanner
│       │       ├── ai/             # 6 agents, tools, prompts, orchestration
│       │       ├── integrations/   # Platform clients (Dev.to, Ghost, GitHub, etc)
│       │       ├── automation/     # Pipeline execution engine
│       │       ├── observability/  # Event bus, instrumentation, SSE broadcaster
│       │       ├── ingestion/      # URL + repo content ingestion
│       │       ├── seo/            # SEO/readability analysis
│       │       ├── crypto/         # Encryption utilities
│       │       └── media/          # Diagram generation
│       └── package.json
└── packages/
    └── db/                         # Shared Drizzle schema
        └── src/schema.ts           # 30 tables, enums, relations
```

## Getting Started

### Prerequisites

- Node.js 18+ (or use Bun)
- Bun 1.2.4+
- PostgreSQL 14+ (local or Neon)
- Claude CLI authenticated (`claude login`)

### Installation

```bash
# Clone the repository
git clone https://github.com/nick/sessionforge.git
cd sessionforge

# Install dependencies
bun install

# Setup environment variables
cp .env.example .env.local
# Edit .env.local and add:
# - NEON_DATABASE_URL
# - STRIPE_SECRET_KEY
# - GitHub/LinkedIn OAuth credentials (if using social auth)
# Note: No ANTHROPIC_API_KEY needed — AI features use claude-agent-sdk
```

### Database Setup

```bash
# Push schema to your PostgreSQL database
bun run db:push

# Generate TypeScript types (if schema changes)
bun run db:generate
```

### Start Development Server

```bash
# Start all services (Next.js app + Turbo build watcher)
bun run dev

# Runs on http://localhost:3000
# Note: Use 'next dev' (not --turbopack) to avoid drizzle-orm relation bugs
```

### Build for Production

```bash
# Build all packages
bun run build

# Run production server
cd apps/dashboard && bun run start
```

## Architecture

For a comprehensive overview of system design, API routes, database schema, integration patterns, and key design decisions, see **[Architecture Documentation](./ARCHITECTURE.md)**.

Key concepts:
- **Session Pipeline**: JSONL files → Scanner → Parser → Normalizer → Indexer → PostgreSQL
- **Agentic Loop**: AI agents use tool-use patterns to fetch data iteratively and produce higher-quality output
- **Tool Registry**: Centralized access control per agent (e.g., `editor-chat` cannot read sessions)
- **SSE Streaming**: Real-time content generation with visible tool activity
- **CLI-Inherited Auth**: `@anthropic-ai/claude-agent-sdk` spawns `claude` CLI — no API keys in environment

## API

SessionForge exposes 149 internal routes and 10 public v1 API routes for programmatic access.

### Public API (v1)

```
GET  /api/v1/sessions              # List sessions
POST /api/v1/sessions/scan         # Scan local/remote sessions
POST /api/v1/sessions/upload       # Upload JSONL files
GET  /api/v1/content               # List posts
GET  /api/v1/content/[id]          # Get post by ID
POST /api/v1/content/generate      # Generate content from sessions
GET  /api/v1/insights              # Ranked insights
GET  /api/v1/webhooks              # Webhook management
DELETE /api/v1/webhooks/[id]       # Delete webhook
GET  /api/v1/openapi.json          # OpenAPI schema
```

### Key Internal Routes

```
POST /api/agents/blog              # Generate blog post (SSE)
POST /api/agents/social            # Generate social content (SSE)
POST /api/agents/chat              # Editor AI chat (SSE)
POST /api/automation/execute       # QStash trigger endpoint
GET  /api/content/[id]/seo         # SEO metadata + analysis
POST /api/integrations/*/publish   # Publish to platform
```

For the complete API schema, see `/api/v1/openapi.json`.

## Development Workflow

1. **Plan** — Design feature scope and architecture
2. **Implement** — Write code following patterns in `./docs/code-standards.md`
3. **Validate** — Test through the actual UI (no mocks, no test files)
4. **Commit** — Use conventional commits (`feat:`, `fix:`, `docs:`)
5. **Deploy** — Push to main; Vercel handles deployment

For details, see **[Development Roadmap](./development-roadmap.md)** and **[Code Standards](./code-standards.md)**.

## Key Design Principles

1. **Zero API Key Configuration** — AI features inherit auth from Claude CLI; no env var management needed
2. **Local First** — Read sessions directly from `~/.claude/` without external webhooks
3. **Agentic Iteration** — Multi-turn tool-use loops for intelligent, context-aware generation
4. **Workspace Isolation** — Every feature scoped to `workspaceId` for multi-tenant safety
5. **Real System Validation** — Always validate through the UI, not test harnesses or mocks
6. **Idempotent Operations** — Session scanning, content upserts, and automation are safe to repeat

## Contributing

1. Read the architecture docs
2. Follow code standards and naming conventions
3. Test features through the browser UI
4. Submit PRs with clear description and validation evidence

## License

TBD
