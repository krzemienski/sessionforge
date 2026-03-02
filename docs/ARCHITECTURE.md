# SessionForge Architecture

**Version:** 2.0.0
**Updated:** 2026-03-01

---

## Table of Contents

1. [Monorepo Structure](#monorepo-structure)
2. [Tech Stack](#tech-stack)
3. [Session Scanning Pipeline](#session-scanning-pipeline)
4. [AI Agent Pipeline](#ai-agent-pipeline)
5. [Database Schema](#database-schema)
6. [API Routes](#api-routes)
7. [Key Design Decisions](#key-design-decisions)

---

## Monorepo Structure

The project is a Turborepo monorepo managed with Bun. All application code lives in `apps/`, shared packages in `packages/`.

```
sessionforge/
├── turbo.json                          # Turborepo pipeline config
├── package.json                        # Workspace root
├── .env.example                        # Environment variable template
├── CLAUDE.md                           # Claude Code instructions
│
├── apps/
│   └── dashboard/                      # Next.js 15 application (App Router)
│       └── src/
│           ├── app/
│           │   ├── (auth)/             # Login / signup pages
│           │   ├── (dashboard)/        # Workspace-scoped pages
│           │   │   └── [workspace]/
│           │   │       ├── sessions/   # Session browser + detail
│           │   │       ├── insights/   # Ranked insight list + detail
│           │   │       ├── content/    # Content library + editor
│           │   │       ├── automation/ # Trigger management
│           │   │       └── settings/   # Workspace / style / API keys
│           │   └── api/                # Next.js Route Handlers (REST)
│           │       ├── sessions/       # Scan, list, detail, messages
│           │       ├── insights/       # Extract, list, detail
│           │       ├── content/        # CRUD
│           │       ├── agents/         # Streaming SSE endpoints
│           │       └── automation/     # Trigger CRUD + QStash webhook
│           ├── components/             # React components (ui, layout, domain)
│           └── lib/
│               ├── sessions/           # Scanner → Parser → Normalizer → Indexer
│               └── ai/
│                   ├── agents/         # 5 AI agent implementations
│                   ├── orchestration/  # Tool registry, model selector, SSE streaming
│                   ├── prompts/        # System prompts per agent / tone
│                   └── tools/          # MCP-style tool handlers
│
└── packages/
    └── db/                             # Shared Drizzle ORM schema + client
        └── src/
            ├── schema.ts               # All table definitions and relations
            └── index.ts                # Re-exports
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
| AI SDK | `@anthropic-ai/sdk` (TypeScript) |
| AI Models | `claude-opus-4-5` (complex generation), `claude-haiku-4-5` (routing/classification) |
| Deployment | Vercel (frontend + serverless API routes) |
| Package Manager | Bun + Turborepo |

---

## Session Scanning Pipeline

The pipeline is the core data ingestion path. It converts raw JSONL files from `~/.claude/` into structured database records.

```
Developer's filesystem
~/.claude/projects/<encoded-path>/sessions/<session-id>.jsonl
~/.claude/sessions/<session-id>.jsonl
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Stage 1: Scanner  (lib/sessions/scanner.ts)                │
│                                                             │
│  • Resolves basePath (default: ~/.claude)                   │
│  • Reads ~/.claude/projects/*/sessions/*.jsonl              │
│  • Reads ~/.claude/sessions/*.jsonl (global sessions)       │
│  • Decodes project path: "-Users-nick-app" → "/Users/nick/app" │
│  • Filters by lookbackDays (default: 30)                    │
│  • Returns: SessionFileMeta[]                               │
│    { filePath, sessionId, projectPath, mtime }              │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Stage 2: Parser  (lib/sessions/parser.ts)                  │
│                                                             │
│  • Streams JSONL line-by-line via readline                  │
│  • Extracts per-message: role, content, tool usage          │
│  • Aggregates: toolsUsed[], filesModified[], errors[]       │
│  • Tracks: startedAt, endedAt, costUsd, messageCount        │
│  • Returns: ParsedSession                                   │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Stage 3: Normalizer  (lib/sessions/normalizer.ts)          │
│                                                             │
│  • Combines SessionFileMeta + ParsedSession                 │
│  • Derives projectName from projectPath                     │
│  • Computes durationSeconds                                 │
│  • Returns: NormalizedSession (maps 1:1 to DB schema)       │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Stage 4: Indexer  (lib/sessions/indexer.ts)                │
│                                                             │
│  • Drizzle upsert into claude_sessions table                │
│  • Conflict key: (workspaceId, sessionId)                   │
│  • Idempotent — safe to re-scan the same files              │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
              PostgreSQL: claude_sessions table
```

**Trigger points:**
- **Manual:** POST `/api/sessions/scan` from the dashboard scan button
- **Scheduled:** Cron via Upstash QStash → POST `/api/automation/execute`
- **File watch:** Triggered by the automation trigger system (planned)

---

## AI Agent Pipeline

SessionForge has **5 AI agents**, all sharing the same agentic loop pattern. They differ in their tool access, system prompts, and output delivery.

### Agent Overview

| Agent | Route | Model | Output | Tools |
|---|---|---|---|---|
| `insight-extractor` | `POST /api/insights/extract` | Haiku | JSON result | session, insight |
| `blog-writer` | `POST /api/agents/blog` | Opus | SSE stream | session, insight, post, skill |
| `social-writer` | `POST /api/agents/social` | Opus | SSE stream | session, insight, post |
| `changelog-writer` | `POST /api/agents/changelog` | Haiku | SSE stream | session, post |
| `editor-chat` | `POST /api/agents/chat` | Opus | SSE stream | post, markdown |

### Agentic Loop Pattern

All agents implement the same while-loop pattern over the Anthropic Messages API:

```
Input (workspaceId, insightId/sessionId, tone, ...)
  │
  ▼
Build initial messages array
  │
  ▼
┌─────────────────────────────────────────────────────────────┐
│  client.messages.create({ model, tools, messages })         │
│                                                             │
│  while (response.stop_reason === "tool_use") {              │
│    toolUseBlocks = response.content.filter(tool_use)        │
│                                                             │
│    for each toolUse:                                        │
│      → dispatchTool(workspaceId, name, input)               │
│      → SSE: send("tool_use", { tool, input })               │  ← streaming agents only
│      → SSE: send("tool_result", { tool, success })          │  ← streaming agents only
│                                                             │
│    append assistant turn + tool_result turn                 │
│    response = client.messages.create(...)                   │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
  │
  ▼
Streaming agents: SSE send("text", content) for each text block
Non-streaming:   return { result: text, usage }
  │
  ▼
SSE: send("complete", { usage })  /  return result object
```

### Tool Registry

`lib/ai/orchestration/tool-registry.ts` controls which tools each agent can access:

```typescript
const AGENT_TOOL_SETS = {
  "insight-extractor": ["session", "insight"],
  "blog-writer":       ["session", "insight", "post", "skill"],
  "social-writer":     ["session", "insight", "post"],
  "changelog-writer":  ["session", "post"],
  "editor-chat":       ["post", "markdown"],
};
```

### Tool Handlers

| Tool Set | File | Tools Exposed |
|---|---|---|
| `session` | `tools/session-reader.ts` | `get_session_summary`, `get_session_messages`, `list_sessions_by_timeframe` |
| `insight` | `tools/insight-tools.ts` | `get_insight_details`, `get_top_insights`, `create_insight` |
| `post` | `tools/post-manager.ts` | `create_post`, `update_post`, `get_post`, `get_markdown` |
| `markdown` | `tools/markdown-editor.ts` | `edit_markdown`, `insert_section`, `replace_section` |
| `skill` | `tools/skill-loader.ts` | `list_available_skills`, `get_skill_by_name` |

### Model Selection

`lib/ai/orchestration/model-selector.ts` routes agents to the right model:

- **claude-opus-4-5** — complex generation tasks: `blog-writer`, `social-writer`, `editor-chat`
- **claude-haiku-4-5** — fast classification/extraction: `insight-extractor`, `changelog-writer`

### SSE Streaming

Content-generating agents return a `Response` with `Content-Type: text/event-stream`. The stream emits typed events:

```
event: status       { phase, message }
event: tool_use     { tool, input }
event: tool_result  { tool, success, error? }
event: text         { content }
event: complete     { usage }
event: error        { message }
```

`lib/ai/orchestration/streaming.ts` provides `createSSEStream()` → `{ stream, send, close }` and `sseResponse(stream)`.

---

## Database Schema

All tables are PostgreSQL via Drizzle ORM. The schema lives in `packages/db/src/schema.ts`.

### Entity Relationship Overview

```
users
  │
  └─< workspaces (ownerId)
        │
        ├─ styleSettings (1:1)
        │
        ├─< claude_sessions
        │       │
        │       └─< insights
        │               │
        │               └─< posts
        │
        ├─< posts (workspace-scoped)
        ├─< content_triggers
        └─< api_keys
```

### Core Tables

#### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `name` | text | |
| `email` | text | unique |
| `emailVerified` | boolean | |
| `image` | text | avatar URL |

#### `workspaces`
| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `name` | text | display name |
| `slug` | text | unique URL slug |
| `ownerId` | text | FK → users |
| `sessionBasePath` | text | default: `~/.claude` |

#### `claude_sessions`
Central table — one row per scanned JSONL file.

| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `workspaceId` | text | FK → workspaces |
| `sessionId` | text | original JSONL filename (no ext) |
| `projectPath` | text | decoded filesystem path |
| `projectName` | text | derived from projectPath |
| `filePath` | text | absolute path to JSONL file |
| `messageCount` | integer | |
| `toolsUsed` | jsonb `string[]` | all tool names invoked |
| `filesModified` | jsonb `string[]` | files touched in session |
| `errorsEncountered` | jsonb `string[]` | error messages |
| `summary` | text | AI-generated summary (nullable) |
| `startedAt` / `endedAt` | timestamp | session time bounds |
| `durationSeconds` | integer | |
| `costUsd` | real | total Anthropic cost |

Unique index: `(workspaceId, sessionId)` — enables safe re-scanning.

#### `insights`
Scored content opportunities extracted from sessions.

| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `workspaceId` | text | FK → workspaces |
| `sessionId` | text | FK → claude_sessions |
| `category` | enum | `novel_problem_solving`, `tool_pattern_discovery`, `before_after_transformation`, `failure_recovery`, `architecture_decision`, `performance_optimization` |
| `title` | text | |
| `description` | text | |
| `codeSnippets` | jsonb | `{ language, code, context }[]` |
| `terminalOutput` | jsonb | `string[]` |
| `compositeScore` | real | weighted aggregate (0–1) |
| `noveltyScore` | real | dimension score |
| `toolPatternScore` | real | dimension score |
| `transformationScore` | real | dimension score |
| `failureRecoveryScore` | real | dimension score |
| `reproducibilityScore` | real | dimension score |
| `scaleScore` | real | dimension score |
| `usedInContent` | boolean | flagged after post generation |

#### `posts`
Generated content pieces, any format.

| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `workspaceId` | text | FK → workspaces |
| `title` | text | |
| `content` | text | raw markdown |
| `markdown` | text | formatted markdown |
| `contentType` | enum | `blog_post`, `twitter_thread`, `linkedin_post`, `devto_post`, `changelog`, `newsletter`, `custom` |
| `status` | enum | `draft`, `published`, `archived` |
| `insightId` | text | FK → insights (nullable) |
| `sourceMetadata` | jsonb | triggerId, sessionIds, insightIds, generatedBy |
| `toneUsed` | enum | `technical`, `tutorial`, `conversational`, `professional`, `casual` |
| `wordCount` | integer | |

#### `content_triggers`
Automation rules for scheduled content generation.

| Column | Type | Notes |
|---|---|---|
| `id` | text (UUID) | PK |
| `workspaceId` | text | FK → workspaces |
| `name` | text | display name |
| `triggerType` | enum | `manual`, `scheduled`, `file_watch` |
| `contentType` | enum | target content format |
| `lookbackWindow` | enum | `current_day`, `yesterday`, `last_7_days`, `last_14_days`, `last_30_days`, `custom` |
| `cronExpression` | text | for scheduled triggers |
| `enabled` | boolean | |
| `lastRunAt` | timestamp | |
| `lastRunStatus` | text | |

#### `style_settings`
Per-workspace writing style configuration (1:1 with workspace).

| Column | Type | Notes |
|---|---|---|
| `workspaceId` | text | unique FK → workspaces |
| `defaultTone` | enum | default tone profile |
| `targetAudience` | text | e.g. "senior engineers" |
| `customInstructions` | text | free-form prompt additions |
| `includeCodeSnippets` | boolean | |
| `includeTerminalOutput` | boolean | |
| `maxBlogWordCount` | integer | default: 2500 |

### Auth Tables (better-auth managed)

- `auth_sessions` — active login sessions with token, userId, activeWorkspaceId
- `accounts` — OAuth provider links (GitHub)
- `verifications` — email verification tokens

---

## API Routes

All routes are Next.js App Router Route Handlers under `apps/dashboard/src/app/api/`.

### Session Routes
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/sessions` | List sessions for workspace |
| `POST` | `/api/sessions/scan` | Trigger JSONL scan pipeline |
| `GET` | `/api/sessions/[id]` | Get session detail |
| `GET` | `/api/sessions/[id]/messages` | Get raw message transcript |

### Insight Routes
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/insights` | List insights (ranked by compositeScore) |
| `POST` | `/api/insights/extract` | Run insight-extractor agent |
| `GET` | `/api/insights/[id]` | Get insight detail |

### Content Routes
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/content` | List posts |
| `POST` | `/api/content` | Create post (manual) |
| `GET` | `/api/content/[id]` | Get post |
| `PUT` | `/api/content/[id]` | Update post |
| `DELETE` | `/api/content/[id]` | Delete post |

### Agent Routes (SSE Streaming)
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/agents/blog` | Stream blog post generation |
| `POST` | `/api/agents/social` | Stream social content generation |
| `POST` | `/api/agents/changelog` | Stream changelog generation |
| `POST` | `/api/agents/chat` | Stream editor chat revisions |

### Automation Routes
| Method | Path | Description |
|---|---|---|
| `GET/POST` | `/api/automation/triggers` | List / create triggers |
| `GET/PUT/DELETE` | `/api/automation/triggers/[id]` | Manage trigger |
| `POST` | `/api/automation/execute` | QStash webhook — execute trigger |

---

## Key Design Decisions

### 1. Local JSONL over Webhook Integrations
SessionForge reads directly from `~/.claude/projects/` rather than integrating with GitHub/Linear/Slack. This keeps the system self-contained, requires no API keys for data ingestion, and ensures content is grounded in the developer's actual work.

### 2. Agentic Loop over Single-Shot Prompts
All content generation uses multi-turn tool-use loops rather than stuffing all context into one prompt. This lets agents fetch exactly the data they need (session messages, insights, existing posts) and iterate, producing higher-quality output without hitting context limits.

### 3. Tool Registry Pattern
`tool-registry.ts` centralises which tools each agent can access. Adding a new agent or tool set requires only a registry entry — no changes to individual agent files. This enforces least-privilege access (e.g., `editor-chat` cannot read session data directly).

### 4. SSE Streaming for Content Agents
Content generation agents return `text/event-stream` responses so the dashboard UI can render tool-use activity and partial content in real time. The `insight-extractor` returns a plain JSON result because it runs as a background job, not a user-facing interactive operation.

### 5. Composite Scoring for Insight Ranking
Insights are ranked by a 6-dimension weighted `compositeScore` rather than recency or manual curation. This ensures the most technically novel and reproducible sessions surface at the top of the content queue regardless of when they occurred.

### 6. Idempotent Scan Pipeline
The indexer uses an upsert with `(workspaceId, sessionId)` as the conflict key. Re-running a scan is always safe — it updates existing records rather than creating duplicates.

### 7. Workspace-Scoped Everything
Every table (sessions, insights, posts, triggers, API keys, style settings) is scoped to a `workspaceId`. A single user can have multiple workspaces mapping to different `sessionBasePath` values — useful for separating work and personal projects.
