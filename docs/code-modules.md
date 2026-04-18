# SessionForge Dashboard Code Modules Reference

Comprehensive reference for library modules under `apps/dashboard/src/lib/`.

## AI Layer

### Core Agent Infrastructure

| Module | Purpose | Key Exports |
|--------|---------|------------|
| `ai/agent-runner.ts` | Agent execution engine for Claude Agent SDK. Provides streaming and non-streaming runners with SSE support and observability tracking. **Critical:** Calls `ensureCliAuth()` before spawning agents. | `runAgentStreaming()`, `runAgent()`, `AgentRunOptions`, `AgentRunResult` |
| `ai/ensure-cli-auth.ts` | Deletes `process.env.CLAUDECODE` before agent execution to prevent nested session rejection. Used by all agent callers. | `ensureCliAuth()` |
| `ai/mcp-server-factory.ts` | Creates MCP servers configured with tools for agents. Routes tool calls to handlers and manages tool discovery by agent type. | `createAgentMcpServer()`, `createCustomMcpServer()` |
| `ai/orchestration/streaming.ts` | SSE streaming utilities for streaming agent responses. | `createSSEStream()`, `sseResponse()` |
| `ai/orchestration/retry.ts` | Retry logic with exponential backoff. | `withRetry()` |

### Agent Implementations

| Module | Purpose | Key Exports |
|--------|---------|------------|
| `ai/agents/blog-writer.ts` | Blog post generation from insights with tone/style customization. | `generateBlogPost()` |
| `ai/agents/social-writer.ts` | Twitter threads and LinkedIn posts from insights. | `generateSocialContent()` |
| `ai/agents/changelog-writer.ts` | Changelog generation from session history within timeframe. | `generateChangelog()` |
| `ai/agents/newsletter-writer.ts` | Newsletter summaries from insights and sessions. | `generateNewsletter()` |
| `ai/agents/style-learner.ts` | Learns user's writing style from corpus and updates profile. | `learnWritingStyle()` |
| `ai/agents/editor-chat.ts` | Real-time AI chat during content editing with markdown tool. | `runEditorChat()` |

### Prompts & Skills

| Module | Purpose | Key Exports |
|--------|---------|------------|
| `ai/prompts/blog/*.ts` | Blog prompt templates (conversational, technical, tutorial). | Prompt strings |
| `ai/prompts/social/*.ts` | Social media prompt templates (Twitter, LinkedIn). | Prompt strings |
| `ai/prompts/*.ts` | Prompts for changelog, newsletter, style-learner, corpus analysis, insight extraction, repurposing, recommendations. | Prompt strings |
| `ai/skills/built-in-skills.ts` | Built-in Claude skills registry. | `getBuiltInSkills()` |

### Tools & Observability

| Module | Purpose | Key Exports |
|--------|---------|------------|
| `ai/tools/markdown-editor.ts` | MCP tool for precise markdown editing (replaceLine, replaceRange, insert, delete). | `handleMarkdownEditorTool()` |
| `ai/tools/session-reader.ts` | MCP tools for querying session data. | `handleSessionReaderTool()` |
| `ai/tools/insight-tools.ts` | MCP tools for creating/reading insights. | `handleInsightTool()` |
| `ai/tools/evidence-tools.ts` | MCP tools for mining evidence from sessions. | `handleEvidenceTool()` |
| `ai/tools/ingestion-tools.ts` | MCP tools for source material assembly and repo analysis. | `handleIngestionTool()` |
| `ai/tools/github-context.ts` | GitHub context extraction tool. | Tool definitions |
| `ai/tools/performance-analyzer.ts` | Performance analysis tool. | Tool definitions |

---

## Session Processing Pipeline

### File Scanning & Parsing

| Module | Purpose | Key Exports |
|--------|---------|------------|
| `sessions/scanner.ts` | Filesystem scanner for Claude JSONL session files with metadata extraction. | `scanSessionFiles()`, `SessionFileMeta` |
| `sessions/ssh-scanner.ts` | SSH remote scanner for session discovery on external servers. | `scanRemoteSessions()` |
| `sessions/parser.ts` | JSONL parser extracting messages, tools, files, costs, and errors. Streams files to minimize memory. | `parseSessionFile()`, `parseSessionBuffer()`, `ParsedSession`, `SampleMessage` |
| `sessions/normalizer.ts` | Merges file metadata and parsed data into flat normalized records. Computes duration and fallback timestamps. | `normalizeSession()`, `NormalizedSession` |
| `sessions/indexer.ts` | Upserts normalized sessions into `claudeSessions` table. Detects updates vs inserts. | `indexSessions()`, `IndexResult` |
| `sessions/upload-processor.ts` | Handles uploaded .jsonl files and zip archives. Processes uploads via multipart form data. | `processUploadedFile()`, `processZipFile()`, `UploadedFileResult` |
| `sessions/miner.ts` | AI-powered evidence mining from session corpus. Uses Agent SDK. | `mineSessionEvidence()` |

---

## Content & Automation Pipeline

### Pipeline Orchestration

| Module | Purpose | Key Exports |
|--------|---------|------------|
| `automation/pipeline.ts` | 3-stage orchestrator: scan (local + SSH), extract (corpus analysis), generate (content). Manages run lifecycle with observability. Emits `PipelineEvent` via `onProgress` callback for real-time progress updates. | `executePipeline()`, `ExecutePipelineOptions`, `PipelineEvent`, `lookbackWindowToDays()` |
| `automation/content-generator.ts` | Content generation engine that creates posts from insights using agent writers. | `generateContent()`, `ContentType` |
| `automation/cron-utils.ts` | Cron expression utilities. | Cron helpers |
| `automation/file-watcher.ts` | File system monitoring for automated triggers. | File watcher utilities |

### Pipeline UI & Hooks

| Module | Purpose | Key Exports |
|--------|---------|------------|
| `hooks/use-analysis-pipeline.ts` | React hook for pipeline SSE client integration. Manages connection, event streaming, and state lifecycle. Returns pipeline state, `startAnalysis()` callback, and abort `cancel()` function. | `useAnalysisPipeline()`, `PipelineEvent`, `AnalysisPipelineState` |
| `components/pipeline/pipeline-progress.tsx` | Pipeline progress visualization component displaying 3-stage timeline with icons, live messages, and result summary. Renders completion/error states. | `PipelineProgress`, `PipelineProgressProps` |

### Queue & Job Management

| Module | Purpose | Key Exports |
|--------|---------|------------|
| `queue/batch-processor.ts` | Concurrent batch job processor with configurable concurrency limits. | `processBatch()` |
| `queue/job-tracker.ts` | Job status tracking and state management. | `JobTracker` |

---

## Publishing & Integrations

### Publishing

| Module | Purpose | Key Exports |
|--------|---------|------------|
| `publishing/hashnode.ts` | Hashnode GraphQL publishing client. Publishes to publications with metadata and tags. | `publishToHashnode()`, `getHashnodePublications()`, `HashnodePublishInput`, `HashnodePublishResult` |

### Platform Integrations

| Module | Purpose | Key Exports |
|--------|---------|------------|
| `integrations/github.ts` | GitHub API integration for repository context and content analysis. | GitHub client utilities |
| `integrations/devto.ts` | Dev.to API publishing integration. | `publishToDevto()`, `getDevtoArticles()` |
| `integrations/medium.ts` | Medium publishing integration. | Medium client utilities |
| `integrations/ghost.ts` | Ghost CMS integration. | Ghost client utilities |
| `integrations/twitter.ts` | Twitter API integration (placeholder). | Twitter utilities |
| `integrations/linkedin.ts` | LinkedIn API integration (placeholder). | LinkedIn utilities |

### Content Processing

| Module | Purpose | Key Exports |
|--------|---------|------------|
| `ingestion/source-assembler.ts` | Assembles source material packages (brief, URLs, repos) for content generation. | `assembleSources()` |
| `ingestion/text-processor.ts` | Processes raw text input into structured brief format. Uses Agent SDK. | `processUserBrief()` |
| `ingestion/repo-analyzer.ts` | Analyzes GitHub repositories for content context using Agent SDK. | `analyzeRepository()` |
| `ingestion/url-extractor.ts` | Extracts and parses content from external URLs. | `extractFromUrl()` |
| `social/twitter-parser.ts` | Parses Twitter threads and extracts engagement metrics. | Twitter parsing utilities |
| `social/linkedin-parser.ts` | Parses LinkedIn posts and extracts metadata. | LinkedIn parsing utilities |

---

## Infrastructure & Storage

### Caching & Queuing

| Module | Purpose | Key Exports |
|--------|---------|------------|
| `redis.ts` | Lazy-initialized Upstash Redis client. Returns null when not configured. | `getRedis()` |
| `qstash.ts` | QStash scheduling and verification. Creates cron schedules, delayed messages, and verifies webhook signatures. | `createTriggerSchedule()`, `createPublishSchedule()`, `verifyQStashRequest()`, `isQStashAvailable()` |

### Database

| Module | Purpose | Key Exports |
|--------|---------|------------|
| `db.ts` | Drizzle ORM database client. | `db` |

### Authentication & Authorization

| Module | Purpose | Key Exports |
|--------|---------|------------|
| `api-auth.ts` | Session/token authentication helpers for API routes. | Session validation utilities |
| `auth/api-key.ts` | API key generation and validation. | `generateApiKey()`, `validateApiKey()` |
| `auth-client.ts` | Better Auth client configuration. | `authClient` |

### Billing

| Module | Purpose | Key Exports |
|--------|---------|------------|
| `stripe.ts` | Stripe billing client and subscription management. | Stripe utilities |

---

## Content Management

### SEO & Readability

| Module | Purpose | Key Exports |
|--------|---------|------------|
| `seo/index.ts` | Barrel export for SEO modules (readability, scoring, frontmatter). | Re-exports |
| `seo/readability.ts` | Readability scoring algorithms (Flesch-Kincaid, etc.). | `calculateReadability()`, `ReadabilityScore` |
| `seo/scoring.ts` | SEO quality scoring (keywords, structure, metadata). | `calculateSeoScore()`, `SeoScore` |
| `seo/frontmatter.ts` | YAML frontmatter extraction and generation. | `extractFrontmatter()`, `generateFrontmatter()` |
| `seo/generator.ts` | AI-powered SEO metadata generation using Agent SDK. | `generateSeoMetadata()` |
| `seo/keyword-extractor.ts` | Keyword extraction from content. | `extractKeywords()` |
| `seo/geo-optimizer.ts` | Geographic SEO optimization. | Geo utilities |

### Media & Export

| Module | Purpose | Key Exports |
|--------|---------|------------|
| `media/diagram-generator.ts` | AI-powered diagram generation from markdown descriptions using Agent SDK. | `generateDiagrams()` |
| `export.ts` | Content export utilities (markdown, HTML, PDF). | `exportMarkdown()`, `exportHtml()` |
| `export/markdown-export.ts` | Markdown-specific export logic. | Export utilities |
| `export/static-site-builder.ts` | Static site generation from content. | Site builder utilities |
| `export/sitemap-generator.ts` | XML sitemap generation. | `generateSitemap()` |
| `export/rss-generator.ts` | RSS feed generation. | `generateRssFeed()` |
| `export/theme-manager.ts` | Theme management for exported sites. | Theme utilities |

### Content Metadata

| Module | Purpose | Key Exports |
|--------|---------|------------|
| `content-constants.tsx` | Shared constants for content types, statuses, and UI (STATUS_COLORS, TYPE_LABELS, STATUS_TABS, SeoScoreBadge component). | Constants and components |
| `revisions/manager.ts` | Content revision tracking and history. | `RevisionManager` |
| `templates/index.ts` | Template registry and management. | Template utilities |
| `templates/built-in/*.ts` | Built-in content templates (architecture-decision, debugging-story, dev-log, how-i-built-x, release-notes, til, tool-comparison, tutorial). | Template strings |
| `templates/db-operations.ts` | Template database operations. | Template DB helpers |

### Webhooks

| Module | Purpose | Key Exports |
|--------|---------|------------|
| `webhooks/events.ts` | Webhook event firing and delivery. | `fireWebhookEvent()`, `deliverWebhook()` |
| `webhooks/deliver.ts` | HTTP delivery logic for webhooks. | Webhook delivery utilities |

---

## Utilities & Style

### Core Utilities

| Module | Purpose | Key Exports |
|--------|---------|------------|
| `utils.ts` | Common utility functions: `cn()` (Tailwind class merging), `timeAgo()`, `formatMs()` (milliseconds), `formatDuration()` (seconds), `formatDate()`. | Utility functions |
| `validation.ts` | Zod schemas for all input types (workspace, content, auth, agents, triggers, integrations). Helper: `parseBody<T>()`. | Schemas and types |
| `errors.ts` | Structured error handling with `AppError` class and `withApiHandler()` middleware. Standard error codes: UNAUTHORIZED, FORBIDDEN, NOT_FOUND, VALIDATION_ERROR, BAD_REQUEST, INTERNAL_ERROR. | `AppError`, `ERROR_CODES`, `formatErrorResponse()`, `withApiHandler()` |
| `keyboard-shortcuts.ts` | Keyboard shortcut definitions and handlers. | Shortcut utilities |
| `attribution.ts` | Citation and attribution utilities. | Attribution helpers |

### Style & Content Processing

| Module | Purpose | Key Exports |
|--------|---------|------------|
| `style/edit-distance.ts` | Levenshtein distance for string similarity matching. | `editDistance()` |
| `style/profile-injector.ts` | Injects learned writing style into generated content. | `injectStyle()` |
| `wordpress/client.ts` | WordPress REST API client for publishing. | WordPress client utilities |
| `wordpress/crypto.ts` | WordPress webhook signature verification. | Crypto utilities |

### Observability

| Module | Purpose | Key Exports |
|--------|---------|------------|
| `observability/event-bus.ts` | Event emission for observability across the system. | `eventBus` |
| `observability/event-types.ts` | Event type definitions and creators. | `createAgentEvent()`, `createPipelineEvent()` |
| `observability/sse-broadcaster.ts` | Server-sent events broadcasting. | SSE utilities |
| `observability/instrument-query.ts` | Query performance instrumentation. | Query instrumentation |
| `observability/instrument-pipeline.ts` | Pipeline execution instrumentation. | `createPipelineInstrumentation()` |
| `observability/trace-context.ts` | Distributed trace context management. | `generateTraceId()`, trace utilities |

---

## Key Architecture Patterns

### Agent SDK Integration
- All agent execution goes through `agent-runner.ts` which uses `@anthropic-ai/claude-agent-sdk` `query()`
- **Critical:** `ensureCliAuth()` (from `ai/ensure-cli-auth.ts`) must be called before every `query()` to delete `process.env.CLAUDECODE` and prevent nested session rejection
- MCP tools are provided via `mcp-server-factory.ts` which creates SDK-compatible servers
- Auth inherits from Claude CLI session — no API keys, no env var configuration needed

### 3-Stage Pipeline
1. **Scan**: `scanSessionFiles()` + `scanRemoteSessions()` → parse → normalize → index
2. **Extract**: `analyzeCorpus()` uses Agent SDK to find insights
3. **Generate**: `generateContent()` spawns agent writers based on content type

### Error Handling
- Use `AppError` for API errors with standard codes
- Wrap route handlers with `withApiHandler()` for uniform error formatting
- Validation via Zod schemas with `parseBody<T>()` helper

### Observability
- Emit events via `eventBus` for tracing and monitoring
- Use `createPipelineInstrumentation()` to track pipeline stages
- Generate unique trace IDs for distributed tracing

---

## Dependencies Between Modules

- **agent-runner** depends on: mcp-server-factory, ensure-cli-auth, observability, db
- **pipeline** depends on: scanner, ssh-scanner, parser, normalizer, indexer, corpus-analyzer, content-generator, webhooks
- **content-generator** depends on: various agent writers, validation
- **agents/** depend on: mcp-server-factory, agent-runner, ensure-cli-auth, prompts, observability
- **publishing/** depends on: validation, errors
- **ingestion/** depends on: Agent SDK (for text-processor, repo-analyzer; both call ensure-cli-auth)
- **export/** depends on: content processing utilities, seo
- **qstash** depends on: observability for webhook delivery

---

## Database Schema

**Location:** `packages/db/src/schema/` (split into `tables.ts`, `enums.ts`, `types.ts`, `relations.ts`)  
**Total tables:** 75 (grown from 59 in early 2026)  
**For full reference:** See [database-guide.md](./database-guide.md)
