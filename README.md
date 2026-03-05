# SessionForge

> Turn your Claude Code sessions into publication-ready technical content.

SessionForge ingests JSONL session files from `~/.claude/projects/`, analyzes developer workflows through a 6-dimension weighted scoring algorithm, and orchestrates multi-agent pipelines to produce blog posts, Twitter threads, LinkedIn posts, changelogs, and newsletters — all sourced from real coding sessions with real code snippets.

---

## Quick Start

### Local Development

```bash
git clone https://github.com/your-username/sessionforge.git
cd sessionforge
bun install
cp .env.example apps/dashboard/.env.local
# Edit apps/dashboard/.env.local with your credentials
bun db:push
bun dev
```

### Docker

```bash
docker compose up -d
# App at http://localhost:3000 (AI features disabled — requires Claude CLI)
```

### Docker (Production)

```bash
# Set environment variables in your shell or .env file
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## What It Does

1. **Scans** your `~/.claude/projects/` directory for Claude Code session JSONL files
2. **Parses** each session — extracting tool usage, file modifications, errors, costs, and timestamps
3. **Scores** sessions across 6 dimensions to identify which ones contain publishable insights
4. **Extracts** insights using the AI Insight Extractor agent
5. **Generates** content using specialized agents: Blog Writer, Social Writer, Changelog Writer, Newsletter Writer
6. **Edits** content interactively via an AI chat sidebar with inline quick-edit controls
7. **Publishes** to Hashnode, WordPress, or Dev.to — or exports as markdown/HTML

### Who Is This For?

Solo developers and engineering leads who:
- Use Claude Code daily and have `~/.claude/projects/` populated with sessions
- Want to build a technical personal brand from authentic, real-work content
- Are comfortable deploying a Vercel + Neon + Upstash stack (or Docker)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) + React 19 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Editor | Lexical (rich text, markdown import/export) |
| Server state | TanStack Query v5 |
| Client state | Zustand |
| Auth | Better Auth (email + GitHub OAuth) |
| Database | PostgreSQL via Drizzle ORM (Neon serverless) |
| Queue | Upstash QStash |
| Cache | Upstash Redis |
| AI | `@anthropic-ai/claude-agent-sdk` (CLI-inherited auth, zero API keys) |
| Deployment | Vercel (primary) / Docker (self-hosted) |
| Monorepo | Turborepo + Bun |

---

## Monorepo Structure

```
sessionforge/
├── turbo.json                 # Turborepo task graph
├── package.json               # Root workspace (bun)
├── Dockerfile                 # Multi-stage production build
├── docker-compose.yml         # Local dev with Postgres
├── docker-compose.prod.yml    # Production override
├── vercel.json                # Vercel deployment config
│
├── apps/
│   └── dashboard/             # Next.js 15 application
│       ├── next.config.ts
│       └── src/
│           ├── app/
│           │   ├── (auth)/              # Login + signup
│           │   ├── (dashboard)/[workspace]/
│           │   │   ├── page.tsx          # Dashboard home
│           │   │   ├── sessions/         # Session browser + detail
│           │   │   ├── insights/         # Ranked insights list + detail
│           │   │   ├── content/          # Content library + editor
│           │   │   ├── automation/       # Trigger management
│           │   │   └── settings/         # Workspace, style, API keys
│           │   └── api/                  # 76+ internal + 9 public v1 routes
│           ├── components/
│           │   ├── editor/               # Markdown editor, AI chat, inline controls
│           │   ├── preview/              # Content preview with citation links
│           │   └── ui/                   # shadcn/ui base components
│           ├── hooks/                    # React hooks (use-editor-chat, etc.)
│           └── lib/
│               ├── ai/                   # Agent runner, tools, prompts
│               ├── sessions/             # Scanner, parser, indexer
│               └── ingestion/            # External content ingestion
│
└── packages/
    ├── db/                    # Drizzle schema + migrations (30+ tables)
    └── tsconfig/              # Shared TypeScript configs
```

---

## AI Architecture

SessionForge uses `@anthropic-ai/claude-agent-sdk` exclusively for all AI features. The SDK's `query()` function inherits authentication directly from the Claude CLI session — **there are no API keys**. The SDK spawns the `claude` CLI subprocess which uses the logged-in user's credentials automatically.

### Agents

| Agent | Purpose |
|-------|---------|
| Insight Extractor | Analyzes session transcripts, scores 6 dimensions |
| Blog Writer | Long-form technical posts (~2500 words) |
| Social Writer | Twitter threads, LinkedIn posts |
| Newsletter Writer | Curated insight summaries |
| Changelog Writer | Developer-focused changelog entries |
| Editor Chat | Interactive AI editing via chat sidebar |
| Evidence Writer | Evidence-based content from session mining |
| Style Learner | Learns and applies user writing style |

### Deployment Limitations

- **Vercel**: AI generation features will NOT work because the Claude CLI subprocess cannot be spawned in serverless functions. Vercel deployment is suitable for content management, viewing, and publishing only.
- **Docker with `DISABLE_AI_AGENTS=true`**: All AI routes return graceful error messages. The app functions for content management without AI generation.
- **Docker with Claude CLI available**: Full functionality when the CLI is installed and authenticated in the container.

---

## Environment Variables

Copy `.env.example` to `apps/dashboard/.env.local`. See [DEPLOYMENT.md](./DEPLOYMENT.md) for per-environment checklists.

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (Neon format) |
| `BETTER_AUTH_SECRET` | Random secret — `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | Public URL (e.g., `http://localhost:3000`) |

### Optional

| Variable | Description |
|----------|-------------|
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth login |
| `UPSTASH_REDIS_URL` / `UPSTASH_REDIS_TOKEN` | Caching |
| `UPSTASH_QSTASH_TOKEN` | Scheduled automation |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Billing |
| `DISABLE_AI_AGENTS` | Set to `true` to disable AI features |

---

## Database

SessionForge uses Drizzle ORM with Neon PostgreSQL.

```bash
bun db:push       # Push schema to dev database
bun db:generate   # Generate SQL migration files
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for production migration workflow.

---

## Content Types

| Type | Description |
|------|-------------|
| `blog_post` | Long-form technical post |
| `twitter_thread` | Multi-tweet thread with code snippets |
| `linkedin_post` | Professional narrative post |
| `devto_post` | Dev.to formatted post with frontmatter |
| `changelog` | Developer-focused changelog entry |
| `newsletter` | Newsletter section |
| `custom` | Freeform content |

---

## Publishing Integrations

- **Hashnode** — Direct publish from editor
- **WordPress** — XML-RPC or REST API
- **Dev.to** — API publish with frontmatter

---

## Documentation

- [TOOLING.md](./TOOLING.md) — Full technology inventory
- [ARCHITECTURE.md](./ARCHITECTURE.md) — System design and data flows
- [DEPLOYMENT.md](./DEPLOYMENT.md) — Step-by-step deployment guides
- [CONTRIBUTING.md](./CONTRIBUTING.md) — Development workflow and code style
- [CHANGELOG.md](./CHANGELOG.md) — Release history
