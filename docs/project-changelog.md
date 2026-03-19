# SessionForge Changelog

All notable changes to this project are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [0.5.2-alpha] - 2026-03-10

### Added

- **Unified Session Scanning + Insight Generation Pipeline** — Single "Start Analysis" entry point on Insights page that coordinates scanning, corpus analysis, and content generation
- **SSE progress streaming** for real-time pipeline stage updates (scanning → extracting → generating → complete)
- **Pipeline Progress component** with 3-stage timeline visualization and event message streaming
- **useAnalysisPipeline hook** for frontend state management and SSE connection handling
- **Enhanced corpus analysis** with cross-session pattern detection (recurring themes, skill evolution, corrections & pivots, breakthroughs, failure recovery arcs)
- **Content angle requirements** for corpus insights (tutorial, case study, deep dive, comparison, lessons learned format)
- **Temporal awareness** in corpus analysis (frequency trends, recency bias, clustering, evolution arcs)
- **Audience signal detection** in corpus insights (beginner-friendly, intermediate, advanced)
- **Quality gate scoring** with 6 weighted dimensions (novelty×3, tool_discovery×3, before_after×2, failure_recovery×3, reproducibility×1, scale×1) — threshold >= 15 composite score
- **Manual analysis trigger** from Insights page with configurable lookback window (default 90 days)
- **Unified ARCHITECTURE.md** documenting pipeline stages, frontend integration, and quality gate scoring

### Changed

- POST `/api/pipeline/analyze` now primary entry point for session analysis (replaces separate scan + extract routes)
- Pipeline runs created with `source: "manual"` for UI-triggered analysis
- Corpus analyzer now enforces strict turn budgets: Phase 1 (1-2 turns), Phase 2 (5-8 turns), Phase 3 (remaining turns for insights)
- lookbackWindowToDays() now supports `all_time` window (36500 days)

### Fixed

- Templates API 500 error with graceful fallback to built-in templates
- Style API defaults for missing workspace settings
- Dark-mode-only theme lock preventing light-mode selection

### Verified

- Full functional audit: 10 screens, 12 screenshots
- Content editor with AI chat, split view, SEO tab, evidence tab, media generation
- Pipeline UI with real-time progress visualization
- All core pages responsive on mobile

---

## [0.5.1-alpha] - 2026-03-07

### Added

- All-time session lookback option for automation triggers
- Hero image support in content generation pipeline
- Batch generate action from automation page
- QStash signature verification for webhook security
- Observable pipeline runs with real-time status cards

### Changed

- 7-phase codebase overhaul: dashboard redesign, nav consolidation, page decomposition
- Content page decomposed from 471 to 252 lines (ExportPanel, ContentListView, CalendarView extracted)
- Observability page uses shared `pipeline-status.ts` module (129 to 88 lines)
- Mobile bottom nav consolidated to 5 items with "More" sheet for secondary pages
- Middleware redirects for legacy routes: `/series` -> `/content?filter=series`, `/collections` -> `/content?filter=collections`, `/recommendations` -> `/insights`

### Fixed

- Audit bugs resolved and free-tier paywall removed
- Build errors resolved across all merged worktree branches
- Schema aligned with live database (missing enum values and relations added)

---

## [0.5.0-alpha] - 2026-03-05

### Added

- **Twitter/X integration** with OAuth PKCE flow
- **LinkedIn integration** with OAuth 2.0
- **Medium publishing** with OAuth, publish modal, and editor button
- **GitHub repository deep integration** with context tools for changelog-writer
- **Social media engagement analytics** dashboard with cross-platform metrics
- **Content scheduling and publish queue** via QStash
- **Batch operations** for sessions and insights
- **AI content calendar intelligence** with suggested publishing slots
- **Content series and collections** with ordering and public sharing
- **SEO/GEO optimization engine**: readability scoring (Flesch-Kincaid), keyword extraction, structured data (JSON-LD), GEO checklist, meta tag generation, SEO preview cards
- **Content performance recommendations** with AI-powered analyzer
- **Static site export** for GitHub Pages
- SEO score badge on content list
- Auto-analyze on content save
- Structured data in HTML export
- Collection post ordering by custom field

### Fixed

- GEO score display and checklist rendering in SEO panel
- SeoPanel auto-refresh on save via refreshKey prop
- GitHub context tools registered in MCP server factory
- Insight category used for topic analysis (was using wrong field)
- Medium user ID storage and publishing flow
- Merge conflict markers in migration files
- Usage metering and ETA display in batch operations

---

## [0.4.0-alpha] - 2026-03-04

### Added

- **Content templates library** with 8 built-in templates (How I Built X, Debugging Story, Tool Comparison, Architecture Decision, TIL, Dev Log, Release Notes, Tutorial)
- Custom template creation dialog
- Template selection in insight detail and content generation
- Workspace template defaults API
- **Remote session ingestion** via JSONL file upload (drag-and-drop, ZIP support)
- Upload history section in Settings
- **Public v1 API** with API key authentication (9 endpoints)
- **Content recommendations** page with AI analyzer and rating system
- **Performance metrics** tracking (record, retrieve per-post and workspace-wide)
- Post performance metrics table in schema

### Changed

- Blog writer agent updated to accept and use template parameter
- Other writer agents updated for template support

---

## [0.3.0-alpha] - 2026-03-02

### Added

- **Ghost CMS publishing** integration
- **Mobile responsive dashboard** with bottom navigation
- **Onboarding flow** with completed flag on users table
- **Session bookmarks** for marking important sessions
- **Automation runs** table and tracking
- **QStash scheduling** for content triggers
- **Content generator** automation library
- **Export dropdown** (Copy Markdown, Copy HTML, Download .md)
- **Skills system** with CRUD API and import routes
- Toast notification UI component
- Syntax highlighting with react-syntax-highlighter
- Diff view support

---

## [0.2.0-alpha] - 2026-03-02

### Added

- **Lexical rich text editor** with markdown import/export
- **AI chat sidebar** with SSE streaming and tool-use visualization
- **Split view** editor mode (side-by-side editor + rendered preview)
- Dashboard UI: sidebar navigation, all core pages
- Sessions page with search and filtering
- Insights page with ranked insights
- Content library with list view
- Automation page with trigger management
- Settings page (workspace, integrations, webhooks)

---

## [0.1.0-alpha] - 2026-03-02

**Milestone:** Project converged from 2 worktree branches (015-citations + 021-portfolio). All features integrated and containerized.

### Foundation

- **Monorepo:** Turborepo + Bun workspaces (apps/dashboard, packages/db, packages/tsconfig)
- **Containerization:** 3-stage Docker build (deps → builder → runner), docker-compose with PostgreSQL 16
- **Database:** PostgreSQL via Drizzle ORM — 63 tables, 50+ enums, cross-workspace relations
- **Authentication:** better-auth (email + password, GitHub OAuth, OAuth2 for integrations)

### Session Intelligence

- **Scanning pipeline:** Scanner → Parser → Normalizer → Indexer (local JSONL from `~/.claude/projects/` and `~/.claude/sessions/`)
- **SSH session discovery:** Remote session ingestion via SSH key-based auth
- **Session upload:** Drag-drop JSONL and ZIP file support
- **Session indexing:** Idempotent upsert with `(workspaceId, sessionId)` conflict key

### AI Content Generation

- **Agent SDK:** `@anthropic-ai/claude-agent-sdk` with CLI-inherited auth (zero API keys)
- **12 AI agents:** Blog writer, social writer, changelog, newsletter, repurpose, editor-chat, insight extractor, style learner, strategist, corpus analyzer, recommendations analyzer, evidence classifier
- **Tool registry:** Per-agent access control (session, insight, post, markdown, skill tools)
- **SSE streaming:** Real-time tool-use visualization and partial content rendering in editor
- **Agentic loops:** Multi-turn tool-use with MCP server integration

### Insight Extraction

- **Corpus analysis:** Cross-session pattern detection (novel problems, tool patterns, transformations, failure recovery)
- **Composite scoring:** 6-dimension weighted ranking (novelty×3, tool_discovery×3, before_after×2, failure_recovery×3, reproducibility×1, scale×1)
- **Quality gate:** Insights filtered by composite score threshold (≥15)
- **Temporal awareness:** Frequency trends, recency bias, clustering, evolution arcs

### Content Lifecycle

- **Status workflow:** draft → published / archived / in_review / scheduled / idea
- **Revisions:** Track post edit history with diffs and restore capability
- **Evidence system:** Cite source sessions and link work to posts
- **Calendar view:** Monthly grid with post publishing dates
- **Pipeline view:** Kanban board with status columns

### Publishing Integrations

- **Token-based:** Hashnode, Dev.to, Medium, Ghost, WordPress
- **OAuth:** GitHub, Twitter/X (PKCE), LinkedIn
- **Multi-platform:** Publish blog to Hashnode + Dev.to simultaneously
- **Social posting:** Threads to Twitter, LinkedIn posts

### Content Intelligence

- **SEO/GEO analysis:** Readability scoring (Flesch-Kincaid), keyword extraction, structured data (JSON-LD), meta tag generation
- **Recommendations:** AI-powered content performance analyzer
- **Series & collections:** Organize posts, custom ordering, public sharing
- **Templates:** 8 built-in content templates (How I Built X, Debugging Story, Tool Comparison, etc.)

### Public API

- **v1 endpoints:** 9 public routes with API key authentication
- **Webhooks:** Outbound webhooks for automation events
- **Content export:** Copy Markdown, Copy HTML, Download .md
- **Series/collection export:** Bulk export capability

### Automation & Observability

- **QStash scheduling:** Publish queue, automation trigger execution, cron integration (5-min automation runner)
- **Pipeline runs:** Track end-to-end automation with granular status (pending → scanning → extracting → generating → complete)
- **Observability:** Real-time SSE event stream, historical event queries, pipeline visualization
- **Usage metering:** Track API calls, session scans, content generations

### Dashboard UI

- **Pages (9):** Dashboard, Sessions, Insights, Content (list/calendar/pipeline), Analytics, Automation, Observability, Settings
- **Navigation:** Desktop sidebar + mobile bottom nav (5 items + More sheet)
- **Editor:** Lexical rich text with markdown import/export, split view, SEO/evidence/media/repo tabs
- **AI chat:** Sidebar panel with SSE streaming, tool-use visualization, live markdown edits
- **Responsive:** Full mobile support with touch-friendly interactions

### Developer Portfolio

- **Public pages:** Profile, blog feed, content showcase (per-workspace public URLs)
- **Static export:** GitHub Pages export with SPA routing
- **RSS/Atom feeds:** Public content feed for each workspace
- **Custom domain:** Portfolio accessible at user's domain

### DDD Patterns

- **Workspace domain:** Multi-user isolation, session scoping, resource ownership
- **Content domain:** Post lifecycle, versioning, publishing state machine
- **Insight domain:** Pattern extraction, quality scoring, evidence linking
- **Integration domain:** Multi-platform credential management, OAuth flow orchestration
- **Automation domain:** Trigger management, pipeline execution, event broadcasting

### Shared Infrastructure

- **Cache:** Upstash Redis for scan results, rate limiting, session caching
- **Queue:** Upstash QStash for scheduled publishing and automation
- **Billing:** Stripe integration with 3 tiers (Solo, Pro, Team)
- **Error handling:** Comprehensive validation, user-friendly error messages, detailed server logs
- **Monitoring:** Health checks, performance metrics per post, usage analytics

### Tech Stack

- **Frontend:** Next.js 15 (App Router) + React 19 + Tailwind CSS 4 + shadcn/ui
- **Editor:** Lexical rich text engine
- **State:** TanStack Query v5 (server), React Context (client)
- **Database:** PostgreSQL serverless (Neon) + Drizzle ORM
- **Deployment:** Vercel (frontend + serverless API), Docker (self-hosted option)
- **Styling:** Flat-black design tokens, responsive Tailwind utilities
- **Code quality:** TypeScript strict mode, named exports, 200-400 line file size targets
