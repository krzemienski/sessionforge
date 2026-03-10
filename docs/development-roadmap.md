# SessionForge Development Roadmap

**Version:** 0.5.1-alpha
**Updated:** 2026-03-09

---

## Vision

SessionForge transforms Claude Code session transcripts into polished, multi-format content — blog posts, social threads, newsletters, and changelogs — using AI agents, automated pipelines, and one-click publishing to 7 platforms.

---

## Completed Phases

### Phase 1: Foundation (2026-03-02)

- Turborepo monorepo with Bun
- PostgreSQL schema via Drizzle ORM (initial 30+ tables)
- better-auth integration (email + GitHub OAuth)
- Flat-black design tokens and layout groups
- Health check endpoint

### Phase 2: Session Engine (2026-03-02)

- Local JSONL scanner (`~/.claude/projects/` and `~/.claude/sessions/`)
- 4-stage pipeline: Scanner -> Parser -> Normalizer -> Indexer
- Idempotent upsert with `(workspaceId, sessionId)` conflict key
- Session browser page with search and filtering

### Phase 3: AI Agent Layer (2026-03-02)

- `@anthropic-ai/claude-agent-sdk` integration (zero API keys)
- Tool registry pattern for per-agent access control
- 6 content agents: blog, social, changelog, newsletter, repurpose, editor-chat
- Insight extractor with 6-dimension weighted scoring
- SSE streaming for real-time content generation
- MCP server factory for agent tool provisioning

### Phase 4: Dashboard UI (2026-03-02)

- Sidebar navigation (Desktop) + bottom nav (Mobile)
- Dashboard, Sessions, Insights, Content, Automation, Settings pages
- TanStack Query v5 for server state management
- shadcn/ui component library

### Phase 5: Content Editor (2026-03-02)

- Lexical rich text editor with markdown import/export
- AI chat sidebar with SSE streaming and tool-use visualization
- Split view (editor + rendered preview)
- Revision history and export (Markdown, HTML)

### Phase 6: Content Templates (2026-03-02 - 2026-03-04)

- Template type system (How I Built X, Debugging Story, Tool Comparison, etc.)
- Built-in template library with 8 templates
- Custom template creation
- Template selector in content generation flow
- Workspace template defaults

### Phase 7: Remote Session Ingestion (2026-03-02 - 2026-03-04)

- JSONL file upload via drag-and-drop on Sessions page
- ZIP file extraction and bulk processing
- Upload history tracking in Settings
- Public v1 API with API key authentication (9 endpoints)

### Phase 8: Publishing Integrations (2026-03-04 - 2026-03-05)

- Token-based: Hashnode, Dev.to, Medium, Ghost, WordPress
- OAuth-based: GitHub, Twitter/X (PKCE), LinkedIn
- Integration settings page with connection status cards
- One-click publish from editor

### Phase 9: Content Intelligence (2026-03-04 - 2026-03-05)

- SEO/GEO optimization engine (readability scoring, keyword extraction, meta generation)
- Content performance recommendations with AI analyzer
- Series and Collections for organizing related content
- Content scheduling and publish queue via QStash
- AI content calendar intelligence
- Social media engagement analytics dashboard

### Phase 10: Codebase Overhaul (2026-03-06)

- 7-phase cleanup: dashboard redesign, nav consolidation, page decomposition
- Pipeline/Observability page with flow visualization
- Mobile bottom nav with "More" sheet for secondary pages
- Content page decomposed into focused components (471 -> 252 lines)
- Middleware redirects for legacy routes (series, collections, recommendations)
- Shared modules extracted (pipeline-status, content-constants)

### Phase 11: Pipeline Completion (2026-03-07)

- All-time session lookback for automation triggers
- Hero image support in content generation
- Batch generate from automation page
- QStash signature verification for webhook security
- Observable pipeline runs with real-time status updates

---

## Current State

| Metric | Count |
|--------|-------|
| Dashboard pages | 21 |
| API routes (internal) | 148 |
| Public v1 API routes | 9 |
| Database tables | 62 |
| AI agents | 12 |
| Publishing integrations | 7 platforms |
| Content types | 7 |

### Pages

Dashboard, Sessions, Insights, Content (list/calendar/pipeline views), Analytics, Automation, Observability (Pipeline), Settings (General, Style, API Keys, Integrations, Sources, Webhooks, WordPress)

### AI Agents

blog-writer, social-writer, changelog-writer, newsletter-writer, repurpose-writer, editor-chat, insight-extractor, content-strategist, corpus-analyzer, recommendations-analyzer, style-learner, evidence-writer

---

## Known Issues / Technical Debt

| Issue | Severity | Description |
|-------|----------|-------------|
| `decodeProjectPath` lossy encoding | CRITICAL | `/` and `-` both encode to `-`, causing ambiguous path resolution |
| Workspace lookup by ownerId | MEDIUM | Should use slug instead of ownerId for workspace resolution |
| GitHub OAuth assertions | MEDIUM | Crashes without env vars configured |
| BETTER_AUTH_URL missing | HIGH | OAuth callbacks fail without this env var |
| Redis env var mismatch | MEDIUM | `UPSTASH_REDIS_REST_URL` vs `UPSTASH_REDIS_URL` inconsistency |
| Turbopack incompatibility | LOW | drizzle-orm relations resolve to undefined under Turbopack; use `next dev` without `--turbopack` |
| drizzle-kit push hangs | LOW | Interactive prompts for new enums; use direct SQL ALTER TABLE as workaround |

---

## Future Priorities

### Short-Term

- Fix critical `decodeProjectPath` encoding bug
- Resolve workspace lookup to use slug consistently
- Add BETTER_AUTH_URL to deployment configuration
- Standardize Redis env var naming

### Medium-Term

- WordPress publishing integration (UI wiring — backend exists)
- Webhook delivery for external consumers
- Content analytics dashboard with cross-platform metrics
- Bulk content operations (archive, delete, status change)
- RSS/Atom feed customization per series/collection

### Long-Term

- Multi-user workspace collaboration (member roles defined in schema)
- Self-hosted deployment option (Docker Compose exists)
- Plugin system for custom content types and agents
- Content A/B testing with engagement tracking
- GitHub Pages static site export (backend exists, UI pending)

---

## Version History

| Version | Date | Milestone |
|---------|------|-----------|
| v0.1.0-alpha | 2026-03-02 | Initial project structure and core pipeline |
| v0.5.0-alpha | 2026-03-05 | Feature-complete alpha with 7 integrations |
| v0.5.1-alpha | 2026-03-07 | Pipeline completion, codebase overhaul |
