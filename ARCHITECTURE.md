# Architecture

## System Overview

SessionForge is a monorepo Next.js application that transforms Claude Code session logs into publication-ready technical content. It follows a pipeline architecture: **scan → parse → score → extract → generate → edit → publish**.

```
┌─────────────────────────────────────────────────────────────┐
│                      SessionForge                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ~/.claude/projects/          ┌──────────────────┐         │
│  (JSONL session files)  ───►  │ Session Scanner  │         │
│                               │ parser.ts        │         │
│                               │ normalizer.ts    │         │
│                               └───────┬──────────┘         │
│                                       │                     │
│                                       ▼                     │
│                               ┌──────────────────┐         │
│                               │   PostgreSQL     │         │
│                               │   (Neon)         │         │
│                               │   30+ tables     │         │
│                               └───────┬──────────┘         │
│                                       │                     │
│                          ┌────────────┼────────────┐       │
│                          ▼            ▼            ▼       │
│                   ┌───────────┐ ┌──────────┐ ┌─────────┐  │
│                   │ Insight   │ │ Content  │ │ Session │  │
│                   │ Extractor │ │ Agents   │ │ Mining  │  │
│                   └───────────┘ └──────────┘ └─────────┘  │
│                          │            │                     │
│                          ▼            ▼                     │
│                   ┌──────────────────────────┐             │
│                   │     Content Editor       │             │
│                   │  Lexical + AI Chat +     │             │
│                   │  Inline Edit Controls    │             │
│                   └──────────────────────────┘             │
│                          │                                  │
│                   ┌──────┴──────┐                          │
│                   ▼      ▼      ▼                          │
│               Hashnode  WP   Dev.to                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Session Ingestion

```
~/.claude/projects/*/sessions/*.jsonl
       │
       ▼
  scanner.ts        Discovers JSONL files, decodes project paths
       │
       ▼
  parser.ts         Streams line-by-line via readline
       │             Extracts: messages, tools, file edits, errors, costs
       ▼
  normalizer.ts     Maps parsed data → NormalizedSession type
       │
       ▼
  indexer.ts        Drizzle upsert → claude_sessions table
```

### 2. Insight Extraction

```
claude_sessions (DB)
       │
       ▼
  Insight Extractor Agent
  - Reads session transcript via MCP tools
  - Scores 6 dimensions (novelty, tools, transformation, failure recovery, reproducibility, scale)
  - Composite score: max 65
       │
       ▼
  insights (DB)     Ranked by composite score
```

### 3. Content Generation

```
insights (DB)
       │
       ├──► Blog Writer Agent     → blog_post
       ├──► Social Writer Agent   → twitter_thread, linkedin_post
       ├──► Changelog Writer      → changelog
       └──► Newsletter Writer     → newsletter
              │
              ▼
         posts (DB)     SSE streaming to editor
```

### 4. Content Editing

```
posts (DB)
       │
       ▼
  Content Editor Page
  ├── Lexical Rich Text Editor
  ├── Inline Edit Controls (Make Longer, Make Shorter, Improve Clarity, Target Length)
  ├── AI Chat Sidebar (streaming via useEditorChat hook)
  ├── SEO Panel
  ├── Evidence Explorer
  ├── Supplementary Panel
  ├── Media Panel (diagram generation)
  └── Repository Panel (revision history, asset inventory)
```

## AI Agent Architecture

All AI features use `@anthropic-ai/claude-agent-sdk`. The SDK's `query()` function spawns the `claude` CLI as a subprocess, inheriting authentication from the logged-in user. No API keys are stored or required.

### Agent Runner

Two entry points in `agent-runner.ts`:

- **`runAgentStreaming()`** — Returns an SSE `Response` for real-time streaming to the UI. Used by blog writer, social writer, editor chat, etc.
- **`runAgent()`** — Returns a `Promise<AgentRunResult>` for background processing. Used by insight extractor, content generator.

Both support graceful degradation via `DISABLE_AI_AGENTS=true`.

### MCP Tool Pattern

Each agent receives a pre-configured MCP server with restricted tool sets:

| Agent | Available Tool Sets |
|-------|-------------------|
| insight-extractor | session, insight |
| blog-writer | session, insight, post, skill |
| social-writer | session, insight, post, skill |
| editor-chat | post, markdown |
| evidence-writer | post, evidence |

Tools are defined in `tool-registry.ts` and assembled via `mcp-server-factory.ts`.

## Database Schema

30+ tables managed by Drizzle ORM. Key tables:

| Table | Purpose |
|-------|---------|
| `users` | User accounts (Better Auth managed) |
| `workspaces` | User workspaces with session scan paths |
| `claude_sessions` | Indexed session records with metadata |
| `insights` | AI-extracted insights with 6-dimension scores |
| `posts` | Generated content (all content types) |
| `post_revisions` | Version history for every edit |
| `post_conversations` | Chat history per post |
| `content_triggers` | Automation trigger rules |
| `agent_runs` | AI agent execution logs |
| `api_keys` | Publishing integration credentials |
| `style_profiles` | Learned writing style preferences |

## Frontend Architecture

### Routing

Next.js 15 App Router with dynamic workspace segments:

```
/[workspace]                    Dashboard home
/[workspace]/sessions           Session browser
/[workspace]/sessions/[id]      Session detail
/[workspace]/insights           Insight list
/[workspace]/insights/[id]      Insight detail
/[workspace]/content            Content library
/[workspace]/content/new        New content creation
/[workspace]/content/[postId]   Content editor
/[workspace]/automation         Trigger management
/[workspace]/settings           Workspace settings
```

### Editor Architecture

The content editor uses a resizable panel layout:

- **Edit mode**: Lexical editor (60%) + tabbed sidebar (40%)
- **Split mode**: Lexical editor (50%) + rendered preview (50%)
- **Preview mode**: Full-width rendered preview

The `useEditorChat` hook extracts all AI chat logic (SSE streaming, conversation persistence, markdown refetch) into a reusable hook shared between the `AIChatSidebar` and `InlineEditControls` components.

### Auth Flow

Better Auth handles authentication:

1. Email/password signup → session cookie
2. GitHub OAuth → callback → session cookie
3. Middleware checks session on all `/[workspace]/*` routes
4. API routes verify session via `auth.api.getSession()`
