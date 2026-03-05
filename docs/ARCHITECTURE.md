# SessionForge Architecture

**Version:** 0.5.0-alpha
**Updated:** 2026-03-05

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Monorepo Structure](#monorepo-structure)
3. [Tech Stack](#tech-stack)
4. [Session Scanning Pipeline](#session-scanning-pipeline)
5. [AI Agent Pipeline](#ai-agent-pipeline)
6. [Content Lifecycle](#content-lifecycle)
7. [Database Schema](#database-schema)
8. [API Routes](#api-routes)
9. [Integration Architecture](#integration-architecture)
10. [Key Design Decisions](#key-design-decisions)

---

## System Overview

```mermaid
graph TB
    subgraph Client["Browser"]
        UI[Next.js App Router]
        Editor[Lexical Editor]
        Views[Calendar / Pipeline / List]
        Analytics[Social Analytics Dashboard]
    end

    subgraph Server["Next.js API Routes (100+ endpoints)"]
        Auth[better-auth]
        SessionAPI[Sessions]
        ContentAPI[Content CRUD]
        AgentAPI[AI Agents - SSE]
        IntAPI[Integrations - 7 platforms]
        SchedAPI[Schedule / Queue]
        SEOAPI[SEO / Analytics]
    end

    subgraph AI["AI Layer (claude-agent-sdk)"]
        Blog[Blog Writer]
        Social[Social Writer]
        Changelog[Changelog Writer]
        Chat[Editor Chat]
        Insight[Insight Extractor]
        Style[Style Learner]
    end

    subgraph Data["Data Layer"]
        DB[(PostgreSQL - Neon\n59 tables)]
        Redis[(Upstash Redis)]
        QStash[Upstash QStash]
    end

    Client --> Server
    AgentAPI --> AI
    Server --> Data
    QStash -->|webhook| SchedAPI
```

---

## Monorepo Structure

Turborepo monorepo managed with Bun. All application code lives in `apps/`, shared packages in `packages/`.

```
sessionforge/
├── turbo.json
├── package.json
├── .env.example
├── Dockerfile / docker-compose.yml
│
├── apps/
│   └── dashboard/                      # Next.js 15 (App Router)
│       └── src/
│           ├── app/
│           │   ├── (auth)/             # Login / signup
│           │   ├── (dashboard)/[workspace]/
│           │   │   ├── sessions/       # Session browser
│           │   │   ├── insights/       # Ranked insights
│           │   │   ├── content/        # Library + editor (list/calendar/pipeline)
│           │   │   ├── calendar/       # Standalone calendar
│           │   │   ├── series/         # Content series
│           │   │   ├── collections/    # Content collections
│           │   │   ├── analytics/      # Social media analytics
│           │   │   ├── recommendations/# AI recommendations
│           │   │   ├── automation/     # Trigger management
│           │   │   ├── schedule/       # Publish queue
│           │   │   └── settings/       # Workspace, style, API keys,
│           │   │                       # integrations, skills, webhooks, wordpress
│           │   └── api/                # 100+ Route Handlers
│           ├── components/             # React components
│           └── lib/
│               ├── sessions/           # Scanner -> Parser -> Normalizer -> Indexer
│               ├── ai/                 # Agents, tools, prompts, orchestration
│               ├── integrations/       # Platform clients
│               ├── seo/               # SEO/GEO analysis
│               ├── media/             # Diagram generation
│               └── ingestion/         # URL + repo content ingestion
│
└── packages/
    └── db/                             # Drizzle ORM schema + client
        └── src/schema.ts               # 59 tables, enums, relations
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router) + React 19 + Tailwind CSS 4 |
| UI Library | shadcn/ui + flat-black design tokens |
| Editor | Lexical (rich text, markdown import/export) |
| Server State | TanStack Query v5 |
| Client State | Zustand |
| Auth | better-auth (email + GitHub OAuth) |
| Database | PostgreSQL via Drizzle ORM (Neon serverless) |
| Queue | Upstash QStash (scheduled job execution) |
| Cache | Upstash Redis (scan results, rate limits) |
| AI | `@anthropic-ai/claude-agent-sdk` (CLI-inherited auth, zero API keys) |
| AI Models | Claude Opus 4.5 (generation), Claude Haiku 4.5 (routing/classification) |
| Deployment | Vercel (frontend + serverless API routes) |
| Package Manager | Bun + Turborepo |

---

## Session Scanning Pipeline

The pipeline converts raw JSONL files from `~/.claude/` into structured database records.

```mermaid
flowchart TD
    FS["Developer Filesystem\n~/.claude/projects/*/sessions/*.jsonl\n~/.claude/sessions/*.jsonl"]
    S["Stage 1: Scanner\nlib/sessions/scanner.ts\n- Resolve basePath\n- Read JSONL files\n- Decode project paths\n- Filter by lookbackDays"]
    P["Stage 2: Parser\nlib/sessions/parser.ts\n- Stream JSONL via readline\n- Extract messages, tools, files, errors\n- Track timestamps and costs"]
    N["Stage 3: Normalizer\nlib/sessions/normalizer.ts\n- Combine meta + parsed data\n- Derive projectName\n- Compute duration"]
    I["Stage 4: Indexer\nlib/sessions/indexer.ts\n- Drizzle upsert\n- Conflict key: workspaceId + sessionId\n- Idempotent"]
    DB[(claude_sessions table)]

    FS --> S --> P --> N --> I --> DB
```

**Trigger points:**
- **Manual:** POST `/api/sessions/scan` from dashboard
- **Upload:** Drag-drop JSONL files on Sessions page
- **Scheduled:** Cron via QStash -> POST `/api/automation/execute`

---

## AI Agent Pipeline

All agents use `@anthropic-ai/claude-agent-sdk`, which inherits authentication from the Claude Code CLI session. **No API keys needed.**

### Agent Overview

| Agent | Route | Model | Output | Tools |
|---|---|---|---|---|
| `insight-extractor` | POST `/api/insights/extract` | Haiku | JSON | session, insight |
| `blog-writer` | POST `/api/agents/blog` | Opus | SSE stream | session, insight, post, skill |
| `social-writer` | POST `/api/agents/social` | Opus | SSE stream | session, insight, post |
| `changelog-writer` | POST `/api/agents/changelog` | Haiku | SSE stream | session, post |
| `editor-chat` | POST `/api/agents/chat` | Opus | SSE stream | post, markdown |
| `style-learner` | Internal | Opus | JSON | workspace style analysis |

### Agentic Loop Pattern

```mermaid
sequenceDiagram
    participant Client
    participant Route as API Route
    participant SDK as claude-agent-sdk
    participant Tools as MCP Tools
    participant DB as PostgreSQL

    Client->>Route: POST /api/agents/blog
    Route->>SDK: query({ model, tools, messages })
    loop While tool_use
        SDK->>Route: tool_use block
        Route->>Tools: dispatchTool(name, input)
        Tools->>DB: Read/write data
        DB-->>Tools: Result
        Tools-->>Route: tool_result
        Route-->>Client: SSE: tool_use + tool_result
        Route->>SDK: Continue with tool_result
    end
    SDK-->>Route: Final text response
    Route-->>Client: SSE: text + complete
```

### Tool Registry

`lib/ai/orchestration/tool-registry.ts` controls tool access per agent:

| Tool Set | Tools Exposed |
|---|---|
| `session` | `get_session_summary`, `get_session_messages`, `list_sessions_by_timeframe` |
| `insight` | `get_insight_details`, `get_top_insights`, `create_insight` |
| `post` | `create_post`, `update_post`, `get_post`, `get_markdown` |
| `markdown` | `edit_markdown`, `insert_section`, `replace_section` |
| `skill` | `list_available_skills`, `get_skill_by_name` |

### SSE Event Types

```
event: status       { phase, message }
event: tool_use     { tool, input }
event: tool_result  { tool, success, error? }
event: text         { content }
event: complete     { usage }
event: error        { message }
```

---

## Content Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Idea: Manual / AI Recommend
    Idea --> Draft: Start Writing
    Draft --> Draft: AI Edit via Chat
    Draft --> InReview: Submit for Review
    InReview --> Draft: Request Revisions
    InReview --> Scheduled: Approve + Set Date
    InReview --> Published: Approve + Publish Now
    Scheduled --> Published: QStash fires at scheduled time
    Published --> Archived: Archive
    Draft --> Archived: Archive

    state Published {
        [*] --> Hashnode: Publish
        [*] --> DevTo: Publish
        [*] --> Medium: Publish
        [*] --> Ghost: Publish
        [*] --> WordPress: Publish
        [*] --> Twitter: Post Thread
        [*] --> LinkedIn: Post
    }
```

### Content Views

| View | Description |
|---|---|
| **List** | All posts with status tabs (All/Ideas/Drafts/In Review/Published/Archived), streak indicator |
| **Calendar** | Monthly grid with posts on dates, Published/Draft/AI Suggested Slot legend |
| **Pipeline** | Kanban board: Idea -> Draft -> In Review -> Published columns |

---

## Database Schema

59 tables in PostgreSQL via Drizzle ORM. Schema at `packages/db/src/schema.ts`.

### Entity Relationship (Key Tables)

```mermaid
erDiagram
    users ||--o{ workspaces : owns
    workspaces ||--o| style_settings : has
    workspaces ||--o{ claude_sessions : contains
    workspaces ||--o{ posts : contains
    workspaces ||--o{ series : contains
    workspaces ||--o{ collections : contains
    workspaces ||--o{ content_triggers : contains
    workspaces ||--o{ api_keys : contains
    workspaces ||--o{ scheduled_publications : contains
    workspaces ||--o{ social_analytics_snapshots : contains

    claude_sessions ||--o{ insights : yields
    insights ||--o{ posts : generates

    posts ||--o{ post_revisions : tracks
    posts ||--o{ post_evidence : cites
    posts ||--o{ post_media : contains
    posts ||--o{ seo_metadata : has

    series ||--o{ series_posts : contains
    collections ||--o{ collection_posts : contains
```

### Post Status Enum

`draft` | `published` | `archived` | `idea` | `in_review` | `scheduled`

### Insight Categories

`novel_problem_solving` | `tool_pattern_discovery` | `before_after_transformation` | `failure_recovery` | `architecture_decision` | `performance_optimization`

---

## API Routes

100+ Route Handlers under `apps/dashboard/src/app/api/`.

### Core Routes

| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/sessions` | List / scan sessions |
| GET | `/api/sessions/[id]` | Session detail |
| GET | `/api/sessions/[id]/messages` | Raw transcript |
| GET/POST | `/api/insights` | List / extract insights |
| GET/POST/PUT/DELETE | `/api/content` | Content CRUD |
| POST | `/api/agents/blog` | Blog generation (SSE) |
| POST | `/api/agents/social` | Social content (SSE) |
| POST | `/api/agents/changelog` | Changelog (SSE) |
| POST | `/api/agents/chat` | Editor chat (SSE) |

### Scheduling & Automation

| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/schedule` | Publish queue management |
| GET/POST | `/api/automation/triggers` | Trigger CRUD |
| POST | `/api/automation/execute` | QStash webhook endpoint |
| GET | `/api/content/streak` | Publishing streak data |

### Integrations

| Method | Path | Description |
|---|---|---|
| GET/POST/DELETE | `/api/integrations/hashnode` | Hashnode PAT |
| GET/POST/DELETE | `/api/integrations/devto` | Dev.to API key |
| GET/POST/DELETE | `/api/integrations/medium` | Medium token |
| GET/POST/DELETE | `/api/integrations/ghost` | Ghost Admin API |
| GET/DELETE | `/api/integrations/github` | GitHub OAuth |
| GET/DELETE | `/api/integrations/twitter` | Twitter OAuth |
| GET/DELETE | `/api/integrations/linkedin` | LinkedIn OAuth |
| GET | `/api/integrations/*/oauth` | OAuth initiation |
| GET | `/api/integrations/*/callback` | OAuth callback |

### Analytics & Content Intelligence

| Method | Path | Description |
|---|---|---|
| GET | `/api/analytics` | Social engagement metrics |
| GET/POST | `/api/series` | Series CRUD |
| GET/POST | `/api/collections` | Collections CRUD |
| GET/POST | `/api/recommendations` | AI recommendations |
| GET | `/api/feed/[slug].xml` | RSS 2.0 feed |
| GET | `/api/feed/[slug].atom` | Atom feed |

---

## Integration Architecture

```mermaid
flowchart LR
    subgraph TokenAuth["Token-Based"]
        H[Hashnode\nPAT]
        D[Dev.to\nAPI Key]
        M[Medium\nIntegration Token]
        Gh[Ghost\nAdmin API Key]
        WP[WordPress\nApp Password]
    end

    subgraph OAuthFlow["OAuth 2.0"]
        GH[GitHub]
        TW[Twitter / X\nPKCE Flow]
        LI[LinkedIn]
    end

    SF[SessionForge] --> TokenAuth
    SF --> OAuthFlow

    TokenAuth --> Pub[Publish Content]
    OAuthFlow --> Sync[Sync Analytics\n+ Publish]
```

**Token-based integrations** store credentials in per-workspace integration tables. Users paste tokens directly in Settings > Integrations.

**OAuth integrations** use redirect-based flows. Twitter uses PKCE; LinkedIn uses standard OAuth 2.0. Tokens are stored after callback and used for analytics sync and publishing.

---

## Key Design Decisions

### 1. CLI-Inherited AI Auth (Zero API Keys)
All AI features use `@anthropic-ai/claude-agent-sdk` which spawns the `claude` CLI subprocess. Authentication comes from the logged-in user's CLI session -- no `ANTHROPIC_API_KEY` environment variable needed. This simplifies deployment and eliminates key management.

### 2. Local JSONL over Webhook Integrations
SessionForge reads directly from `~/.claude/projects/` rather than integrating with external services for data ingestion. Self-contained, no API keys for data intake, content grounded in actual work.

### 3. Agentic Loop over Single-Shot Prompts
Multi-turn tool-use loops let agents fetch exactly the data they need and iterate, producing higher-quality output without context limit issues.

### 4. Tool Registry Pattern
Centralized tool access control per agent. Adding a new agent or tool requires only a registry entry. Enforces least-privilege (e.g., `editor-chat` cannot read sessions directly).

### 5. SSE Streaming for Content Agents
Real-time rendering of tool-use activity and partial content in the editor. Background jobs (insight extraction) use plain JSON responses.

### 6. Composite Scoring for Insight Ranking
6-dimension weighted scoring ensures technically novel, reproducible sessions surface at the top, regardless of recency.

### 7. Idempotent Scan Pipeline
Upsert with `(workspaceId, sessionId)` conflict key. Re-scanning is always safe.

### 8. Workspace-Scoped Everything
Every table scoped to `workspaceId`. Multiple workspaces per user for separating projects.

### 9. 7-Platform Integration Strategy
Token-based for simple platforms (paste and go), OAuth for platforms requiring user authorization (Twitter, LinkedIn, GitHub). Each platform has its own DB table for credentials and configuration.
