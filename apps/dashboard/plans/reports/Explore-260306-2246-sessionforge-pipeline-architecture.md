# SessionForge Content Creation Pipeline - End-to-End Architecture

**Exploration Date:** March 6, 2025  
**Scope:** Complete analysis of scanning, content generation, editing, and automation systems

---

## 1. SCANNING SYSTEM

### Overview
Scanning loads Claude Code session files from disk, parses them, normalizes the data, and indexes it into the database for later analysis.

### Components

#### 1.1 Session File I/O (`src/lib/sessions/scanner.ts`)
- **Function:** `scanSessionFiles(lookbackDays: number, basePath: string)`
- Traverses `~/.claude/sessions/` or custom `sessionBasePath`
- Filters by date (within `lookbackDays`)
- Returns file paths with metadata (createdAt, messageCount)

#### 1.2 Session File Parser (`src/lib/sessions/parser.ts`)
- **Function:** `parseSessionFile(filePath: string)`
- Reads serialized session JSON from disk
- Extracts: session ID, title, turns (user/assistant messages), tools used, errors, files modified
- **Limitation:** No validation of file structure; assumes well-formed JSON

#### 1.3 Session Normalizer (`src/lib/sessions/normalizer.ts`)
- **Function:** `normalizeSession(meta, parsed)`
- Converts raw session data into uniform structure
- Extracts: topics, error types, tool patterns, file change summary

#### 1.4 Session Indexer (`src/lib/sessions/indexer.ts`)
- **Function:** `indexSessions(workspaceId: string, normalized: NormalizedSession[])`
- Writes normalized sessions to DB (`sessions` table)
- Returns scan result with `scanned` count

### Data Flow
```
File System (.claude/sessions/)
  ↓
scanSessionFiles() → filePaths[]
  ↓
parseSessionFile() → ParsedSession[]
  ↓
normalizeSession() → NormalizedSession[]
  ↓
indexSessions() → DB (sessions table)
```

### Key Insight
Sessions are **indexed once** (not re-indexed). The index becomes the source of truth for all downstream analysis.

---

## 2. EXTRACTION SYSTEM (Corpus Analysis)

### Overview
The corpus analyzer identifies **cross-session patterns** by analyzing all sessions in a lookback window holistically, not one-by-one.

### Components

#### 2.1 Corpus Analyzer Agent (`src/lib/ai/agents/corpus-analyzer.ts`)
- **Function:** `analyzeCorpus(input: AnalyzeCorpusInput)`
- Receives: `workspaceId`, `lookbackDays`, optional `topicFilter`
- Returns: `{ insightCount: number, text: string | null }`
- Max turns: 25 (deep agentic reasoning)

#### 2.2 Corpus Analysis Prompt (`src/lib/ai/prompts/corpus-analysis.ts`)
- **Length:** 89 lines
- **Strategy:** 3-phase (Survey → Deep-Dive → Pattern Detection)
- **Pattern Types:**
  1. Recurring themes across sessions
  2. Skill evolution over time
  3. Corrections & pivots
  4. Breakthrough moments
  5. Failure + recovery arcs
- **Scoring:** Composite score (0-65) across 6 dimensions:
  - Novelty (3x weight)
  - Tool discovery (3x weight)
  - Before/after transformation (2x weight)
  - Failure recovery (3x weight)
  - Reproducibility (1x weight)
  - Scale (1x weight)

#### 2.3 Insight Creation
- Agent calls `create_insight` MCP tool for each pattern found
- Insights store:
  - `title`: Punchy, specific (max 80 chars)
  - `category`: One of 6 categories from DB enum
  - `description`: 2-3 sentences referencing 2+ sessions
  - `codeSnippets`: Real code with sessionId in context
  - `terminalOutput`: Real terminal output
  - `scores`: Weighted dimension scores

### Agent Loop
```
1. Agent receives: "Analyze last N days"
2. Agent calls: list_sessions_by_timeframe(lookbackDays)
3. Agent reviews session summaries, identifies promising sessions
4. Agent calls: get_session_messages(sessionId) for deep-dive
5. Agent identifies cross-session patterns
6. Agent calls: create_insight(...) for each pattern (3-5 expected)
7. Agent returns summary text
8. Caller counts: result.toolResults.filter(r => r.tool === "mcp__tools__create_insight").length
```

### Key Insights
- **Non-fatal failure:** If corpus analysis fails, pipeline continues to generation
- **DB count as ground truth:** Code uses DB query to count created insights (fallback if tool name matching fails)
- **Focus on cross-session value:** A pattern spanning 3 sessions > isolated finding in 1 session

---

## 3. CONTENT GENERATION SYSTEM

### Overview
Takes extracted insights and generates multi-format content (blog, social, changelog, newsletter, etc.) using specialized agents.

### Components

#### 3.1 Content Generator (`src/lib/automation/content-generator.ts`)
- **Function:** `generateContent(input: GenerateContentInput)`
- Receives: `workspaceId`, `contentType`, `insightIds[]`, `lookbackDays`, `corpusSummary`
- Returns: `{ postId: string } | null`

#### 3.2 Content Type Support
- `blog_post`, `twitter_thread`, `linkedin_post`, `devto_post`, `changelog`, `newsletter`, `custom`
- Each maps to:
  - Agent type (blog-writer, social-writer, newsletter-writer, etc.)
  - System prompt
  - User message builder function

#### 3.3 Brief Context Assembly (`buildBriefContext`)
- Fetches insight rows by ID
- Assembles narrative context string:
  1. **Corpus summary** (if provided)
  2. **Insight summaries** (title, score, category, description)
  3. **Available tools:** `get_insight_details(id)` for full code/output
- Result injected into every writer's prompt

#### 3.4 Content Config
```typescript
const CONTENT_CONFIG: Record<ContentType, ContentConfig> = {
  blog_post: {
    agentType: "blog-writer",
    systemPrompt: BLOG_TECHNICAL_PROMPT,
    buildUserMessage: (input, briefContext) => {
      // Instruction: fetch insights, identify narrative arc,
      // use real code as examples, create post with content_type "blog_post"
    }
  },
  twitter_thread: {
    agentType: "social-writer",
    systemPrompt: TWITTER_THREAD_PROMPT,
    buildUserMessage: (input, briefContext) => {
      // Instruction: pick ONE finding, call get_insight_details,
      // build 7-12 tweet thread, create post
    }
  },
  // ... similarly for LinkedIn, Dev.to, Changelog, Newsletter, Custom
}
```

#### 3.5 Agent Writers
- **blog-writer** (140 lines): Technical/tutorial/conversational tones, template support
- **social-writer** (137 lines): Twitter & LinkedIn, platform-specific prompts
- **newsletter-writer** (119 lines): Multi-section digest with Code Spotlight
- **changelog-writer** (123 lines): Grouped by theme, evolution narrative
- **repurpose-writer** (68 lines): Converts existing posts to other formats
- **editor-chat** (50 lines): Real-time editing assistance via SSE

#### 3.6 Agent Runner
- **Function:** `runAgent(opts: AgentRunOptions)`
- Uses Agent SDK `query()` with MCP tools
- Max turns: 15 (default), configurable
- Returns: `{ text: string | null, toolResults: Array<{ tool: string, result: unknown }> }`

#### 3.7 Agent Streaming
- **Function:** `runAgentStreaming(opts: AgentRunOptions)`
- Returns SSE Response for real-time UI updates
- Events: `status`, `tool_use`, `tool_result`, `text`, `complete`, `error`, `done`
- Used by: blog-writer, social-writer, editor-chat (user-facing)

### Agent MCP Server Factory
- **File:** `src/lib/ai/mcp-server-factory.ts`
- Routes tool calls by name → handler function
- Tool groups: session, insight, post, markdown, skill, evidence, ingestion
- Agent type → tool group mapping ensures agents only access relevant tools

### Data Flow
```
insightIds[] (from corpus analysis)
  ↓
buildBriefContext() → narrative context string with insight summaries
  ↓
CONTENT_CONFIG[contentType] → agent type, prompts, instructions
  ↓
runAgent() → Agent SDK query() with MCP tools
  ↓
Agent fetches insight details, creates post with create_post()
  ↓
Query DB for last created post in workspace
  ↓
Return { postId }
```

### Key Insights
- **Template support:** Both DB templates and built-in templates can scaffold posts
- **Style injection:** Writer prompts include workspace's style profile
- **Skill system:** Active skills injected into system prompt (e.g., SEO, repurposing)
- **No streaming for automation:** `runAgent()` used (non-streaming) for background jobs; `runAgentStreaming()` used only for UI-facing features

---

## 4. AUTOMATION / TRIGGER SYSTEM

### Overview
Orchestrates the complete pipeline: scan → extract → generate, triggered by manual, scheduled, or file-watch events.

### Components

#### 4.1 Pipeline Orchestrator (`src/lib/automation/pipeline.ts`)
- **Function:** `executePipeline(runId: string, trigger: ContentTrigger, workspace: Workspace)`
- **Stages:**
  1. **SCANNING** (status: "scanning")
     - Calls `scanSessionFiles()` and `indexSessions()`
     - Stores: `sessionsScanned` count
  2. **EXTRACTING** (status: "extracting")
     - Calls `analyzeCorpus()`
     - Non-fatal failure: continues to generation
     - Stores: `insightsExtracted` count
  3. **GENERATING** (status: "generating")
     - Calls `generateContent()` with extracted insight IDs
     - Stores: `postId` (created post)
  4. **COMPLETE** (status: "complete")
     - Updates trigger: `lastRunAt`, `lastRunStatus: "success"`
     - Emits webhook: `automation.completed`
  5. **FAILED** (status: "failed")
     - Stores: error message
     - Updates trigger: `lastRunAt`, `lastRunStatus: "failed"`
     - Emits webhook: `automation.completed` (with error)

#### 4.2 Automation Run Table
- Columns: `id`, `triggerId`, `status`, `sessionsScanned`, `insightsExtracted`, `postId`, `errorMessage`, `startedAt`, `completedAt`, `durationMs`
- Used for: UI display of run history, progress tracking

#### 4.3 Automation Triggers
- **Table:** `contentTriggers`
- **Columns:** `id`, `workspaceId`, `contentType`, `name`, `lookbackWindow`, `triggerType` (manual/scheduled/file_watch), `lastRunAt`, `lastRunStatus`
- **Lookback windows:** "current_day", "yesterday", "last_7_days", "last_14_days", "last_30_days", "custom"

#### 4.4 API Routes
- **GET** `/api/automation/runs?workspace=<slug>` → List runs for workspace (50 max)
- **GET/POST** `/api/automation/triggers` → CRUD trigger definitions

### Key Insights
- **Insights preserved on failure:** Extracted insights survive pipeline failure; only generation can fail without data loss
- **Observability:** Each pipeline emits trace events via `instrument-pipeline.ts` (OpenTelemetry-compatible)
- **Non-fatal corpus failure:** If `analyzeCorpus()` throws, pipeline continues with empty `corpusSummary`

---

## 5. CONTENT EDITING SYSTEM

### Overview
Users can edit AI-generated or manual posts in a rich editor with AI assistance, real-time SEO analysis, and multi-platform publishing.

### Components

#### 5.1 Content Editor Page (`src/app/(dashboard)/[workspace]/content/[postId]/page.tsx`)
- **Line count:** 150+ (dynamic imports for lazy loading)
- **Layout:** Resizable panels (edit/split/preview) with localStorage persistence
- **View modes:** "edit", "split", "preview"
- **Tabs:** chat, seo, evidence, supplementary, media, repository

#### 5.2 Editor Components
- **MarkdownEditor** (dynamic import): Lexical-based rich text editor
- **AIChatSidebar**: Streams editor-chat agent responses (SSE)
- **SeoPanel**: Real-time SEO checklist, readability score, keyword analysis
- **RevisionHistoryPanel**: View/restore previous versions
- **EvidenceExplorer**: View sources that informed the post
- **SupplementaryPanel**: Generate diagrams, images, supplementary content
- **MediaPanel**: Generate or upload media
- **RepositoryPanel**: Link to code repositories, revision history
- **SeriesNavLinks**: Navigate related posts in same series

#### 5.3 Editor Data Hooks
- `usePost(postId)`: Fetch post data
- `useUpdatePost()`: Mutation for saving changes (auto-save every 2 minutes)
- `useSeoData(postId)`: Fetch SEO metadata and readability score
- `useEditorChat(postId)`: Stream editor-chat responses

#### 5.4 Publishing Integration
- **Hashnode**: Modal, API integration
- **Dev.to**: Modal, API integration
- **Ghost**: Modal, API integration
- **Medium**: Modal, API integration
- **WordPress**: Direct integration

#### 5.5 Post Conversation Storage (`src/app/api/content/[id]/conversation/route.ts`)
- **GET**: Fetch conversation history (message array)
- **PUT**: Save conversation history
- Used by: editor-chat to maintain context across turns

### Key Insights
- **Auto-save every 2 minutes:** Persists user edits without explicit save button
- **Template scaffolding:** Posts can be created from custom or built-in templates
- **Authenticity badge:** Optional visual indicator showing post authorship (user vs. AI draft)
- **Repurposing UI:** Dropdown to generate alternative formats (Twitter, LinkedIn, Changelog, TL;DR)

---

## 6. METADATA & ENRICHMENT

### Components

#### 6.1 Posts Table
- **Columns:** `id`, `workspaceId`, `title`, `markdown`, `aiDraftMarkdown` (initial AI output), `status`, `contentType`, `createdAt`, `updatedAt`, `hashnodeUrl`, `badgeEnabled`, `platformFooterEnabled`
- **Relationships:** workspace, workspace_member, content_trigger, automation_run, seo_metadata, conversation, revisions, performance_metrics, published_articles, supplementary_content, media, repository_links

#### 6.2 SEO Generation (`src/app/api/content/[id]/seo/generate-meta/route.ts`)
- Calls SEO generator agent
- Produces: `metaTitle`, `metaDescription`, `focusKeyword`, `additionalKeywords`, `ogTitle`, `ogDescription`, `twitterTitle`, `twitterDescription`, `twitterCard`, `schemaOrg`, `readabilityScore`, `readabilityGrade`, `seoScore`, `keywordDensity`, `suggestedKeywords`

#### 6.3 Media Generation (`src/lib/media/diagram-generator.ts`)
- Generates diagrams from markdown descriptions (using Claude)
- Creates visual aids automatically

#### 6.4 Supplementary Content (`src/app/api/content/[id]/supplementary/route.ts`)
- Generates: related code snippets, example projects, further reading links
- Stored separately and composable

#### 6.5 Revision Management (`src/app/api/content/[id]/revisions/`)
- **GET** `/route.ts`: List revisions (edit_type: user_edit, ai_generated, auto_save, restore)
- **POST** `/route.ts`: Create revision
- **POST** `/restore/route.ts`: Restore revision
- **GET** `/diff/route.ts`: View diff between revisions

#### 6.6 Performance Metrics (`src/app/api/content/[id]/performance/route.ts`)
- Fetches: views, engagement, social shares, platform-specific metrics

---

## 7. INGESTION & SOURCE MATERIAL

### Overview
Optional ingestion phase where users provide URLs, repos, and context to scaffold content generation.

### Components

#### 7.1 URL Extractor (`src/lib/ingestion/url-extractor.ts`)
- **Function:** `extractURL(url: string)`
- Fetches URL with timeout (20s)
- Parses HTML with cheerio
- Extracts: title, author, publish date, main content (50k char limit), excerpt, images (20 max), code blocks (30 max)
- Graceful fallback: returns error note if fetch fails
- **User agent:** Identifies as SessionForge bot

#### 7.2 Repository Analyzer (`src/lib/ingestion/repo-analyzer.ts`)
- **Function:** `analyzeRepoWithTimeout(repoUrl: string)` (60s timeout)
- Shallow-clones repo (depth=1) to temp dir
- Extracts:
  - Directory structure (2 levels)
  - Tech stack detection (package.json, Cargo.toml, go.mod, requirements.txt, etc.)
  - Language breakdown (file counts by extension)
  - README content (8k limit)
  - Key files (manifests, package files)
  - Relevant patterns (via Claude summary)
- Cleans up temp dir in finally block

#### 7.3 Text Processor (`src/lib/ingestion/text-processor.ts`)
- **Function:** `processUserText(text: string)`
- Extracts ContentBrief using Claude (haiku model):
  - `thesis`: Core argument
  - `keyPoints`: Up to 8 key points
  - `tone`: technical, conversational, formal, educational, persuasive, narrative
  - `audience`: Intended audience description
  - `impliedQuestions`: Up to 5 questions answered
  - `referencedConcepts`: Up to 10 concepts mentioned
- Fallback: Heuristic parsing if Claude fails

#### 7.4 Source Assembler (`src/lib/ingestion/source-assembler.ts`)
- **Function:** `assembleSourceMaterial(params)`
- Combines: user brief, external sources (URLs), repositories, session evidence
- Calls Claude (haiku) to identify cross-references:
  - Relationship types: "supports", "contradicts", "extends", "implements", "references", "related"
  - Max 15 cross-references per assembly
- Returns: `SourceMaterialPackage` with all sources + relationships

### Key Insights
- **Non-blocking ingestion:** Used only if user explicitly provides URLs/repos; pipeline works without it
- **Graceful degradation:** Failed URL fetch returns error note; repo analysis timeout captured
- **Cross-reference detection:** Claude identifies how URL, repo, and session evidence relate to each other

---

## 8. DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       AUTOMATION TRIGGER (Manual/Scheduled)                 │
└────────────────────────────────────────────┬────────────────────────────────┘
                                             ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                       executePipeline(runId, trigger)                       │
└────────────┬─────────────────────────────────────────────────┬──────────────┘
             ↓                                                   ↓
      ┌─────────────────┐                            ┌──────────────────────┐
      │  STAGE: SCAN    │                            │ STAGE: EXTRACT       │
      ├─────────────────┤                            ├──────────────────────┤
      │ • scanSessionFiles                           │ • analyzeCorpus()    │
      │ • parseSessionFile                           │ • create_insight()   │
      │ • normalizeSession                           │ • Count insights     │
      │ • indexSessions()                            │ • (non-fatal fail)   │
      │ → DB: sessions                               │ → DB: insights       │
      └────────────┬────────────────────────────────┘
                   ↓
      ┌──────────────────────────────────────────────────────┐
      │ STAGE: GENERATE (with insight context)             │
      ├──────────────────────────────────────────────────────┤
      │ • buildBriefContext(insightIds)                     │
      │ • Fetch insight rows, build narrative              │
      │ • CONTENT_CONFIG[contentType]                       │
      │   → Agent type, system prompt, user message         │
      │ • runAgent() with MCP tools:                        │
      │   - get_insight_details(id) → real code/output      │
      │   - create_post() → save post                       │
      │ • Query DB for latest post                          │
      │ → DB: posts, seo_metadata                           │
      └──────────────┬───────────────────────────────────────┘
                     ↓
      ┌──────────────────────────────────────────────────────┐
      │ STAGE: COMPLETE / FAILED                            │
      ├──────────────────────────────────────────────────────┤
      │ • Update automationRuns (status, postId, duration)  │
      │ • Update contentTriggers (lastRunAt, lastRunStatus) │
      │ • Emit webhook: automation.completed                │
      │ • Observability: instrument-pipeline events         │
      └──────────────────────────────────────────────────────┘
                     ↓
      ┌──────────────────────────────────────────────────────┐
      │ POST CREATED & STORED IN DB                         │
      ├──────────────────────────────────────────────────────┤
      │ • User can edit post in /content/[postId] page     │
      │ • Editor has AI chat, SEO, supplements, media      │
      │ • User can publish to: Hashnode, Dev.to, Ghost,    │
      │   Medium, WordPress                                 │
      │ • Revisions tracked, performance monitored          │
      └──────────────────────────────────────────────────────┘
```

---

## 9. ACTUAL IMPLEMENTATION STATUS

### Fully Implemented
✅ Scanning (session I/O, parsing, normalization, indexing)  
✅ Corpus analysis (multi-session pattern detection)  
✅ Insight creation (with scoring, cross-session evidence)  
✅ Content generation (all 7 content types)  
✅ Agent writers (blog, social, newsletter, changelog, repurpose, editor-chat)  
✅ MCP tool system (session reader, insight tools, post manager, markdown editor)  
✅ Content editor UI (split view, auto-save, templates)  
✅ Publishing integrations (Hashnode, Dev.to, Ghost, Medium, WordPress)  
✅ SEO generation (readability, keyword analysis, meta tags)  
✅ Revision management (create, restore, diff)  
✅ Supplementary content (diagrams, code snippets)  
✅ Editor chat (streaming responses)  

### Partially Implemented (Stubs/Placeholders)
⚠️ Ingestion system (URL extraction, repo analysis, text processing) — functions exist but optional
⚠️ File-watch triggers — trigger type enum supports it, but no filesystem watcher implemented
⚠️ Evidence system (Phase 2 mining) — `mine_sessions` tool exists but rarely called in automation

### Not Implemented
❌ Scheduled trigger execution (DB schema supports it, but no cron/scheduler service)  
❌ Batch operations (batch job tables exist, but no execution logic)  
❌ Webhook delivery retry logic  

---

## 10. KEY LIMITATIONS & GAPS

1. **Lossy session ID encoding:** `decodeProjectPath()` function uses `-` for both `/` and `-` in paths; can cause collisions
2. **Workspace lookup:** Uses `ownerId` instead of workspace slug in some routes; potential security issue
3. **GitHub OAuth:** Requires `BETTER_AUTH_URL` env var; missing in local dev causes crashes
4. **Redis placeholder:** `UPSTASH_REDIS_URL` env var name inconsistency
5. **No scheduled trigger execution:** Triggers defined in DB but no service to execute them
6. **Insights preserved on generation failure:** Good for safety, but means failed generation leaves orphaned insights

---

## 11. KEY FILES SUMMARY

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/automation/pipeline.ts` | 202 | Main orchestrator (scan → extract → generate) |
| `src/lib/automation/content-generator.ts` | 278 | Routes to writer agents, builds brief context |
| `src/lib/ai/agent-runner.ts` | 322 | Agent SDK wrapper, streaming & non-streaming |
| `src/lib/ai/prompts/corpus-analysis.ts` | 89 | Cross-session pattern detection prompt |
| `src/lib/ai/agents/blog-writer.ts` | 140 | Blog post generation with templates |
| `src/lib/ai/agents/social-writer.ts` | 137 | Twitter & LinkedIn post generation |
| `src/lib/ai/agents/corpus-analyzer.ts` | 68 | Orchestrates corpus analysis |
| `src/lib/ai/agents/editor-chat.ts` | 50 | Real-time editing assistance |
| `src/lib/ingestion/repo-analyzer.ts` | 334 | Shallow-clones, analyzes repos |
| `src/lib/ingestion/url-extractor.ts` | 239 | Fetches URLs, extracts content |
| `src/lib/ingestion/text-processor.ts` | 101 | Extracts structured brief from text |
| `src/lib/ingestion/source-assembler.ts` | 168 | Identifies cross-references between sources |
| `src/app/(dashboard)/[workspace]/content/[postId]/page.tsx` | 150+ | Rich editor with AI chat, SEO, publishing |
| `src/app/api/automation/runs/route.ts` | 52 | Lists automation run history |
| `packages/db/src/schema.ts` | 200+ | 30 database tables, 15+ enums |

---

## 12. UNRESOLVED QUESTIONS

1. **Session evidence mining:** When is `mine_sessions` tool actually invoked? It's registered but not called in automation pipeline.
2. **Batch operations:** Batch job tables exist in schema; are they used anywhere?
3. **Scheduled triggers:** How are scheduled/file-watch triggers supposed to be executed?
4. **Contentbases/recommendations:** These DB tables exist but no UI/agent integration found. Are they active?
5. **Style learning:** `style-learner.ts` agent exists; when is it invoked? How is the learned style persisted?

