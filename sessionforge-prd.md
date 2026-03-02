# SessionForge — Product Requirements Document

**Version:** 2.0.0
**Date:** 2026-03-01
**Status:** Final
**Author:** Nick (Engineering Lead, Video Innovations)

---

## 1. Product Vision

SessionForge transforms Claude Code session history into publication-ready technical content. It ingests JSONL session files from the developer's local filesystem (`~/.claude/projects/`), analyzes workflows through a 6-dimension weighted scoring algorithm, and orchestrates multi-agent content pipelines to produce deeply technical blog posts, social media campaigns, changelogs, and newsletters — all sourced from real coding sessions with real code snippets.

SessionForge is modeled after Notra (https://github.com/usenotra/notra) but replaces all external integrations (GitHub, Linear, Slack) with Claude Code session file analysis. Where Notra listens to webhooks, SessionForge scans JSONL. Where Notra reads PRs and commits, SessionForge reads tool invocations, file modifications, error recoveries, and multi-turn problem-solving chains.

### 1.1 Notra Feature Parity Map

| Notra Feature | SessionForge Equivalent | Delta |
|---|---|---|
| GitHub/Linear/Slack integrations | Claude Code session scanner (local JSONL) | Local filesystem instead of webhooks |
| Webhook event triggers | File watcher + manual scan + cron triggers | Same trigger types, different source |
| Content triggers with lookback windows | Session lookback windows (1d, 7d, 14d, 30d, custom) | Identical concept |
| AI changelog agent (ToolLoopAgent) | Session Insight Extractor (Claude Agent SDK `query()`) | SDK upgrade from base Anthropic SDK |
| AI LinkedIn/blog agents | Blog Writer, Social Writer, Changelog Writer agents | Expanded content types |
| Brand voice/tone settings per org | Writing style profiles per workspace | Same concept, workspace-scoped |
| Content editor (Lexical) | Markdown editor (Lexical) with live preview | Same editor library |
| AI chat sidebar for editing | AI revision sidebar with Agent SDK streaming | Streaming upgrade |
| Scheduled content generation | Cron-based scanning + auto-draft via QStash | Same scheduling, different queue |
| Organization model | Workspace model (maps to Claude project paths) | Flatter hierarchy |
| API keys management | API key management for external publishing | Same |
| Supermemory context | Session context from JSONL transcript | Local instead of external API |

### 1.2 Target User

Solo developer or small-team engineering lead who:
- Uses Claude Code daily for development work
- Wants to build a technical personal brand from real work
- Values authenticity — content from actual sessions, not fabricated examples
- Has `~/.claude/projects/` populated with session history
- Comfortable with self-hosted or Vercel-deployed tooling

---

## 2. Tech Stack

```
Frontend:     Next.js 15 (App Router) + React 19 + Tailwind CSS 4
UI Library:   shadcn/ui + custom flat-black design tokens
Editor:       Lexical (rich text with markdown import/export)
State:        TanStack Query v5 (server state) + Zustand (client state)
Auth:         better-auth (email + GitHub OAuth)
Database:     PostgreSQL via Drizzle ORM (Neon serverless)
Queue:        Upstash QStash (scheduled job execution)
Cache:        Upstash Redis (scan results, rate limits)
AI SDK:       @anthropic-ai/claude-agent-sdk (TypeScript)
AI Models:    claude-opus-4-5-20250514 (complex generation)
              claude-haiku-4-5-20251001 (routing, classification)
Deployment:   Vercel (frontend + serverless API routes)
Monorepo:     Turborepo with bun
```

---

## 3. Information Architecture

### 3.1 Monorepo File Structure

```
sessionforge/
├── turbo.json
├── package.json
├── .env.example
├── CLAUDE.md
├── apps/
│   └── dashboard/                          # Next.js 15 application
│       ├── package.json
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       ├── public/
│       │   ├── fonts/
│       │   │   ├── JetBrainsMono-Variable.woff2
│       │   │   ├── Inter-Variable.woff2
│       │   │   └── FiraCode-Variable.woff2
│       │   └── logo.svg
│       └── src/
│           ├── app/
│           │   ├── globals.css             # Theme tokens + base styles
│           │   ├── layout.tsx              # Root layout (fonts, providers)
│           │   ├── (auth)/
│           │   │   ├── layout.tsx          # Auth layout (centered, dark)
│           │   │   ├── login/page.tsx
│           │   │   └── signup/page.tsx
│           │   ├── (dashboard)/
│           │   │   ├── layout.tsx          # Dashboard layout (sidebar + main)
│           │   │   └── [workspace]/
│           │   │       ├── page.tsx                    # Dashboard home
│           │   │       ├── sessions/
│           │   │       │   ├── page.tsx                # Session browser
│           │   │       │   └── [sessionId]/page.tsx    # Session detail
│           │   │       ├── insights/
│           │   │       │   ├── page.tsx                # Insights ranked list
│           │   │       │   └── [insightId]/page.tsx    # Insight detail
│           │   │       ├── content/
│           │   │       │   ├── page.tsx                # Content library
│           │   │       │   └── [postId]/page.tsx       # Content editor
│           │   │       ├── automation/page.tsx          # Trigger management
│           │   │       └── settings/
│           │   │           ├── page.tsx                # General settings
│           │   │           ├── style/page.tsx          # Writing style
│           │   │           └── api-keys/page.tsx       # API keys
│           │   └── api/
│           │       ├── auth/[...all]/route.ts          # better-auth handler
│           │       ├── healthcheck/route.ts
│           │       ├── workspace/route.ts              # GET, POST
│           │       ├── workspace/[slug]/
│           │       │   ├── route.ts                    # GET, PUT
│           │       │   └── style/route.ts              # GET, PUT
│           │       ├── sessions/
│           │       │   ├── scan/route.ts               # POST
│           │       │   ├── route.ts                    # GET (list)
│           │       │   └── [id]/
│           │       │       ├── route.ts                # GET (detail)
│           │       │       └── messages/route.ts       # GET (raw messages)
│           │       ├── insights/
│           │       │   ├── extract/route.ts            # POST
│           │       │   ├── route.ts                    # GET (list)
│           │       │   └── [id]/route.ts               # GET (detail)
│           │       ├── content/
│           │       │   ├── route.ts                    # GET (list), POST
│           │       │   └── [id]/route.ts               # GET, PUT, DELETE
│           │       ├── agents/
│           │       │   ├── blog/route.ts               # POST (streaming)
│           │       │   ├── social/route.ts             # POST (streaming)
│           │       │   ├── changelog/route.ts          # POST (streaming)
│           │       │   └── chat/route.ts               # POST (streaming)
│           │       ├── automation/
│           │       │   ├── triggers/route.ts           # GET, POST
│           │       │   ├── triggers/[id]/route.ts      # GET, PUT, DELETE
│           │       │   └── execute/route.ts            # POST (QStash webhook)
│           │       └── api-keys/
│           │           ├── route.ts                    # GET, POST
│           │           └── [id]/route.ts               # DELETE
│           ├── components/
│           │   ├── ui/                     # shadcn/ui components
│           │   ├── layout/
│           │   │   ├── app-sidebar.tsx
│           │   │   ├── mobile-bottom-nav.tsx
│           │   │   ├── workspace-selector.tsx
│           │   │   └── user-menu.tsx
│           │   ├── dashboard/
│           │   │   ├── stat-card.tsx
│           │   │   ├── activity-feed.tsx
│           │   │   └── quick-actions.tsx
│           │   ├── sessions/
│           │   │   ├── session-card.tsx
│           │   │   ├── session-list.tsx
│           │   │   ├── session-detail.tsx
│           │   │   ├── message-timeline.tsx
│           │   │   └── scan-button.tsx
│           │   ├── insights/
│           │   │   ├── insight-card.tsx
│           │   │   ├── insight-list.tsx
│           │   │   ├── insight-detail.tsx
│           │   │   ├── score-badge.tsx
│           │   │   └── dimension-chart.tsx
│           │   ├── content/
│           │   │   ├── content-card.tsx
│           │   │   ├── content-list.tsx
│           │   │   ├── content-editor.tsx
│           │   │   ├── ai-chat-sidebar.tsx
│           │   │   ├── content-type-badge.tsx
│           │   │   └── publish-button.tsx
│           │   └── automation/
│           │       ├── trigger-card.tsx
│           │       ├── trigger-form.tsx
│           │       └── cron-input.tsx
│           ├── lib/
│           │   ├── auth.ts                 # better-auth client config
│           │   ├── db.ts                   # Drizzle client
│           │   ├── redis.ts                # Upstash Redis client
│           │   ├── qstash.ts              # Upstash QStash client
│           │   ├── utils.ts               # cn(), formatDate(), etc.
│           │   ├── sessions/
│           │   │   ├── scanner.ts          # JSONL file discovery
│           │   │   ├── parser.ts           # JSONL line-by-line parsing
│           │   │   ├── normalizer.ts       # Map parsed data to DB schema
│           │   │   └── indexer.ts          # Upsert to PostgreSQL
│           │   └── ai/
│           │       ├── orchestration/
│           │       │   ├── tool-registry.ts    # Compose MCP tool servers
│           │       │   ├── model-selector.ts   # Opus vs Haiku routing
│           │       │   └── streaming.ts        # SSE response helpers
│           │       ├── tools/
│           │       │   ├── session-reader.ts   # MCP: get_session_messages, etc.
│           │       │   ├── insight-tools.ts    # MCP: get_insight_details, etc.
│           │       │   ├── post-manager.ts     # MCP: create_post, update_post, etc.
│           │       │   ├── markdown-editor.ts  # MCP: edit_markdown operations
│           │       │   └── skill-loader.ts     # MCP: list/get writing skills
│           │       ├── agents/
│           │       │   ├── insight-extractor.ts
│           │       │   ├── blog-writer.ts
│           │       │   ├── social-writer.ts
│           │       │   ├── changelog-writer.ts
│           │       │   └── editor-chat.ts
│           │       └── prompts/
│           │           ├── insight-extraction.ts
│           │           ├── blog/
│           │           │   ├── technical.ts
│           │           │   ├── tutorial.ts
│           │           │   └── conversational.ts
│           │           ├── social/
│           │           │   ├── twitter-thread.ts
│           │           │   └── linkedin-post.ts
│           │           ├── changelog.ts
│           │           └── editor-assistant.ts
│           ├── hooks/
│           │   ├── use-sessions.ts
│           │   ├── use-insights.ts
│           │   ├── use-content.ts
│           │   ├── use-workspace.ts
│           │   └── use-streaming.ts
│           └── types/
│               ├── sessions.ts
│               ├── insights.ts
│               ├── content.ts
│               └── ai.ts
└── packages/
    ├── db/
    │   ├── package.json
    │   ├── drizzle.config.ts
    │   ├── src/
    │   │   ├── schema.ts          # All tables, enums, relations
    │   │   ├── index.ts           # Re-exports
    │   │   └── migrate.ts         # Migration runner
    │   └── migrations/            # Generated by drizzle-kit
    └── tsconfig/
        ├── base.json
        ├── nextjs.json
        └── library.json
```

---

## 4. Database Schema

### 4.1 Enums

```typescript
lookbackWindowEnum: "current_day" | "yesterday" | "last_7_days" | "last_14_days" | "last_30_days" | "custom"
postStatusEnum: "draft" | "published" | "archived"
contentTypeEnum: "blog_post" | "twitter_thread" | "linkedin_post" | "devto_post" | "changelog" | "newsletter" | "custom"
insightCategoryEnum: "novel_problem_solving" | "tool_pattern_discovery" | "before_after_transformation" | "failure_recovery" | "architecture_decision" | "performance_optimization"
toneProfileEnum: "technical" | "tutorial" | "conversational" | "professional" | "casual"
triggerTypeEnum: "manual" | "scheduled" | "file_watch"
```

### 4.2 Tables

#### `users`
| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | text | PK | UUID, generated |
| name | text | NOT NULL | Display name |
| email | text | NOT NULL, UNIQUE | Login email |
| email_verified | boolean | DEFAULT false | Email verification status |
| image | text | NULLABLE | Avatar URL |
| created_at | timestamp | DEFAULT now() | Account creation |
| updated_at | timestamp | DEFAULT now(), auto-update | Last modification |

#### `auth_sessions`
| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | text | PK | Session ID |
| expires_at | timestamp | NOT NULL | Session expiry |
| token | text | NOT NULL, UNIQUE | Bearer token |
| user_id | text | FK → users.id, CASCADE | Session owner |
| active_workspace_id | text | NULLABLE | Currently selected workspace |
| created_at | timestamp | DEFAULT now() | — |
| updated_at | timestamp | auto-update | — |

**Indexes:** `auth_sessions_userId_idx` on user_id

#### `accounts`
| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | text | PK | Account ID |
| account_id | text | NOT NULL | Provider's user ID |
| provider_id | text | NOT NULL | "email", "github" |
| user_id | text | FK → users.id, CASCADE | Owner |
| access_token | text | NULLABLE | OAuth token |
| refresh_token | text | NULLABLE | OAuth refresh |
| created_at | timestamp | DEFAULT now() | — |
| updated_at | timestamp | auto-update | — |

**Indexes:** `accounts_userId_idx` on user_id

#### `workspaces`
| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | text | PK | UUID |
| name | text | NOT NULL | Display name (e.g. "My Projects") |
| slug | text | NOT NULL, UNIQUE | URL slug (e.g. "my-projects") |
| owner_id | text | FK → users.id, CASCADE | Workspace owner |
| session_base_path | text | DEFAULT "~/.claude" | Where to scan for sessions |
| created_at | timestamp | DEFAULT now() | — |
| updated_at | timestamp | DEFAULT now(), auto-update | — |

**Indexes:** `workspaces_slug_uidx` UNIQUE on slug

#### `style_settings`
| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | text | PK | UUID |
| workspace_id | text | FK → workspaces.id, CASCADE | Parent workspace |
| default_tone | tone_profile enum | DEFAULT "technical" | Default writing tone |
| target_audience | text | DEFAULT "senior engineers" | Who the content is for |
| custom_instructions | text | NULLABLE | Free-text style instructions for agents |
| include_code_snippets | boolean | DEFAULT true | Include code blocks in content |
| include_terminal_output | boolean | DEFAULT true | Include terminal output in content |
| max_blog_word_count | integer | DEFAULT 2500 | Target blog length |
| created_at | timestamp | DEFAULT now() | — |
| updated_at | timestamp | DEFAULT now(), auto-update | — |

**Indexes:** `styleSettings_workspaceId_uidx` UNIQUE on workspace_id

#### `claude_sessions`
| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | text | PK | UUID (generated by SessionForge) |
| workspace_id | text | FK → workspaces.id, CASCADE | Parent workspace |
| session_id | text | NOT NULL | Original Claude session UUID from filename |
| project_path | text | NOT NULL | Decoded project path (e.g. /Users/nick/projects/my-app) |
| project_name | text | NOT NULL | Derived from path basename |
| file_path | text | NOT NULL | Absolute path to .jsonl file on disk |
| message_count | integer | NOT NULL | Total human + assistant messages |
| tools_used | jsonb (string[]) | NULLABLE | Unique tool names used in session |
| files_modified | jsonb (string[]) | NULLABLE | File paths written/edited |
| errors_encountered | jsonb (string[]) | NULLABLE | Error messages from session |
| summary | text | NULLABLE | AI-generated session summary (set after extraction) |
| started_at | timestamp | NOT NULL | First message timestamp |
| ended_at | timestamp | NULLABLE | Last message timestamp |
| duration_seconds | integer | NULLABLE | Computed: ended_at - started_at |
| cost_usd | real | NULLABLE | Cumulative API cost from session metadata |
| raw_metadata | jsonb | NULLABLE | Any additional parsed metadata |
| scanned_at | timestamp | DEFAULT now() | When SessionForge ingested this session |

**Indexes:**
- `sessions_workspaceId_idx` on workspace_id
- `sessions_startedAt_idx` on started_at
- `sessions_workspace_sessionId_uidx` UNIQUE on (workspace_id, session_id)

#### `insights`
| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | text | PK | UUID |
| workspace_id | text | FK → workspaces.id, CASCADE | Parent workspace |
| session_id | text | FK → claude_sessions.id, NULLABLE | Source session |
| category | insight_category enum | NOT NULL | Classification of insight type |
| title | text | NOT NULL | One-line headline (content-ready) |
| description | text | NOT NULL | 2-3 paragraph insight description |
| code_snippets | jsonb | NULLABLE | `[{ language, code, context }]` |
| terminal_output | jsonb (string[]) | NULLABLE | Relevant terminal output lines |
| composite_score | real | NOT NULL | Weighted score (0–65 scale, see §6.2) |
| novelty_score | real | DEFAULT 0 | Novel problem-solving (1–5) |
| tool_pattern_score | real | DEFAULT 0 | Tool/pattern discovery (1–5) |
| transformation_score | real | DEFAULT 0 | Before/after transformation (1–5) |
| failure_recovery_score | real | DEFAULT 0 | Failure + recovery arc (1–5) |
| reproducibility_score | real | DEFAULT 0 | Reproducibility by others (1–5) |
| scale_score | real | DEFAULT 0 | Quantifiable metrics (1–5) |
| used_in_content | boolean | DEFAULT false | Whether this insight has been used to generate content |
| created_at | timestamp | DEFAULT now() | — |

**Indexes:**
- `insights_workspaceId_idx` on workspace_id
- `insights_compositeScore_idx` on composite_score

#### `posts`
| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | text | PK | UUID |
| workspace_id | text | FK → workspaces.id, CASCADE | Parent workspace |
| title | text | NOT NULL | Post title |
| content | text | NOT NULL | Rendered HTML |
| markdown | text | NOT NULL | Raw markdown source |
| content_type | content_type enum | NOT NULL | blog_post, twitter_thread, etc. |
| status | post_status enum | DEFAULT "draft" | draft → published → archived |
| insight_id | text | FK → insights.id, NULLABLE | Source insight |
| source_metadata | jsonb | NULLABLE | `PostSourceMetadata` (see below) |
| tone_used | tone_profile enum | NULLABLE | Which tone was applied |
| word_count | integer | NULLABLE | Computed word count |
| created_at | timestamp | DEFAULT now() | — |
| updated_at | timestamp | DEFAULT now(), auto-update | — |

**PostSourceMetadata type:**
```typescript
{
  triggerId?: string;       // If generated by automation
  sessionIds: string[];     // Source sessions
  insightIds: string[];     // Source insights
  lookbackWindow?: string;  // Window used for generation
  generatedBy: "blog_writer" | "social_writer" | "changelog_writer" | "editor_chat" | "manual";
}
```

**Indexes:** `posts_workspaceId_createdAt_idx` on (workspace_id, created_at)

#### `content_triggers`
| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | text | PK | UUID |
| workspace_id | text | FK → workspaces.id, CASCADE | Parent workspace |
| name | text | NOT NULL, DEFAULT "Untitled Schedule" | Display name |
| trigger_type | trigger_type enum | NOT NULL | manual, scheduled, file_watch |
| content_type | content_type enum | NOT NULL | What content type to generate |
| lookback_window | lookback_window enum | DEFAULT "last_7_days" | How far back to scan |
| cron_expression | text | NULLABLE | Cron string for scheduled triggers |
| enabled | boolean | DEFAULT true | Whether trigger is active |
| last_run_at | timestamp | NULLABLE | Last execution time |
| last_run_status | text | NULLABLE | "success", "failed", error message |
| created_at | timestamp | DEFAULT now() | — |
| updated_at | timestamp | DEFAULT now(), auto-update | — |

**Indexes:** `triggers_workspaceId_idx` on workspace_id

#### `api_keys`
| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | text | PK | UUID |
| workspace_id | text | FK → workspaces.id, CASCADE | Parent workspace |
| name | text | NOT NULL | Display name (e.g. "Dev.to publishing") |
| key_hash | text | NOT NULL | SHA-256 hash of the key |
| key_prefix | text | NOT NULL | First 8 chars for display (e.g. "sf_live_8k") |
| last_used_at | timestamp | NULLABLE | Last API call with this key |
| created_at | timestamp | DEFAULT now() | — |

**Indexes:** `apiKeys_workspaceId_idx` on workspace_id

### 4.3 Relations

```
workspaces ─┬── 1:1 ──── style_settings
             ├── 1:many ── claude_sessions
             ├── 1:many ── insights
             ├── 1:many ── posts
             ├── 1:many ── content_triggers
             └── 1:many ── api_keys

claude_sessions ── 1:many ── insights
insights ── 1:many ── posts

users ── 1:many ── workspaces
users ── 1:many ── auth_sessions
users ── 1:many ── accounts
```

---

## 5. Session Ingestion Engine

### 5.1 JSONL File Discovery

Sessions are stored at these filesystem locations:

```
~/.claude/projects/*/sessions/*.jsonl     # Primary: per-project sessions
~/.claude/sessions/*.jsonl                # Global sessions
./.claude/sessions/*.jsonl                # Project-local sessions (less common)
```

The project directory name is an encoded path. Claude Code encodes `/Users/nick/projects/my-app` as `-Users-nick-projects-my-app`. The scanner must decode this to derive `projectPath` and `projectName`.

**Discovery algorithm:**
1. Resolve `session_base_path` from workspace settings (default `~/.claude`)
2. List all directories under `{basePath}/projects/`
3. For each project directory, list `sessions/*.jsonl`
4. Filter by `mtime >= now - lookbackDays * 86400000`
5. For each qualifying file: record `filePath`, decode `projectPath`, derive `projectName` from basename, capture `mtime` and `size`
6. Sort by `mtime` descending (most recent first)

### 5.2 JSONL Line Format

Each line in a `.jsonl` file is a complete JSON object. The format varies but follows these patterns:

**Human message:**
```json
{
  "type": "human",
  "message": { "content": "string or structured content array" },
  "timestamp": "2026-02-28T14:30:00.000Z"
}
```

**Assistant message:**
```json
{
  "type": "assistant",
  "message": {
    "content": [
      { "type": "text", "text": "response text" },
      { "type": "tool_use", "name": "Write", "input": { "file_path": "/path/to/file", "content": "..." } },
      { "type": "tool_use", "name": "Bash", "input": { "command": "npm run build" } }
    ]
  },
  "timestamp": "2026-02-28T14:30:05.000Z"
}
```

**Cost/metadata entry:**
```json
{
  "type": "summary",
  "costUSD": 0.0342,
  "inputTokens": 12500,
  "outputTokens": 3200
}
```

**Error entry:**
```json
{
  "type": "error",
  "message": "Connection timeout after 30000ms"
}
```

### 5.3 Parsing Rules

For each JSONL file, the parser processes line-by-line:

1. **Messages:** Extract `role` (human/assistant), `content` (flatten structured arrays to text), `timestamp`
2. **Tool usage:** From assistant message content arrays, extract `tool_use` blocks. Track unique tool names (`Write`, `Read`, `Bash`, `Grep`, `Glob`, `Edit`, `MultiEdit`, etc.)
3. **File modifications:** If tool is `Write`, `Edit`, or `MultiEdit`, extract `file_path` or `path` from input. Deduplicate.
4. **Errors:** Collect `type: "error"` entries
5. **Cost:** Sum all `costUSD` values across the file
6. **Timestamps:** First message `timestamp` = `started_at`. Last message `timestamp` = `ended_at`. Difference = `duration_seconds`.
7. **Malformed lines:** Skip silently (log to console in dev). Do NOT fail the entire file.
8. **Empty files:** Skip. Return 0 messages.

### 5.4 Session Quality Indicators

Used for pre-filtering before AI insight extraction:

| Indicator | High-Value Session | Low-Value Session |
|-----------|-------------------|-------------------|
| Message count | 10+ exchanges | < 5 exchanges |
| Tool invocations | Multiple distinct tools | None or single tool |
| Error → resolution | Error followed by success | Unresolved errors |
| File modifications | Creates/edits files | Read-only |
| Response length | Long assistant responses | Short responses |
| Duration | > 5 minutes | < 1 minute |

Sessions scoring as "low-value" are still indexed but deprioritized in the insights list.

### 5.5 Indexing (Upsert)

After parsing, each session is upserted to `claude_sessions` using the unique constraint on `(workspace_id, session_id)`. This means re-scanning the same session updates its record rather than duplicating it. The `scanned_at` timestamp is always set to `now()` on upsert.

---

## 6. Insight Extraction & Scoring

### 6.1 Extraction Process

Insight extraction is performed by the **Insight Extractor Agent** (see §8.2). The agent receives:
- The full session transcript (messages, tool usage, errors)
- The workspace's style settings for context
- The scoring rubric (6 dimensions with definitions)

The agent analyzes the session and produces 0–N insights, where each insight represents a discrete, content-worthy finding. A single session can yield multiple insights (e.g., a debugging story AND a tool discovery).

### 6.2 Scoring Dimensions

Each insight is scored on 6 dimensions (1–5 scale each) with weights:

| Dimension | Weight | Score 1 (Low) | Score 3 (Medium) | Score 5 (High) |
|-----------|--------|---------------|-------------------|-----------------|
| **Novel Problem-Solving** | 3× | Routine fix, well-documented solution | Creative approach to a known problem | Entirely new technique nobody has written about |
| **Tool/Pattern Discovery** | 3× | Standard tool usage | Clever combination of existing tools | Novel MCP usage, custom skill, or workflow pattern |
| **Before/After Transformation** | 2× | Minor improvement | Clear improvement with some metrics | Dramatic transformation with hard numbers |
| **Failure + Recovery** | 3× | No failure involved | Hit a snag, found a workaround | Spectacular failure, deep debugging, satisfying resolution |
| **Reproducibility** | 1× | Very project-specific | Could work in similar contexts | Universal technique any developer can use |
| **Scale/Performance** | 1× | No metrics | Some quantifiable improvement | Hard numbers: X% faster, Y hours saved, Z lines reduced |

### 6.3 Composite Score Calculation

```
composite = (novelty × 3) + (tool_discovery × 3) + (before_after × 2) + (failure_recovery × 3) + (reproducibility × 1) + (scale × 1)
```

**Maximum possible:** 65 (all dimensions at 5)

| Score Range | Classification | Content Potential |
|-------------|---------------|-------------------|
| 45–65 | Exceptional | Lead blog post, full multi-platform campaign |
| 30–44 | Strong | Solid blog post or featured social thread |
| 20–29 | Moderate | Good for social posts or newsletter items |
| < 20 | Low | Archive for reference, not publishable alone |

### 6.4 Content Readiness Checklist

An insight is content-ready when the agent confirms ALL of:
- Clear one-sentence summary a developer would want to read
- At least one real code snippet extracted from the session
- A "so what" — why should another developer care?
- A reproducible technique or actionable takeaway
- Enough context to support 500+ words of content

---

## 7. Content Generation

### 7.1 Content Types

| Type | Agent | Target Length | Platform |
|------|-------|-------------|----------|
| `blog_post` | Blog Writer | 1,500–2,500 words | Dev.to, personal blog, Medium |
| `twitter_thread` | Social Writer | 7–12 tweets | X/Twitter |
| `linkedin_post` | Social Writer | 200–350 words | LinkedIn |
| `devto_post` | Blog Writer (variant) | 1,500–2,500 words | Dev.to (with frontmatter) |
| `changelog` | Changelog Writer | 500–1,000 words | Internal, newsletter |
| `newsletter` | Newsletter Writer | 400–600 words | Email (Substack, Buttondown) |
| `custom` | Editor Chat | Variable | User-defined |

### 7.2 Blog Post Formats (from traction research)

The Blog Writer agent should select the most fitting format based on the insight:

1. **"I Tried X for Y Days" Report** — Personal experiment with measurable results. Best for: `before_after_transformation` category.
2. **The Deep-Debug War Story** — Symptom → investigation → root cause. Best for: `failure_recovery` category.
3. **Contrarian Technical Take** — Challenge conventional wisdom with evidence. Best for: `novel_problem_solving` category.
4. **How-I-Built-It Walkthrough** — Complete build log with every decision. Best for: `architecture_decision` category.
5. **Tool/Workflow Comparison** — Side-by-side on the same task. Best for: `tool_pattern_discovery` category.

### 7.3 Social Post Patterns

**Twitter thread structure:**
- Hook tweet: surprising number, contrarian claim, or "I just discovered..." opener
- 7–12 tweets total
- Each tweet standalone (makes sense if seen individually)
- Code described in text (not screenshots — those are added by the user)
- Final tweet: CTA + link + engagement question
- Tag 1–2 relevant tools/companies (not spammy)

**LinkedIn post structure:**
- Pattern interrupt first line ("I stopped doing code reviews. Here's why.")
- Short paragraphs (1–2 sentences, lots of whitespace)
- Personal narrative with specific projects and tools named
- ONE specific metric or result for credibility
- End with genuine question (not rhetorical)
- Max 3 hashtags at end

### 7.4 Tone Profiles

Each workspace has a default tone. Agents adapt their output accordingly:

| Tone | Voice | Sentence Style | Code Density | Example |
|------|-------|---------------|-------------|---------|
| `technical` | Third-person analytical | Complex, precise | High (40%+ code) | "The implementation leverages FFmpeg's `-x265-params` to..." |
| `tutorial` | Second-person instructional | Step-by-step imperatives | High (50%+ code) | "First, configure your transcoding pipeline by..." |
| `conversational` | First-person narrative | Short, casual | Medium (20-30%) | "So I was debugging this HEVC issue and stumbled onto..." |
| `professional` | First-person formal | Medium complexity | Medium (20-30%) | "Our team encountered a transcoding bottleneck that..." |
| `casual` | First-person informal | Very short, colloquial | Low (10-15%) | "Okay so this is wild — turns out FFmpeg was..." |

---

## 8. AI Agent Architecture

All agents use `@anthropic-ai/claude-agent-sdk` with custom in-process MCP tool servers built via `createSdkMcpServer()` and `tool()`.

### 8.1 Agent SDK Pattern

Every agent follows this structure:

```typescript
import { query, createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";

// 1. Build custom MCP server with domain-specific tools
const toolServer = createSdkMcpServer({
  name: "server-name",
  version: "1.0.0",
  tools: [
    tool("tool_name", "description", inputSchema, handler),
  ],
});

// 2. Execute agent with streaming
for await (const message of query({
  prompt: systemPrompt,
  options: {
    model: "claude-opus-4-5-20250514", // or claude-haiku-4-5-20251001
    mcpServers: { "server-name": toolServer },
    allowedTools: ["mcp__server-name__tool_name"],
    maxTurns: 25,
  },
})) {
  // 3. Process streaming messages
  if (message.type === "result") { /* extract final output */ }
}
```

### 8.2 Agent Inventory

#### Insight Extractor Agent
- **Model:** claude-opus-4-5-20250514
- **MCP tools:** session-reader (get_session_messages, list_sessions_by_timeframe), insight-tools (score_insight, create_insight)
- **Input:** Session ID(s) + scoring rubric
- **Output:** Array of `Insight` records with all 6 dimension scores + composite
- **Behavior:** Reads full session transcript, identifies discrete content-worthy findings, scores each on 6 dimensions, generates title/description/code_snippets for each, saves to database

#### Blog Writer Agent
- **Model:** claude-opus-4-5-20250514
- **MCP tools:** session-reader, insight-tools (get_insight_details), post-manager (create_post), skill-loader (get writing format skills)
- **Input:** Insight ID + tone + style settings
- **Output:** Post record (blog_post type, 1,500–2,500 words)
- **Behavior:** Reads insight details and source session, selects best blog format (see §7.2), writes first-person technical narrative with real code from session, every snippet traceable to actual session data. Uses the devlog-publisher content patterns: technical depth, traction-aware formatting, story arc (problem → investigation → solution → impact).

#### Social Writer Agent
- **Model:** claude-opus-4-5-20250514
- **MCP tools:** session-reader, insight-tools, post-manager
- **Input:** Insight ID + platform (twitter/linkedin) + tone
- **Output:** Post record (twitter_thread or linkedin_post type)
- **Behavior:** Reads insight, applies platform-specific patterns (§7.3). For Twitter: 7–12 standalone tweets with hook opener. For LinkedIn: pattern-interrupt opening, short paragraphs, single metric, engagement question. Angle MUST differ from any existing blog post for same insight.

#### Changelog Writer Agent
- **Model:** claude-opus-4-5-20250514
- **MCP tools:** session-reader (list_sessions_by_timeframe), insight-tools (get_top_insights), post-manager
- **Input:** Lookback window + workspace settings
- **Output:** Post record (changelog type, 500–1,000 words)
- **Behavior:** Summarizes all sessions within lookback window. Groups by project. Highlights top insights. Formatted as a development log with dates, project names, and key outcomes.

#### Editor Chat Agent
- **Model:** claude-opus-4-5-20250514 (streaming with `includePartialMessages: true`)
- **MCP tools:** session-reader, insight-tools, post-manager (get_post, update_post), markdown-editor (edit_markdown)
- **Input:** Post ID + user chat message + current markdown
- **Output:** Streaming text response + markdown edits applied via tools
- **Behavior:** Conversational assistant for revising content. Can rewrite sections, change tone, add/remove code blocks, restructure, expand, or compress. Edits are applied through the `edit_markdown` tool which provides `replaceLine`, `replaceRange`, `insert`, `delete` operations. Streams partial responses so the user sees text appearing in real-time.

### 8.3 MCP Tool Server Specifications

#### session-reader
| Tool | Input | Output | Description |
|------|-------|--------|-------------|
| `get_session_messages` | `{ sessionId: string, limit?: number }` | `ParsedMessage[]` | Full or truncated message list |
| `get_session_summary` | `{ sessionId: string }` | `{ summary, toolsUsed, filesModified, messageCount }` | Quick session overview |
| `list_sessions_by_timeframe` | `{ lookbackDays: number, projectFilter?: string }` | `ClaudeSession[]` | Sessions within window |

#### insight-tools
| Tool | Input | Output | Description |
|------|-------|--------|-------------|
| `get_insight_details` | `{ insightId: string }` | `Insight` with code_snippets and terminal_output | Full insight record |
| `get_top_insights` | `{ limit: number, minScore?: number }` | `Insight[]` sorted by composite desc | Ranked insight list |
| `score_insight` | `{ scores: InsightScores }` | `{ compositeScore: number }` | Compute weighted composite |
| `create_insight` | `{ ...InsightInput }` | `{ id: string }` | Save insight to database |

#### post-manager
| Tool | Input | Output | Description |
|------|-------|--------|-------------|
| `create_post` | `{ title, markdown, contentType, insightId?, tone? }` | `{ postId: string }` | Create new draft post |
| `update_post` | `{ postId, markdown?, title?, status? }` | `{ updated: true }` | Update existing post |
| `get_post` | `{ postId: string }` | `Post` | Full post record |
| `get_markdown` | `{ postId: string }` | `{ markdown: string }` | Just the markdown content |

#### markdown-editor
| Tool | Input | Output | Description |
|------|-------|--------|-------------|
| `edit_markdown` | `{ postId, operation, ...params }` | `{ applied: true, linesChanged: number }` | Apply edit operation |

Operations:
- `replaceLine`: `{ lineNumber: number, newContent: string }`
- `replaceRange`: `{ startLine: number, endLine: number, newContent: string }`
- `insert`: `{ afterLine: number, content: string }`
- `delete`: `{ startLine: number, endLine: number }`

#### skill-loader
| Tool | Input | Output | Description |
|------|-------|--------|-------------|
| `list_available_skills` | `{}` | `{ skills: [{ name, description }] }` | List writing format skills |
| `get_skill_by_name` | `{ name: string }` | `{ content: string }` | Get skill content for agent |

---

## 9. API Specification

All endpoints under `/api/`. Authentication via `Authorization: Bearer <token>` header. All responses are JSON.

### 9.1 Auth

#### `POST /api/auth/signup`
```
Request:  { "email": string, "password": string, "name": string }
Response: { "token": string, "user": { "id": string, "email": string, "name": string } }
Errors:   400 (validation), 409 (email exists)
```

#### `POST /api/auth/login`
```
Request:  { "email": string, "password": string }
Response: { "token": string, "user": { "id": string, "email": string, "name": string } }
Errors:   401 (invalid credentials)
```

#### `GET /api/auth/session`
```
Headers:  Authorization: Bearer <token>
Response: { "user": { "id", "email", "name", "image" }, "activeWorkspaceId": string | null }
Errors:   401 (no/invalid token)
```

### 9.2 Health

#### `GET /api/healthcheck`
```
Response: { "status": "ok", "db": boolean, "redis": boolean, "timestamp": string }
```
No authentication required. Returns `db: true` if Drizzle can execute a simple query. Returns `redis: true` if Upstash Redis responds to PING.

### 9.3 Workspaces

#### `GET /api/workspace`
```
Response: Workspace[] — all workspaces for authenticated user
```

#### `POST /api/workspace`
```
Request:  { "name": string, "slug": string, "sessionBasePath"?: string }
Response: Workspace
Errors:   409 (slug taken)
```

#### `GET /api/workspace/:slug`
```
Response: Workspace with style_settings joined
```

#### `PUT /api/workspace/:slug/style`
```
Request:  Partial<StyleSettings> — only fields being updated
Response: StyleSettings
```

### 9.4 Sessions

#### `POST /api/sessions/scan`
```
Request:  { "lookbackDays"?: number (default 30) }
Response: { "scanned": number, "indexed": number, "errors": number, "durationMs": number }
Side effect: Discovers JSONL files, parses them, upserts to claude_sessions table
```

#### `GET /api/sessions`
```
Query params:
  limit: number (default 20, max 100)
  offset: number (default 0)
  sort: "started_at" | "message_count" | "scanned_at" (default "started_at")
  order: "asc" | "desc" (default "desc")
  project: string (filter by project_name, partial match)
  minMessages: number (filter sessions with >= N messages)

Response: {
  "data": ClaudeSession[],
  "total": number,
  "limit": number,
  "offset": number
}
```

#### `GET /api/sessions/:id`
```
Response: ClaudeSession with full metadata
```

#### `GET /api/sessions/:id/messages`
```
Query params:
  limit: number (default 50)
  offset: number (default 0)

Response: {
  "data": ParsedMessage[],
  "total": number
}
```

### 9.5 Insights

#### `POST /api/insights/extract`
```
Request:  { "sessionIds": string[] } — 1 or more session IDs to analyze
Response: Insight[] — newly created insights with scores
Side effect: Invokes Insight Extractor Agent, saves insights to database
Note: This is a long-running operation (10–60s). Returns when all insights are saved.
```

#### `GET /api/insights`
```
Query params:
  limit: number (default 20)
  offset: number (default 0)
  minScore: number (filter by composite_score >= N)
  category: insight_category (filter by category)
  unusedOnly: boolean (filter where used_in_content = false)

Response: {
  "data": Insight[] (sorted by composite_score desc),
  "total": number
}
```

#### `GET /api/insights/:id`
```
Response: Insight with full code_snippets and terminal_output
```

### 9.6 Content

#### `GET /api/content`
```
Query params:
  limit: number (default 20)
  offset: number (default 0)
  status: post_status (filter)
  contentType: content_type (filter)

Response: {
  "data": Post[] (sorted by updated_at desc),
  "total": number
}
```

#### `POST /api/content`
```
Request:  { "title": string, "markdown": string, "contentType": content_type }
Response: Post
Note: For manually created posts (not agent-generated)
```

#### `GET /api/content/:id`
```
Response: Post with full markdown and content
```

#### `PUT /api/content/:id`
```
Request:  Partial<Post> — title, markdown, content, status
Response: Post
```

#### `DELETE /api/content/:id`
```
Response: { "deleted": true }
```

### 9.7 AI Agents (Streaming)

All agent endpoints return Server-Sent Events (SSE) for streaming.

#### `POST /api/agents/blog`
```
Request:  { "insightId": string, "tone"?: tone_profile }
Response: SSE stream
  event: progress — { "stage": "reading_session" | "writing" | "saving", "message": string }
  event: partial  — { "text": string } — partial content as it's generated
  event: complete — { "postId": string, "wordCount": number }
  event: error    — { "message": string }
```

#### `POST /api/agents/social`
```
Request:  { "insightId": string, "platform": "twitter" | "linkedin", "tone"?: tone_profile }
Response: SSE stream (same event structure as blog)
```

#### `POST /api/agents/changelog`
```
Request:  { "lookbackWindow": lookback_window, "customDays"?: number }
Response: SSE stream (same event structure as blog)
```

#### `POST /api/agents/chat`
```
Request:  { "postId": string, "message": string, "history"?: ChatMessage[] }
Response: SSE stream
  event: partial   — { "text": string } — assistant response streaming
  event: tool_use  — { "tool": string, "input": object } — edit being applied
  event: edit      — { "operation": string, "linesChanged": number } — edit result
  event: complete  — { "responseText": string }
  event: error     — { "message": string }
```

### 9.8 Automation

#### `GET /api/automation/triggers`
```
Response: ContentTrigger[]
```

#### `POST /api/automation/triggers`
```
Request:  { "name": string, "triggerType": trigger_type, "contentType": content_type, "lookbackWindow"?: lookback_window, "cronExpression"?: string }
Response: ContentTrigger
Side effect: If triggerType is "scheduled", registers cron job with QStash
```

#### `PUT /api/automation/triggers/:id`
```
Request:  Partial<ContentTrigger>
Response: ContentTrigger
```

#### `DELETE /api/automation/triggers/:id`
```
Response: { "deleted": true }
Side effect: Removes QStash schedule if applicable
```

#### `POST /api/automation/execute`
```
Headers:  Upstash-Signature (QStash webhook verification)
Request:  { "triggerId": string }
Response: { "executed": true, "postId"?: string }
Note: This is called by QStash, not by the user directly
```

### 9.9 API Keys

#### `GET /api/api-keys`
```
Response: ApiKey[] (key_prefix shown, NOT the full key)
```

#### `POST /api/api-keys`
```
Request:  { "name": string }
Response: { "id": string, "name": string, "key": string, "keyPrefix": string }
Note: The full key is ONLY returned at creation time
```

#### `DELETE /api/api-keys/:id`
```
Response: { "deleted": true }
```

---

## 10. Design System

### 10.1 Theme Tokens

```css
:root {
  /* Backgrounds */
  --sf-bg-primary:     #0A0A0A;   /* Main background */
  --sf-bg-secondary:   #111111;   /* Card/panel surfaces */
  --sf-bg-tertiary:    #1A1A1A;   /* Elevated surfaces, modal overlays */
  --sf-bg-hover:       #222222;   /* Hover state for interactive elements */
  --sf-bg-active:      #2A2A2A;   /* Active/pressed state */

  /* Borders */
  --sf-border:         #2A2A2A;   /* Default border */
  --sf-border-focus:   #3A3A3A;   /* Focus ring color */

  /* Text */
  --sf-text-primary:   #EDEDED;   /* Headings, body text */
  --sf-text-secondary: #888888;   /* Labels, metadata, timestamps */
  --sf-text-muted:     #555555;   /* Placeholder, disabled text */

  /* Accent */
  --sf-accent:         #00FF88;   /* Primary accent — electric green */
  --sf-accent-dim:     #00CC6A;   /* Dimmed accent (hover on accent elements) */
  --sf-accent-bg:      rgba(0, 255, 136, 0.08);  /* Accent background tint */

  /* Semantic */
  --sf-danger:         #FF4444;   /* Destructive actions, errors */
  --sf-warning:        #FFAA00;   /* Warnings, cautions */
  --sf-info:           #4488FF;   /* Informational badges */
  --sf-success:        #00FF88;   /* Success states (matches accent) */

  /* Typography */
  --sf-font-display:   'JetBrains Mono', monospace;  /* Headings, nav labels */
  --sf-font-body:      'Inter', sans-serif;           /* Body text, descriptions */
  --sf-font-code:      'Fira Code', monospace;        /* Code blocks, inline code */

  /* Sizing */
  --sf-radius:         6px;       /* Default border-radius */
  --sf-radius-lg:      10px;      /* Cards, modals */
  --sf-radius-full:    9999px;    /* Pills, avatars */

  /* Spacing scale */
  --sf-space-xs:       4px;
  --sf-space-sm:       8px;
  --sf-space-md:       16px;
  --sf-space-lg:       24px;
  --sf-space-xl:       32px;
  --sf-space-2xl:      48px;

  /* Shadows (subtle on dark backgrounds) */
  --sf-shadow-sm:      0 1px 2px rgba(0, 0, 0, 0.3);
  --sf-shadow-md:      0 4px 8px rgba(0, 0, 0, 0.4);
  --sf-shadow-lg:      0 8px 24px rgba(0, 0, 0, 0.5);
}
```

### 10.2 Typography Scale

| Element | Font | Size | Weight | Color |
|---------|------|------|--------|-------|
| Page title (h1) | JetBrains Mono | 24px | 700 | --sf-text-primary |
| Section heading (h2) | JetBrains Mono | 18px | 600 | --sf-text-primary |
| Card title | Inter | 16px | 600 | --sf-text-primary |
| Body text | Inter | 14px | 400 | --sf-text-primary |
| Label / metadata | Inter | 12px | 500 | --sf-text-secondary |
| Code / monospace | Fira Code | 13px | 400 | --sf-accent |
| Button text | Inter | 14px | 500 | Varies |
| Nav label | JetBrains Mono | 13px | 500 | --sf-text-secondary (active: --sf-accent) |

### 10.3 Component Specifications

#### Stat Card
- Background: --sf-bg-secondary
- Border: 1px --sf-border
- Radius: --sf-radius-lg
- Padding: --sf-space-lg
- Number: JetBrains Mono, 32px, 700, --sf-text-primary
- Label: Inter, 12px, 500, --sf-text-secondary
- Trend indicator: small ▲/▼ in --sf-success or --sf-danger

#### Session Card
- Background: --sf-bg-secondary
- Border: 1px --sf-border (hover: --sf-border-focus)
- Left accent: 3px solid --sf-accent
- Radius: --sf-radius-lg
- Project name: Inter, 16px, 600, --sf-text-primary
- Metadata line: "42 messages · 18 files · Bash, Read, Write" in --sf-text-secondary, 12px
- Summary: first 100 chars of AI summary, Inter, 14px, --sf-text-secondary
- Score badge: pill with --sf-accent-bg background, score in --sf-accent
- "Extract Insights →" button: text button in --sf-accent

#### Insight Card
- Same base as Session Card
- Category badge: pill with category-specific colors
- Score visualization: horizontal bar filled to percentage of max (65)
- Dimension breakdown: 6 small bars in a row (hover to see labels)
- "Generate Content" dropdown: Blog, Twitter, LinkedIn options

#### Content Card
- Same base as Session Card
- Status badge: Draft (--sf-info), Published (--sf-success), Archived (--sf-text-muted)
- Content type badge: small pill with icon + label
- Preview: first 2 lines of markdown rendered as plain text
- Word count in --sf-text-muted

#### Score Badge
- Background: --sf-accent-bg
- Text: --sf-accent
- Font: JetBrains Mono, 14px, 700
- Border-radius: --sf-radius-full
- Padding: 4px 12px
- Display: "8.2" or "52/65"

### 10.4 Responsive Breakpoints

| Breakpoint | Width | Navigation | Layout |
|------------|-------|-----------|--------|
| Mobile | < 768px | Bottom tab bar (5 icons) | Single column, cards stack |
| Tablet | 768px–1279px | Collapsed sidebar (icons only, 60px) | Content area expands |
| Desktop | ≥ 1280px | Full sidebar (260px, name + icons) | Multi-column where applicable |

**Mobile bottom tab bar:**
- 5 tabs: Dashboard (🏠), Sessions (📋), Insights (💡), Content (✏️), Settings (⚙️)
- Fixed at bottom, 56px height
- Active tab: --sf-accent icon, --sf-accent 2px top border
- Inactive tab: --sf-text-muted icon
- Background: --sf-bg-secondary with top border

**Desktop sidebar:**
- Width: 260px
- Background: --sf-bg-secondary
- Header: SessionForge logo + workspace selector dropdown
- Nav items: Icon + label, --sf-text-secondary (active: --sf-accent text + --sf-accent-bg background)
- Sections: Main (Dashboard, Sessions, Insights, Content, Automation), Settings (Style, API Keys)
- Bottom: User avatar + name + sign out

---

## 11. Page Specifications

### 11.1 Login Page (`/login`)

**Layout:** Centered card on --sf-bg-primary background

**Elements:**
- SessionForge logo (centered, above card)
- Card: --sf-bg-secondary, --sf-radius-lg, max-width 400px
- Email input: --sf-bg-tertiary background, --sf-border, placeholder "Email"
- Password input: same styling, placeholder "Password"
- "Sign In" button: --sf-accent background, --sf-bg-primary text, full width
- "Sign up" link below in --sf-accent
- "Continue with GitHub" button: --sf-bg-tertiary, full width, GitHub icon
- Divider between email/GitHub: "or" in --sf-text-muted

**States:**
- Loading: Button shows spinner, inputs disabled
- Error: Red border on invalid field, error message in --sf-danger below
- Success: Redirect to /[workspace] dashboard

### 11.2 Dashboard Home (`/[workspace]`)

**Layout:** 2-column grid on desktop (stat cards top, activity feed below)

**Elements:**
- Page title: "Dashboard" in JetBrains Mono h1
- 4 stat cards in 2×2 grid:
  - "Sessions" — count in last lookback window
  - "Insights" — total insights extracted, average composite score
  - "Drafts" — count with status=draft
  - "Last Scan" — relative time ("3h ago"), with "Scan Now" button
- Recent Activity feed: chronological list of events
  - Event types: session scanned, insights extracted, content generated, content published
  - Each shows: icon, description, relative timestamp
  - Max 10 items, "View all →" link

**Empty state:** If no sessions scanned yet:
- Illustration (terminal icon)
- "No sessions found" heading
- "Scan your Claude Code sessions to get started" description
- "[Scan Sessions ⚡]" accent button

**Loading state:** Skeleton cards (--sf-bg-tertiary shimmer animation)

### 11.3 Sessions Browser (`/[workspace]/sessions`)

**Layout:** List view with header controls

**Header:**
- Page title: "Sessions"
- "Scan Now ⚡" button (--sf-accent)
- Lookback dropdown: "7 days ▾" (options: 1d, 7d, 14d, 30d, All)
- Project filter: text input with search icon, filters by project name
- Sort: dropdown (Newest, Most Messages, Highest Score)

**List:** Vertical stack of Session Cards (see §10.3)

**Scan in progress state:**
- "Scan Now" button becomes spinner + "Scanning..."
- Progress text below: "Found 12 sessions, indexing..." (updates via SSE or polling)
- New session cards animate in when scan completes

**Empty state:** "No sessions found in the last 7 days. Try expanding the lookback window."

**Pagination:** "Page 1 of 4" with Prev/Next buttons

### 11.4 Session Detail (`/[workspace]/sessions/[sessionId]`)

**Layout:** Full-width single column

**Header:**
- Back arrow + "Sessions"
- Project name (h1)
- Metadata: "42 messages · 18 files modified · Duration: 1h 23m · Cost: $0.34"
- "Extract Insights" button (--sf-accent)

**Content:**
- Message timeline: alternating human/assistant blocks
  - Human messages: --sf-bg-tertiary left-aligned, --sf-text-primary
  - Assistant messages: --sf-bg-secondary full-width, with tool_use highlighted
  - Tool use blocks: small pill showing tool name + icon, collapsible to show input/output
  - Timestamps: --sf-text-muted, relative
- Tool usage summary: sidebar or top strip showing unique tools used
- Files modified: collapsible list of file paths

**States:**
- Loading: skeleton blocks
- Extracting insights: overlay with progress indicator

### 11.5 Insights Page (`/[workspace]/insights`)

**Layout:** List view sorted by composite score (descending)

**Header:**
- Page title: "Insights"
- Filter: minimum score slider (0–65)
- Category filter: multi-select pills
- "Unused only" toggle (hides insights already used in content)

**List:** Vertical stack of Insight Cards (see §10.3)

**Each card shows:**
- Category badge (color-coded)
- Title
- First line of description
- Composite score badge
- 6 mini dimension bars
- "Generate ▾" dropdown → Blog, Twitter, LinkedIn, Changelog
- Session source link

### 11.6 Insight Detail (`/[workspace]/insights/[insightId]`)

**Layout:** Single column with sidebar dimension chart

**Header:**
- Back arrow + "Insights"
- Title (h1)
- Category badge + composite score badge
- Source session link

**Content:**
- Description (full text)
- Code snippets: rendered with syntax highlighting (--sf-bg-tertiary background, Fira Code font)
- Terminal output: monospace blocks
- Dimension scores: 6-bar radar/spider chart or horizontal bar chart
  - Each dimension labeled with name, weight, and score
- "Generate Blog Post" button (--sf-accent, prominent)
- "Generate Twitter Thread" secondary button
- "Generate LinkedIn Post" secondary button

### 11.7 Content Library (`/[workspace]/content`)

**Layout:** List view with status filter tabs

**Header:**
- Page title: "Content"
- Status tabs: All, Drafts, Published, Archived (with counts)
- Content type filter: dropdown
- "New Post" button (manual creation)

**List:** Content Cards (see §10.3) sorted by updated_at desc

### 11.8 Content Editor (`/[workspace]/content/[postId]`)

**Layout:** Split view — editor (70%) + AI chat sidebar (30%)

**Editor panel (left):**
- Title: editable heading
- Status dropdown: Draft, Published, Archived
- Lexical editor with markdown support:
  - Headings, bold, italic, links
  - Code blocks with syntax highlighting
  - Lists (ordered, unordered)
  - Block quotes
  - Horizontal rules
- Bottom bar: Word count, content type, source session/insight links, "Publish" button

**AI chat sidebar (right):**
- Header: "AI Assistant"
- Chat history: scrollable message list
  - User messages: right-aligned, --sf-accent-bg
  - AI messages: left-aligned, --sf-bg-tertiary
  - Edit notifications: "Applied 2 edits to lines 3-8" in --sf-text-muted
- Input: text area + send button at bottom
- Streaming: AI response appears token-by-token

**AI chat capabilities:**
- "Make the intro more engaging" → rewrites opening section
- "Add a code example for the caching solution" → inserts code block from session
- "Change tone to conversational" → rewrites entire post in new tone
- "Shorten by 30%" → condenses while preserving key points
- "Add a conclusion with next steps" → appends closing section

**Mobile (< 768px):** Editor full-width, AI chat as bottom sheet (swipe up to reveal)

### 11.9 Automation Page (`/[workspace]/automation`)

**Layout:** Trigger card list with create form

**Header:**
- Page title: "Automation"
- "New Trigger" button

**Trigger cards:**
- Name, trigger type icon, content type badge
- Schedule description: "Every Monday at 9am" or "Manual" or "On file change"
- Lookback window badge
- Enabled toggle switch
- Last run status: success (green) / failed (red) / never (gray)
- Last run timestamp
- Actions: Edit, Delete

**Create/edit form (modal or slide-out):**
- Name input
- Trigger type: radio buttons (Manual, Scheduled, File Watch)
- Content type: dropdown
- Lookback window: dropdown
- Cron expression: shown if Scheduled, with human-readable preview
- Save / Cancel buttons

### 11.10 Settings Pages

#### General (`/[workspace]/settings`)
- Workspace name (editable)
- Workspace slug (read-only after creation)
- Session base path (editable, default ~/.claude)
- Delete workspace (danger zone, confirmation modal)

#### Writing Style (`/[workspace]/settings/style`)
- Default tone: dropdown (5 options)
- Target audience: text input
- Custom instructions: textarea (free-form guidance for agents)
- Include code snippets: toggle
- Include terminal output: toggle
- Max blog word count: number input

#### API Keys (`/[workspace]/settings/api-keys`)
- List of keys: name, prefix (sf_live_8k...), created date, last used
- "Create Key" button → modal with name input → shows full key ONCE
- Delete key: confirmation modal

---

## 12. User Flows

### 12.1 First-Time Setup
1. User visits `/login` → clicks "Sign Up"
2. Creates account (email + password or GitHub OAuth)
3. Redirected to workspace creation: enters name + slug
4. Workspace created with default style settings
5. Redirected to dashboard (empty state)
6. Dashboard shows "Scan Sessions" prompt
7. User clicks "Scan Sessions ⚡"
8. Scanner finds JSONL files → sessions appear in dashboard stats

### 12.2 Session → Insight → Blog Pipeline
1. User navigates to Sessions page
2. Clicks "Scan Now ⚡" (or sessions already populated)
3. Reviews session cards, finds high-score session
4. Clicks session card → views session detail with message timeline
5. Clicks "Extract Insights" → agent processes session
6. Redirected to Insights page with new insights highlighted
7. Reviews insight detail — scores, code snippets, description
8. Clicks "Generate Blog Post" dropdown
9. SSE stream shows progress: reading session → writing → saving
10. Redirected to editor with generated blog post
11. Reviews content, uses AI chat to refine
12. Changes status to Published

### 12.3 Automated Content Generation
1. User navigates to Automation page
2. Creates trigger: "Weekly Blog", scheduled, blog_post, last_7_days, "0 9 * * MON"
3. Every Monday at 9am, QStash fires webhook
4. System scans sessions from last 7 days
5. Extracts top insight
6. Generates blog post draft
7. User sees new draft on dashboard activity feed
8. User opens editor to review and publish

### 12.4 AI-Assisted Editing
1. User opens existing blog post in editor
2. Reads generated content
3. Types in AI chat: "Make the introduction more engaging and add a hook"
4. AI streams response explaining its changes
5. Editor shows applied edits (highlighted briefly)
6. User types: "Add the terminal output from the debugging session"
7. AI retrieves terminal output from session and inserts it
8. User reviews, makes manual edits
9. Types: "Proofread and fix any issues"
10. AI reviews and applies corrections
11. User publishes

---

## 13. Error States & Edge Cases

### 13.1 Session Scanner Errors
| Scenario | Behavior |
|----------|----------|
| `~/.claude` doesn't exist | Return `{ scanned: 0, indexed: 0 }` with info message |
| No JSONL files in lookback window | Same as above |
| Malformed JSONL line | Skip line, continue parsing, increment `errors` count |
| File read permission denied | Skip file, log warning, continue to next |
| Database connection failed | Return 500 with `{ error: "Database unavailable" }` |
| Session already indexed | Upsert (update scanned_at, message_count if changed) |

### 13.2 AI Agent Errors
| Scenario | Behavior |
|----------|----------|
| Anthropic API rate limit | SSE: `event: error` with retry-after, show in UI |
| Agent exceeds maxTurns | Save partial result, SSE: `event: error` with "Agent reached turn limit" |
| Agent fails to call create_post | Return error, no post created |
| Invalid ANTHROPIC_API_KEY | Return 500, show "Configure API key in environment" |
| Insight has no code snippets | Agent generates content without code (lower quality) |

### 13.3 UI Edge Cases
| Scenario | Behavior |
|----------|----------|
| No workspaces | Redirect to workspace creation flow |
| Empty sessions list | Show empty state with scan button |
| Empty insights list | Show empty state: "Extract insights from sessions first" |
| Empty content list | Show empty state: "Generate content from insights or create manually" |
| Long project names | Truncate with ellipsis, full name on hover tooltip |
| Very long markdown | Lexical editor handles with virtual scrolling |
| AI chat timeout | Show error in chat: "Response timed out. Try again." |
| Concurrent scans | Debounce: reject second scan if first is in progress |

---

## 14. Performance Requirements

| Metric | Target |
|--------|--------|
| Page load (dashboard) | < 2s (with cached data) |
| Session scan (50 files) | < 30s |
| Insight extraction (1 session) | < 60s |
| Blog generation | < 120s |
| Social post generation | < 30s |
| Editor AI chat response start | < 3s (first token) |
| API response (list endpoints) | < 500ms |
| Database query (with indexes) | < 100ms |

---

## 15. Environment Variables

```
# Database
DATABASE_URL=postgresql://...@ep-xxx.us-east-1.aws.neon.tech/sessionforge

# Auth
BETTER_AUTH_SECRET=random-secret-string
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx

# AI
ANTHROPIC_API_KEY=sk-ant-xxx

# Cache & Queue
UPSTASH_REDIS_URL=https://xxx.upstash.io
UPSTASH_REDIS_TOKEN=xxx
UPSTASH_QSTASH_TOKEN=xxx
UPSTASH_QSTASH_CURRENT_SIGNING_KEY=xxx
UPSTASH_QSTASH_NEXT_SIGNING_KEY=xxx

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 16. Wireframes

### 16.1 Dashboard (Desktop 1280px+)
```
┌─────────────────────────────────────────────────────────┐
│  ┌──────┐                            ┌─────┐  ┌──────┐ │
│  │ ≡ SF │  workspace-name         ▾  │ ⚡  │  │ Nick │ │
│  └──────┘                            └─────┘  └──────┘ │
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│ Dashboard│  ┌─────────────┐ ┌──────────────┐           │
│ Sessions │  │  12 Sessions│ │ 8 Insights   │           │
│ Insights │  │  (last 7d)  │ │ (top scored) │           │
│ Content  │  │  [●●●●○○○] │ │ ⬆ 4.2 avg   │           │
│ Automate │  └─────────────┘ └──────────────┘           │
│          │                                              │
│ ──────── │  ┌──────────────┐ ┌─────────────┐          │
│ Settings │  │ 5 Drafts     │ │ Last Scan   │          │
│ Style    │  │ 2 Published  │ │ 3h ago      │          │
│ API Keys │  │ [View All →] │ │ [Scan Now]  │          │
│          │  └──────────────┘ └─────────────┘          │
│          │                                              │
│          │  Recent Activity                             │
│          │  ┌──────────────────────────────┐           │
│          │  │ ● Blog post generated from    │           │
│          │  │   "FFmpeg HEVC pipeline" sess │           │
│          │  │   2h ago                      │           │
│          │  ├──────────────────────────────┤           │
│          │  │ ● 3 new insights extracted    │           │
│          │  │   from overnight sessions     │           │
│          │  │   6h ago                      │           │
│          │  └──────────────────────────────┘           │
└──────────┴──────────────────────────────────────────────┘
```

### 16.2 Sessions Browser (Desktop)
```
┌──────────────────────────────────────────────────────────┐
│ Sessions           [Scan Now ⚡]    Lookback: [7 days ▾] │
├──────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────┐ │
│ │ ● claude-code-mobile                    2h ago       │ │
│ │   42 messages · 18 files · Bash, Read, Write         │ │
│ │   "Built streaming chat with real-time updates..."   │ │
│ │   Score: ████████░░ 8.2    [Extract Insights →]      │ │
│ ├──────────────────────────────────────────────────────┤ │
│ │ ● ffmpeg-hevc-pipeline                  5h ago       │ │
│ │   67 messages · 8 files · Bash, Read, Grep           │ │
│ │   "Debugged HEVC transcoding latency issue..."       │ │
│ │   Score: ██████████ 9.4    [Extract Insights →]      │ │
│ └──────────────────────────────────────────────────────┘ │
│ Page 1 of 4                         [← Prev] [Next →]   │
└──────────────────────────────────────────────────────────┘
```

### 16.3 Content Editor (Desktop)
```
┌──────────────────────────────────────────────────────────────────┐
│ ← Back to Content    Blog Post    [Draft ▾]    [Publish]         │
├────────────────────────────────────────────┬─────────────────────┤
│                                            │                     │
│  # How We Cut HEVC Transcoding             │  AI Assistant       │
│  # Latency by 60%                          │  ─────────────      │
│                                            │                     │
│  When our video pipeline started           │  💬 "Make the       │
│  choking on 4K HEVC streams, we            │   intro more        │
│  needed a solution that didn't             │   engaging"         │
│  involve throwing more hardware            │                     │
│  at the problem...                         │  🤖 Working on it...│
│                                            │  Applied 2 edits to │
│  ```bash                                   │  lines 3-8          │
│  ffmpeg -i input.mp4 \                     │                     │
│    -c:v libx265 \                          │  ─────────────      │
│    -preset fast \                          │  [Ask AI...]        │
│    -x265-params \                          │                     │
│    "pools=+:frame-threads=4" \             │                     │
│    output.mp4                              │                     │
│  ```                                       │                     │
│                                            │                     │
├────────────────────────────────────────────┴─────────────────────┤
│ Word count: 1,847  ·  Source: Session ffmpeg-hevc-pipeline       │
└──────────────────────────────────────────────────────────────────┘
```

### 16.4 Mobile Layout (375px)
```
┌──────────────────────┐
│ ≡  SessionForge  ⚡  │
├──────────────────────┤
│                      │
│  ┌────────────────┐  │
│  │  12 Sessions   │  │
│  │  last 7 days   │  │
│  └────────────────┘  │
│                      │
│  ┌────────────────┐  │
│  │  8 Insights    │  │
│  │  top scored    │  │
│  └────────────────┘  │
│                      │
│  ┌────────────────┐  │
│  │  5 Drafts      │  │
│  │  [View All →]  │  │
│  └────────────────┘  │
│                      │
│  [Scan Sessions ⚡]  │
│                      │
│  Recent Activity     │
│  ● Blog generated    │
│    2h ago            │
│  ● 3 insights found  │
│    6h ago            │
│                      │
├──────────────────────┤
│ 🏠  📋  💡  ✏️  ⚙️  │
└──────────────────────┘
```

### 16.5 Insights Page (Desktop)
```
┌──────────────────────────────────────────────────────────┐
│ Insights     Score ≥ [0 ───●─── 65]  [Category ▾]       │
├──────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────┐ │
│ │ ⚡ failure_recovery                                   │ │
│ │ Debugging HEVC Transcoding Failures with FFmpeg Probe │ │
│ │ Discovered that HEVC failures were caused by...      │ │
│ │ ██████████░░░ 52/65    ███ ███ ██░ ███ █░░ ██░       │ │
│ │                        [Generate ▾] Blog|Twitter|LI   │ │
│ ├──────────────────────────────────────────────────────┤ │
│ │ 🔧 tool_pattern_discovery                            │ │
│ │ Parallel Agent Spawning with Claude Code Teammates   │ │
│ │ Used teammate orchestration to parallelize...        │ │
│ │ ██████████░░░ 48/65    ██░ ███ ███ █░░ ██░ ███       │ │
│ │                        [Generate ▾] Blog|Twitter|LI   │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 16.6 Automation Page (Desktop)
```
┌──────────────────────────────────────────────────────────┐
│ Automation                              [New Trigger +]  │
├──────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────┐ │
│ │ 📅 Weekly Blog Post                        [ON ●──] │ │
│ │ Scheduled · blog_post · Last 7 days                  │ │
│ │ "Every Monday at 9:00 AM"                            │ │
│ │ Last run: 2d ago (✓ success)              [Edit] [×] │ │
│ ├──────────────────────────────────────────────────────┤ │
│ │ 📅 Daily Changelog                        [OFF ──●] │ │
│ │ Scheduled · changelog · Current day                  │ │
│ │ "Every day at 6:00 PM"                               │ │
│ │ Last run: never                           [Edit] [×] │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

*End of Product Requirements Document*
