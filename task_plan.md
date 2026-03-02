# Task Plan: Build SessionForge

## Goal
Build SessionForge — a Next.js 15 platform that mines Claude Code JSONL sessions, scores insights via 6-dimension weighted algorithm, and generates technical content through multi-agent Claude Agent SDK pipelines. Flat black developer UI, mobile-first, zero mocks.

## Current Phase
Phase 1

## Execution Graph
```
Phase 1: Foundation ──────── VG-PHASE-1 (blocking)
         ↓
Phase 2: Session Engine ──── VG-PHASE-2 (blocking)
         ↓
Phase 3: AI Agents ───────── VG-PHASE-3 (blocking)
         ↓
    ┌────┴─────┐
    ↓          ↓
Phase 4    Phase 5      ← run in parallel
Content    Dashboard
Pipeline   UI
    ↓          ↓
    └────┬─────┘
         ↓
Phase 6: Editor + AI Chat ─ VG-PHASE-6 (blocking)
         ↓
Phase 7: Full Validation ── VG-PHASE-7-FINAL (blocking)
         ═══ PROJECT COMPLETE ═══
```

## Phases

### Phase 1: Foundation
- [ ] 1.1 Initialize Turborepo monorepo with bun (apps/dashboard + packages/db + packages/tsconfig)
- [ ] 1.2 Define full DB schema in packages/db/src/schema.ts (8 tables, 6 enums, all relations/indexes per PRD §4)
- [ ] 1.3 Configure better-auth (email + GitHub OAuth), create auth routes
- [ ] 1.4 Create /api/healthcheck returning { status, db, redis, timestamp }
- [ ] 1.5 Set up flat black theme tokens in globals.css + tailwind.config.ts (PRD §10.1), create (auth) and (dashboard) layout groups
- [ ] VG-PHASE-1: Build passes, DB tables exist, healthcheck OK, auth rejects unauthenticated
- **Status:** pending
- **Gate:** VG-PHASE-1 — build, DB tables, healthcheck, auth 401

### Phase 2: Session Engine
- [ ] 2.1 Build scanner.ts (JSONL discovery), parser.ts (line-by-line), normalizer + indexer (upsert)
- [ ] 2.2 API routes: POST /api/sessions/scan, GET /api/sessions, GET /api/sessions/:id, GET /api/sessions/:id/messages
- [ ] VG-PHASE-2: Real JSONL files scanned, sessions indexed, API returns real data
- **Status:** pending
- **Gate:** VG-PHASE-2 — scan > 0, sessions list, session detail with toolsUsed

### Phase 3: AI Agents
- [ ] 3.1 Install @anthropic-ai/claude-agent-sdk, build MCP tool servers (session-reader, insight-tools, post-manager)
- [ ] 3.2 Build insight-extractor agent with 6-dimension scoring rubric
- [ ] 3.3 Build blog-writer agent with traction-aware formatting (PRD §7.2)
- [ ] VG-PHASE-3: SDK verified, insights extracted with scores, blog generated with real code
- **Status:** pending
- **Gate:** VG-PHASE-3 — SDK functions exist, insights scored, blog 500+ words with code blocks

### Phase 4: Content Pipeline (parallel with Phase 5)
- [ ] 4.1 Build social-writer agent (twitter/linkedin) + changelog-writer agent
- [ ] 4.2 Full content CRUD routes (PRD §9.6)
- [ ] 4.3 Automation triggers CRUD + QStash scheduling (PRD §9.8)
- [ ] VG-PHASE-4: Social content generated, trigger created, insights ranked
- **Status:** pending
- **Gate:** VG-PHASE-4 — twitter thread created, trigger with cron, sorted scores

### Phase 5: Dashboard UI (parallel with Phase 4)
- [ ] 5.1 App sidebar + mobile bottom nav + workspace selector
- [ ] 5.2 Dashboard home with real stat cards
- [ ] 5.3 Sessions browser + session detail pages
- [ ] 5.4 Insights page + insight detail pages
- [ ] 5.5 Content library page
- [ ] 5.6 Automation page + settings pages
- [ ] VG-PHASE-5: 15 Playwright screenshots (3 viewports x 5 pages), all dark theme, real data
- **Status:** pending
- **Gate:** VG-PHASE-5 — visual inspection at 375px, 768px, 1920px

### Phase 6: Editor & AI Chat
- [ ] 6.1 Integrate Lexical editor with markdown import/export
- [ ] 6.2 Build AI chat sidebar component with streaming
- [ ] 6.3 Build editor-chat agent (Agent SDK, SSE streaming)
- [ ] 6.4 Wire streaming responses to sidebar, apply edits to Lexical
- [ ] VG-PHASE-6: Editor loads, AI chat modifies content, DB updated
- **Status:** pending
- **Gate:** VG-PHASE-6 — Playwright interactive test, content modified via AI chat

### Phase 7: Full Validation
- [ ] 7.1 Regression sweep of all previous gates
- [ ] 7.2 Full pipeline: scan → extract → blog → social → changelog
- [ ] 7.3 Full user journey via Playwright (10 steps x 2 viewports = 20 screenshots)
- [ ] 7.4 Zero test files check
- [ ] VG-PHASE-7-FINAL: All regressions pass, pipeline produces 3+ posts, all screenshots pass
- **Status:** pending
- **Gate:** VG-PHASE-7-FINAL — regression + pipeline + user journey + zero test files

## Key Questions
1. Is `@anthropic-ai/claude-agent-sdk` available on npm with query/createSdkMcpServer/tool exports? → Research in Phase 3
2. Does better-auth support Next.js 15 App Router? → Research in Phase 1
3. Tailwind CSS 4 config syntax changes from v3? → Research in Phase 1
4. Lexical markdown plugin current API? → Research in Phase 6

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Turborepo + bun | PRD specifies monorepo with bun |
| Drizzle ORM + Neon | PRD specifies PostgreSQL via Drizzle on Neon serverless |
| better-auth | PRD specifies for email + GitHub OAuth |
| No test files | Functional validation only — real server, real browser, real data |
| Agent SDK not Anthropic SDK | PRD §8.1 mandates @anthropic-ai/claude-agent-sdk |
| Opus for complex, Haiku for routing | PRD specifies model selection |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|

## Notes
- PRD is source of truth: /Users/nick/Desktop/sessionforge/sessionforge-prd.md
- Git commit after EVERY task, not batch
- Branch strategy: main ← phase/01-foundation ← phase/02-session-engine etc.
- Context7 MCP research BEFORE each phase
- Playwright MCP for ALL visual gates
- NEVER create test files, mock data, or fixtures
