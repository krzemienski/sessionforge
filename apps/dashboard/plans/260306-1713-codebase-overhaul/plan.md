# SessionForge Dashboard — Codebase Overhaul Plan

**Created:** 2026-03-06
**Completed:** 2026-03-06
**Scope:** Full codebase audit, architecture mapping, UX overhaul, consolidation, observability simplification
**Priority:** HIGH
**Status:** COMPLETED
**Progress:** 100%

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    SessionForge Dashboard                     │
│                   (Next.js App Router + React)                │
├─────────────┬──────────────┬──────────────┬─────────────────┤
│   AUTH      │  DASHBOARD   │  SETTINGS    │   PUBLIC API    │
│  (Better    │  (11 pages)  │  (7 pages)   │   (v1/ routes)  │
│   Auth)     │              │              │                 │
├─────────────┴──────────────┴──────────────┴─────────────────┤
│                      API Layer (140+ routes)                  │
├──────────┬──────────┬───────────┬──────────┬────────────────┤
│ Sessions │ Content  │ Agents    │ Automate │ Integrations   │
│ (scan,   │ (CRUD,   │ (10 AI    │ (triggers│ (Hashnode,     │
│  parse,  │  editor, │  agents   │  cron,   │  WordPress,    │
│  index)  │  export) │  via SDK) │  runs)   │  Dev.to, etc.) │
├──────────┴──────────┴───────────┴──────────┴────────────────┤
│                   Lib Layer (src/lib/)                        │
│  ai/ · automation/ · sessions/ · observability/ · billing/   │
│  seo/ · media/ · ingestion/ · publishing/ · export/          │
│  integrations/ · social/ · queue/ · templates/ · style/      │
├─────────────────────────────────────────────────────────────┤
│              Database (PostgreSQL/Neon — Drizzle ORM)         │
│              47 tables · 27 enums · Multi-tenant              │
├─────────────────────────────────────────────────────────────┤
│   Redis (Upstash)  │  QStash (Queue)  │  Stripe (Billing)   │
└─────────────────────────────────────────────────────────────┘
```

### Content Generation Pipeline

```
Claude Sessions (.jsonl files on disk)
       │
       ▼
  ┌─────────┐    Scanner → Parser → Normalizer → Indexer
  │  SCAN   │    Walks ~/.claude/projects/*/sessions/
  │         │    Extracts: messages, tools, files, errors, cost
  └────┬────┘    Upserts into claudeSessions table
       │
       ▼
  ┌─────────┐    Corpus Analyzer Agent (Opus)
  │ EXTRACT │    Reads all sessions via MCP tools
  │         │    Identifies cross-session patterns
  └────┬────┘    Creates insights (scored 0-65)
       │
       ▼
  ┌─────────┐    Writer Agent (blog/social/changelog/newsletter)
  │GENERATE │    Receives: briefContext (corpus + insights narrative)
  │         │    Writes content via createPost MCP tool
  └────┬────┘    Updates automationRuns with postId
       │
       ▼
  ┌─────────┐
  │ PUBLISH │    Hashnode, WordPress, Dev.to, Ghost, Medium
  └─────────┘    RSS/Atom feeds, Static site export
```

---

## Current Page Inventory (20 pages)

| # | Page | Purpose | Verdict |
|---|------|---------|---------|
| 1 | Dashboard Home | Stats overview, scan button | KEEP — simplify, add activity log |
| 2 | Sessions | Imported Claude sessions list | KEEP |
| 3 | Insights | Extracted patterns from sessions | KEEP |
| 4 | Content | Posts list (calendar/pipeline/list views) | KEEP |
| 5 | Content Editor | Full Lexical editor + AI chat | KEEP |
| 6 | Series | Sequential post grouping | MERGE → Content |
| 7 | Analytics | Social media metrics | KEEP — expand |
| 8 | Collections | Thematic post grouping | MERGE → Content |
| 9 | Recommendations | Content topic suggestions | MERGE → Insights |
| 10 | Automation | Triggers, cron, execution history | KEEP — simplify |
| 11 | Observability | React Flow graph + event log | SIMPLIFY → Activity Log on Dashboard |
| 12 | Settings | Workspace config | KEEP |
| 13 | Settings/Style | Writing style profile | KEEP as tab |
| 14 | Settings/API Keys | API key management | KEEP as tab |
| 15 | Settings/Integrations | Platform connections | KEEP as tab |
| 16 | Settings/Skills | Custom skills config | KEEP as tab |
| 17 | Settings/Webhooks | Webhook management | KEEP as tab |
| 18 | Settings/WordPress | WordPress config | MERGE → Integrations |
| 19 | Login | Email/password auth | KEEP |
| 20 | Signup | Registration | KEEP |

---

## Phases

| Phase | Title | Priority | Status |
|-------|-------|----------|--------|
| 01 | [E2E Bug Fixes](phase-01-e2e-fixes.md) | CRITICAL | ✓ COMPLETED |
| 02 | [Dashboard Overhaul — Activity Log First](phase-02-dashboard-overhaul.md) | HIGH | ✓ COMPLETED |
| 03 | [Navigation Consolidation](phase-03-nav-consolidation.md) | HIGH | ✓ COMPLETED |
| 04 | [Observability Simplification](phase-04-observability-simplification.md) | HIGH | ✓ COMPLETED |
| 05 | [UX Polish & Improvements](phase-05-ux-polish.md) | MEDIUM | ✓ COMPLETED |
| 06 | [Code Deduplication & Cleanup](phase-06-code-cleanup.md) | MEDIUM | ✓ COMPLETED |
| 07 | [Functional Validation](phase-07-validation.md) | HIGH | ✓ COMPLETED |

---

## Skill Invocation Strategy

**Every phase** invokes `/gate-validation-discipline` — no phase is marked complete without personally examined evidence.

**Mandate**: `/functional-validation` applies to the ENTIRE plan. No mocks, no stubs, no test files. Build and run the real system. Validate through actual UI via Playwright MCP. Capture screenshots as evidence.

| Skill Category | Skills | Phases |
|----------------|--------|--------|
| **Validation (ALL)** | `gate-validation-discipline` | 01-07 |
| **Validation (Final)** | `functional-validation`, `e2e-validate`, `full-functional-audit`, `no-mocking-validation-gates` | 07 |
| **UI/UX** | `ui-ux-pro-max`, `frontend-design`, `shadcn-ui`, `react-best-practices`, `ui-styling`, `ui-review-tahoe`, `design-exploration` | 02, 03, 05 |
| **Debugging** | `debug`, `sequential-thinking` | 01 |
| **Refactoring** | `code-refactoring`, `code-analyzer` | 04, 06 |
| **Review** | `code-review` | 01-07 |
| **Documentation** | `documentation-management`, `code-complete-docs` | 07 |

See each phase file for specific invocation timing.

---

## Key Decisions

1. **Observability → Activity Log**: Replace complex React Flow graph with simple activity log showing recent agent runs, pipeline events, and system status. This becomes the first thing on the Dashboard.
2. **Merge Series + Collections → Content page**: Both are grouping mechanisms. Add tabs/filters to Content page instead.
3. **Merge Recommendations → Insights**: Content suggestions belong with insights, not as a separate page.
4. **WordPress settings → Integrations**: No separate page needed.
5. **Settings as tabs**: Keep single Settings page with tab navigation instead of 7 separate routes.

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Nav changes break deep links | HIGH | Update all internal links, add redirects |
| Activity log missing data | MEDIUM | Graceful empty states, seed with recent events |
| Merged pages lose functionality | HIGH | Audit every feature before removing routes |
| DB schema changes needed | LOW | Only UI/routing changes, no schema modifications |
