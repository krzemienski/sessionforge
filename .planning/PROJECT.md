# SessionForge — v0.1.0-alpha Release

## What This Is

SessionForge is a content pipeline platform that ingests Claude Code session JSONL files, extracts insights, and generates multi-format content (blog posts, social threads, newsletters, changelogs) using AI agents built on `@anthropic-ai/claude-agent-sdk`. It features a Lexical rich text editor with live AI chat, publishing integrations (Hashnode, WordPress, Dev.to), and a public v1 REST API. This milestone takes the existing brownfield codebase — with 10 active feature worktrees, 30+ tables, 76+ API routes, and 6 AI agents — and converges, containerizes, deploys, documents, and validates it as a production-ready alpha release.

## Core Value

Every feature branch merged cleanly into main, the full stack running identically in local Docker and Vercel production, and 50+ features proven functional end-to-end — nothing ships unvalidated.

## Requirements

### Validated

- ✓ Claude session JSONL ingestion and metadata extraction — existing
- ✓ AI content generation via 6 agents (blog, social, newsletter, changelog, repurpose, editor-chat) — existing
- ✓ Lexical rich text editor with split/preview modes — existing
- ✓ Live AI chat panel with streaming tool use in editor — existing
- ✓ SEO analysis with readability scoring and checklist — existing
- ✓ Content publishing to Hashnode, WordPress, Dev.to — existing
- ✓ Public v1 REST API with Bearer token auth (9 routes) — existing
- ✓ Webhook delivery with HMAC-SHA256 signing — existing
- ✓ Better Auth email/password + GitHub OAuth — existing
- ✓ Workspace-scoped multi-tenant architecture — existing
- ✓ Pipeline observability with flow visualization — existing
- ✓ Mobile-responsive dashboard with bottom nav — existing
- ✓ Content calendar and pipeline views — existing
- ✓ Session insights extraction and display — existing
- ✓ Stripe billing with 3-tier pricing (Solo/Pro/Team) — existing
- ✓ Drizzle ORM with 30+ table schema on Neon Postgres — existing

### Active

- [ ] Full audit of all 41 spec implementations (verify 001-030 merged correctly)
- [ ] Converge 10 remaining worktrees (031-041) into main with per-merge validation
- [ ] Post editing controls: make longer/shorter, free-text feedback, length presets
- [ ] Edit history preservation with revert capability
- [ ] Full Docker containerization with multi-stage builds
- [ ] docker compose up zero-step local dev with local Postgres
- [ ] Production deployment to Vercel with Neon Postgres
- [ ] GitHub Actions CI pipeline (lint, build, container verification)
- [ ] 50+ features validated end-to-end in both local Docker and Vercel production
- [ ] Comprehensive documentation (README, ARCHITECTURE, DEPLOYMENT, CONTRIBUTING, CHANGELOG, TOOLING)
- [ ] v0.1.0-alpha git tag and release

### Out of Scope

- Multi-cloud deployment configs (AWS ECS, GCP Cloud Run, Fly.io) — document container portability but don't implement provider-specific configs
- New AI agents or content types — this milestone ships what exists, validated
- Performance optimization or caching layer — alpha release focuses on correctness
- E2E test framework (Playwright/Cypress) — functional validation through real UI per project mandate
- Paid feature gating enforcement — billing UI exists but enforcement deferred

## Context

**Brownfield state:** The codebase has 31 feature specs (001-041 with gaps). Specs 001-030 appear merged into main already. 10 active worktrees remain for specs 031-041, each with implementation work on separate branches. The .auto-claude/ directory manages specs and task tracking.

**Active worktrees (031-041):**
- 031: A/B headline and hook experimentation
- 032: Compliance billing trust center
- 034: Voice calibration authentic content engine
- 035: Content versioning visual diff view
- 036: Series collection advanced filtering
- 037: WCAG accessibility compliance
- 038: Comprehensive test coverage expansion
- 039: Structured data rich snippet optimization
- 040: AI content repurposing engine
- 041: Mobile responsive dashboard experience

**Tech stack (locked):**
- TypeScript 5.7 / React 19 / Next.js 15.1 (App Router, standalone output)
- Bun 1.2.4 (package manager) / Turbo 2.x (monorepo orchestration)
- Drizzle ORM 0.39 on Neon Postgres (@neondatabase/serverless)
- Better Auth 1.2 / Lexical 0.41 / Zustand 5.0 / TanStack Query 5.90
- @anthropic-ai/claude-agent-sdk 0.2.63 (AI — inherits auth from Claude CLI, zero API keys)
- Stripe for billing / Upstash Redis placeholders

**Known bugs (pre-existing):**
- decodeProjectPath lossy encoding (/ and - both encode to -)
- Workspace lookup uses ownerId instead of slug
- GitHub OAuth assertions crash without env vars
- BETTER_AUTH_URL missing for OAuth callbacks
- Redis env var mismatch (UPSTASH_REDIS_REST_URL vs UPSTASH_REDIS_URL)

**AI architecture critical note:** The Agent SDK's `query()` function inherits auth from the Claude CLI — ZERO API keys. Must `delete process.env.CLAUDECODE` before any `query()` call in dev. All 12 SDK files already have this fix.

## Constraints

- **No mocks**: NEVER write test files, mocks, or stubs — build and run the real system, validate through actual UI
- **Agent SDK auth**: Claude Agent SDK inherits from CLI session — no ANTHROPIC_API_KEY, no alternative SDKs
- **Dev server**: Use `next dev` (NOT --turbopack) — Turbopack has drizzle-orm relation bugs in bun monorepos
- **Merge safety**: One merge at a time, validate after each, never force-push to main
- **Container portability**: No provider-specific code inside containers — all specifics in env vars
- **Schema parity**: Local Docker Postgres must use identical schema to Neon production

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Docker + Vercel equally prioritized | Cloud-agnostic portability AND optimized serverless deployment | — Pending |
| Full audit before convergence | Specs 001-030 may have gaps; verify before adding more | — Pending |
| Strict 50+ feature validation | Alpha release must be proven correct, not assumed correct | — Pending |
| Preserve .auto-claude/specs/ | Specs are project documentation, not disposable | — Pending |
| Sequential merge (not batch) | Reduces conflict risk, enables per-merge rollback | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-22 after initialization*
