# Changelog

## [0.5.0-alpha] - 2026-03-05

### Features

**Content Scheduling & Calendar (worktree 002)**
- Monthly calendar view with posts on dates
- Pipeline/kanban view (Idea / Draft / In Review / Published columns)
- Publish queue with scheduled publication management
- Publishing streak tracking (consecutive days)
- Post status workflow: idea -> draft -> in_review -> scheduled -> published -> archived

**Medium Publishing Integration (worktree 003)**
- Medium integration card in Settings > Integrations
- "Publish to Medium" button in content editor
- Integration token authentication

**Batch Operations (worktree 004)**
- Per-post Export button on content list
- Bulk export dropdown (Markdown, HTML, ZIP)

**AI Calendar Intelligence (worktree 008)**
- AI-suggested time slots on calendar view
- Automation trigger management page
- Cron-based scheduled content generation via QStash

**Series & Collections (worktree 009)**
- Content series with ordered posts
- Thematic collections for grouping related content
- Series and Collections pages with CRUD operations

**Social Media Analytics (worktree 010)**
- Social Analytics dashboard with 5 metric cards (Impressions, Likes, Shares, Comments, Clicks)
- Engagement Trend chart with 7d/30d/90d time ranges
- Twitter integration with OAuth 2.0 PKCE flow
- LinkedIn integration with OAuth 2.0 flow
- Integration cards for Twitter and LinkedIn in Settings

**AI Content Recommendations (worktree 011)**
- Recommendations page with AI-powered content suggestions
- "Generate New" button for on-demand recommendations

**SEO/GEO Optimization (worktree 014)**
- SEO tab in content editor with score (0-100)
- 8-item SEO checklist
- Readability score
- Meta tag generation (title, description, keywords)

### Database Changes
- Added `idea`, `in_review`, `scheduled` to post_status enum
- Added `scheduledPublicationsRelations` with workspace and post relations
- Renamed `ghost_integrations.api_url` to `ghost_url`
- Renamed `github_integrations.username` to `github_username`
- Renamed `scheduled_publications.platform` to `platforms`
- Renamed `scheduled_publications.error_message` to `error`
- Total tables: 59

### Infrastructure
- AI SDK migrated from `@anthropic-ai/sdk` to `@anthropic-ai/claude-agent-sdk` (CLI-inherited auth, zero API keys)
- All 12 SDK files patched with `delete process.env.CLAUDECODE` for dev server compatibility
- RSS/Atom feed endpoints per workspace
- Writing skills management page
- Webhooks management page
- WordPress integration settings page

---

## [0.1.0-alpha] - 2026-03-04

### Features

- **Content Editor** -- Lexical-based rich text editor with three view modes (edit, split, preview)
- **Inline Edit Controls** -- Quick-action buttons (Make Longer, Make Shorter, Improve Clarity) and target length presets
- **AI Chat Sidebar** -- Streaming AI assistant for interactive content editing with conversation persistence
- **Session Scanner** -- Discovers and indexes Claude Code JSONL session files
- **Insight Extractor** -- 6-dimension weighted scoring algorithm for identifying publishable content
- **Content Generation** -- Blog posts, Twitter threads, LinkedIn posts, changelogs, newsletters
- **Evidence-Based Writing** -- Content sourced from real session transcripts with citation links
- **Revision History** -- Full version tracking with diff comparison and restore
- **Media Pipeline** -- Mermaid diagram generation from content
- **Repository Panel** -- Asset inventory and revision browser
- **Publishing Integrations** -- Hashnode, WordPress, Dev.to
- **Automation** -- Scheduled content generation via QStash triggers
- **Content Ingestion** -- External URL and repository content ingestion
- **Export** -- Markdown, HTML, and packaged ZIP export
- **Docker Support** -- Multi-stage Dockerfile with Docker Compose for local and production
- **Vercel Config** -- Deployment configuration with extended function timeouts
- **CI Pipeline** -- GitHub Actions with lint, type check, build, and Docker build verification

### Architecture

- Monorepo with Turborepo + Bun workspaces
- Next.js 15 App Router with 76+ API routes
- PostgreSQL via Neon with 30+ Drizzle ORM tables
- AI via `@anthropic-ai/claude-agent-sdk` (CLI-inherited auth, zero API keys)
- Graceful AI degradation via `DISABLE_AI_AGENTS` environment variable
