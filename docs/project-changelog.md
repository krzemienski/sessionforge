# SessionForge Changelog

All notable changes to this project are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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

### Added

- Turborepo monorepo with Bun package manager
- PostgreSQL schema via Drizzle ORM (30+ tables, enums, relations)
- better-auth integration (email + password, GitHub OAuth)
- Session scanning pipeline: Scanner -> Parser -> Normalizer -> Indexer
- Local JSONL ingestion from `~/.claude/projects/` and `~/.claude/sessions/`
- AI agent layer with `@anthropic-ai/claude-agent-sdk` (zero API keys)
- 6 content agents: blog-writer, social-writer, changelog-writer, newsletter-writer, repurpose-writer, editor-chat
- Insight extractor with 6-dimension weighted scoring
- Tool registry pattern for per-agent access control
- SSE streaming for content generation
- Hashnode and Dev.to publishing integrations
- Health check endpoint
- Flat-black design tokens
