# Changelog

## [0.1.0-alpha] - 2026-03-04

### Features

- **Content Editor** — Lexical-based rich text editor with three view modes (edit, split, preview)
- **Inline Edit Controls** — Quick-action buttons (Make Longer, Make Shorter, Improve Clarity) and target length presets
- **AI Chat Sidebar** — Streaming AI assistant for interactive content editing with conversation persistence
- **Session Scanner** — Discovers and indexes Claude Code JSONL session files
- **Insight Extractor** — 6-dimension weighted scoring algorithm for identifying publishable content
- **Content Generation** — Blog posts, Twitter threads, LinkedIn posts, changelogs, newsletters
- **Evidence-Based Writing** — Content sourced from real session transcripts with citation links
- **SEO Panel** — Readability scoring, keyword analysis, and metadata generation
- **Revision History** — Full version tracking with diff comparison and restore
- **Media Pipeline** — Mermaid diagram generation from content
- **Repository Panel** — Asset inventory and revision browser
- **Publishing Integrations** — Hashnode, WordPress, Dev.to
- **Automation** — Scheduled content generation via QStash triggers
- **Content Ingestion** — External URL and repository content ingestion
- **Export** — Markdown, HTML, and packaged ZIP export
- **Docker Support** — Multi-stage Dockerfile with Docker Compose for local and production
- **Vercel Config** — Deployment configuration with extended function timeouts
- **CI Pipeline** — GitHub Actions with lint, type check, build, and Docker build verification

### Architecture

- Monorepo with Turborepo + Bun workspaces
- Next.js 15 App Router with 76+ API routes
- PostgreSQL via Neon with 30+ Drizzle ORM tables
- AI via `@anthropic-ai/claude-agent-sdk` (CLI-inherited auth, zero API keys)
- Graceful AI degradation via `DISABLE_AI_AGENTS` environment variable
