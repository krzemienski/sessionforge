# Feature Landscape

**Domain:** Content pipeline platform (AI-powered session-to-content generation) -- alpha release readiness
**Researched:** 2026-03-22
**Focus:** Convergence, containerization, deployment, validation for v0.1.0-alpha

## Table Stakes

Features users expect from an alpha of a content pipeline platform. Missing = alpha feels broken.

### Core Workflow (Already Built)

These exist in the codebase and must be validated working, not built from scratch.

| Feature | Why Expected | Complexity | Status |
|---------|--------------|------------|--------|
| Session JSONL ingestion | Core value prop -- ingest sessions, extract insights | Already built | Validate only |
| AI content generation (6 agents) | Core value prop -- generate blog/social/newsletter/changelog | Already built | Validate only |
| Lexical editor with split/preview | Users expect rich text editing, not raw markdown textarea | Already built | Validate only |
| Live AI chat in editor | Differentiator, but already built -- must work | Already built | Validate only |
| Content CRUD (create/list/edit/delete) | Basic content management | Already built | Validate only |
| User auth (email/password + OAuth) | Users expect to log in | Already built | Validate only |
| Onboarding wizard | First-run experience must guide users | Already built | Validate only |
| Publishing integrations (Hashnode/WordPress/Dev.to) | Content pipeline must publish somewhere | Already built | Validate only |
| Mobile-responsive dashboard | Users will open on phones, tablet | Already built (spec 041) | Merge + validate |

### Post-Editing Controls (Partially Built)

| Feature | Why Expected | Complexity | Status |
|---------|--------------|------------|--------|
| Make Longer / Make Shorter quick actions | Table stakes for AI editors -- every competitor has these (Jasper, Writesonic, Copy.ai all provide one-click length controls) | Low | **Built** -- `inline-edit-controls.tsx` with ArrowUpRight/ArrowDownRight icons, sends prompt to AI chat |
| Length presets (500/1500/2500 words) | Users need target-length generation, not just relative adjustments | Low | **Built** -- LENGTH_PRESETS in inline-edit-controls.tsx with custom target input |
| Free-text feedback field | Users need to say "more technical" or "add code examples" without learning prompt engineering | Low | **Built** -- feedback textarea in inline-edit-controls.tsx sends to onSendMessage |
| Improve Clarity action | Common AI editing action alongside length controls | Low | **Built** -- quick action in QUICK_ACTIONS array |
| Edit history with restore | 83% of users rate revision history as important per GetApp survey. Users expect undo after AI changes content | Med | **Built** -- revision-history-panel.tsx, revisions/manager.ts, API routes at /api/content/[id]/revisions/* |
| Visual diff viewer | Users need to see what changed (inline + side-by-side) | Med | **Built** -- diff-viewer.tsx and side-by-side-diff-viewer.tsx components exist |

### Docker Local Dev Experience

| Feature | Why Expected | Complexity | Status |
|---------|--------------|------------|--------|
| `docker compose up` starts everything | Zero-step local dev is the bar. Users who `git clone` expect one command to run the app | Med | **Partially built** -- docker-compose.yml exists with Postgres + app, docker-compose.self-hosted.yml adds Redis |
| Postgres healthcheck with `depends_on: service_healthy` | App must not start before DB is ready. Without this, app crashes on first compose-up | Low | **Built** -- both compose files use `pg_isready` healthcheck + `condition: service_healthy` |
| Auto schema migration on first start | Users should not need to manually run `db:push` after compose-up | Med | **Missing** -- no entrypoint script runs migrations. `db:push` is manual |
| `.env.example` with clear documentation | Users need to know which vars are required vs optional | Low | **Built** -- .env.example exists with clear sections |
| App healthcheck in compose | Container orchestrators need to know when app is ready | Low | **Built** -- self-hosted compose uses `wget` to `/api/healthcheck` |
| Hot reload in dev mode | Developers expect file-change-driven reload in dev containers | Med | **Not needed for alpha** -- PROJECT.md says Docker is for deployment parity, not dev workflow. Local `bun run dev` is the dev experience |

### Production Deployment Readiness

| Feature | Why Expected | Complexity | Status |
|---------|--------------|------------|--------|
| Multi-stage Docker build | Production images must be small and secure | Low | **Built** -- Dockerfile uses deps/builder/runner stages, node:20-slim runner, non-root user |
| Health check endpoint | Load balancers, Docker, Kubernetes all need `/healthcheck` | Low | **Built** -- `/api/healthcheck` checks DB + Redis connectivity, returns 200/503 |
| Deployment validation endpoint | Operators need to verify env vars and connectivity after deploy | Low | **Built** -- `/api/deployment/validate` checks required/optional env vars, DB/Redis connectivity, deployment mode detection |
| Environment variable management | Clear required vs optional vars, fail-fast on missing required | Med | **Partially built** -- deployment/validate route checks at runtime, but no build-time or startup-time validation. App boots even with missing DATABASE_URL |
| Error boundaries | Unhandled errors must not white-screen the app | Low | **Partially built** -- error.tsx at root and dashboard levels, error-boundary.tsx component. No not-found.tsx |
| CI pipeline (lint + typecheck + build + docker) | Code quality gates before deploy | Low | **Built** -- .github/workflows/ci.yml with lint, typecheck, build, schema-drift check, Docker build |
| Non-root container user | Security baseline for containers | Low | **Built** -- Dockerfile creates nodejs user with UID 1001 |
| Standalone Next.js output | Required for Docker -- produces minimal server bundle | Low | **Built** -- Dockerfile copies .next/standalone |

### Documentation (Alpha Minimum)

| Feature | Why Expected | Complexity | Status |
|---------|--------------|------------|--------|
| README with quick start | First thing users see | Med | **Exists** -- needs audit for accuracy |
| Self-hosted deployment guide | Users running Docker need step-by-step | Med | **Built** -- docs/self-hosted.md is comprehensive |
| .env.example with comments | Required/optional distinction clear | Low | **Built** |
| API reference | v1 API users need endpoint docs | Med | **Exists** -- docs/api-reference.md needs accuracy audit |
| Architecture overview | Contributors need mental model | Med | **Exists** -- docs/ARCHITECTURE.md needs accuracy audit |
| CONTRIBUTING guide | Alpha testers may want to contribute | Low | **Exists** -- docs/CONTRIBUTING.md |

## Differentiators

Features that set SessionForge apart. Not expected in alpha, but provide competitive advantage.

| Feature | Value Proposition | Complexity | Ship When |
|---------|-------------------|------------|-----------|
| Session-to-content pipeline | No competitor does "ingest dev session, generate content" -- this IS the product | Already built | Alpha (core value) |
| 6 specialized AI agents | Blog, social, newsletter, changelog, repurpose, editor-chat -- each with domain-specific prompts and MCP tools | Already built | Alpha (core value) |
| Live AI chat with streaming tool use | Real-time AI editing with visible tool calls applied to document -- beyond typical "regenerate" buttons | Already built | Alpha (core value) |
| A/B headline experimentation | Test multiple headlines for click-through optimization (spec 031) | Med | Post-alpha unless merge is clean |
| Voice calibration engine | Learn user's writing style from examples, generate in their voice (spec 034) | High | Post-alpha unless merge is clean |
| Content versioning with visual diff | Side-by-side and inline diff viewers for revision comparison (spec 035) | Med | Built -- merge into alpha |
| Series/collection filtering | Organize content into series, filter by collection (spec 036) | Med | Post-alpha unless merge is clean |
| WCAG accessibility compliance | Accessibility audit and fixes (spec 037) | Med | Best-effort for alpha |
| Structured data / rich snippets | SEO structured data for published content (spec 039) | Med | Post-alpha |
| AI content repurposing | Transform one content type to another (spec 040) | Med | Already in agents -- validate |
| Pipeline observability / flow viz | Visual pipeline status with PipelineFlow component | Already built | Alpha (already merged) |
| Webhook delivery with HMAC signing | Integration-grade event delivery | Already built | Alpha (already merged) |
| Public v1 REST API (9 routes) | API-first enables automation | Already built | Alpha (already merged) |

## Anti-Features

Features to explicitly NOT build for alpha. Each has a clear reason.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Graceful shutdown (NEXT_MANUAL_SIG_HANDLE) | Known broken in Next.js standalone mode (GitHub issues #38298, #54522). Workarounds are fragile and untested. Docker/Vercel handle process lifecycle adequately for alpha | Let Docker SIGTERM handle it. Revisit when Next.js ships proper standalone shutdown support |
| Build-time env validation (t3-env / Zod schema) | Adds build complexity. The runtime `/api/deployment/validate` endpoint already checks required vars. For alpha, operators validate after deploy | Keep deployment/validate endpoint. Add build-time validation post-alpha when env matrix stabilizes |
| Rate limiting middleware | No public traffic expected in alpha. Rate limiting adds complexity (Redis dependency, middleware config, edge cases). Internal integration clients handle their own rate limits | Document "no rate limiting in alpha" as known limitation. Add per-route rate limiting when public launch approaches |
| Real-time collaboration (multiplayer editing) | Massive complexity (CRDTs/OT, WebSocket infrastructure, conflict resolution). Alpha is single-user focused | Single-user editing only. Note as future roadmap item |
| Loading.tsx Suspense boundaries | Nice UX polish but not blocking for alpha. Pages load fast enough with React Query skeleton states | Existing React Query loading states are sufficient |
| not-found.tsx pages | Nice but not critical. Next.js default 404 is acceptable for alpha | Add after alpha when polishing UX |
| Paid feature gating enforcement | Billing UI exists (Stripe integration) but enforcing limits adds edge cases. Alpha testers should have unrestricted access | Ship billing UI as-is. Enforce limits in beta when pricing is validated |
| Multi-cloud deployment configs | AWS ECS, GCP Cloud Run, Fly.io configs add maintenance burden with no alpha users on those platforms | Document "container is portable" but only ship Docker + Vercel configs |
| E2E test suite (Playwright/Cypress) | Project mandate: functional validation through real UI, not test frameworks | Validate features manually through browser UI per project philosophy |
| Database seeding with sample data | Alpha users bring their own sessions. Sample data creates confusion ("is this mine?") and masks real-world bugs | Ship empty database. Onboarding wizard guides first-session upload |
| Custom Docker dev container with hot reload | Docker dev mode on macOS is painfully slow (filesystem sync). `bun run dev` locally is the dev experience | Document: "Use `bun run dev` for development, Docker for deployment testing" |

## Feature Dependencies

```
Auth (Better Auth) --> Workspace creation --> All workspace-scoped features
                                          |
PostgreSQL (Neon/local) --> Schema push ---+
                                          |
Session ingestion --> Insight extraction --+--> Content generation (6 agents)
                                                    |
                                                    +--> Editor (Lexical) --> Post-editing controls
                                                    |                     --> Revision history
                                                    |                     --> AI chat panel
                                                    |
                                                    +--> Publishing (Hashnode/WP/Dev.to)
                                                    |
                                                    +--> Public API (v1)

Docker compose --> Postgres healthcheck --> App startup --> Schema migration (auto)
                                                       --> Healthcheck endpoint
```

Key dependency chains for alpha:
1. **Docker compose up** requires: Postgres healthy --> schema exists --> app boots --> healthcheck passes
2. **Content generation** requires: auth --> workspace --> session uploaded --> agent invoked
3. **Post-editing** requires: content exists --> editor loaded --> inline controls render --> AI chat connected
4. **Publishing** requires: content in "ready" status --> integration configured in settings

## Gap Analysis: What Exists vs What Alpha Needs

| Area | Exists | Gap for Alpha |
|------|--------|---------------|
| Post-editing UX | Make longer/shorter, length presets, free-text feedback, clarity improvement all built | Wire inline-edit-controls into editor page if not already connected. Validate AI chat responds to these actions |
| Edit history | Full revision system with diff viewers, restore, version labels | Validate restore works end-to-end. Ensure auto-save creates revisions |
| Docker local dev | Dockerfile, compose files, healthchecks all built | Add entrypoint script for auto schema migration. Test `docker compose up` from clean clone |
| Production deploy | Healthcheck, deployment validation, CI pipeline, standalone build all built | Add startup env validation (fail-fast if DATABASE_URL missing). Verify Vercel deployment works with Neon |
| Documentation | 16 docs exist in docs/ | Audit all for accuracy against current codebase. README quick-start must work |
| Error handling | Error boundaries at root + dashboard, AppError class, withApiHandler wrapper | Add not-found.tsx (post-alpha OK). Verify error boundaries catch real errors |
| Worktree convergence | 10 worktrees with implementations | Must merge clean or be deferred. Per-merge validation mandatory |

## MVP Recommendation for v0.1.0-alpha

### Must Ship (alpha is unusable without these)

1. **All 50+ existing features validated end-to-end** -- the codebase has extensive functionality. Alpha credibility requires proving it all works, not adding more
2. **Docker compose up works from clean clone** -- one command, database migrates, app boots, healthcheck passes. This is the "does it actually run" proof
3. **Post-editing controls connected and functional** -- make longer/shorter, feedback, length presets must work through the AI chat. Components exist, wiring must be verified
4. **Edit history with restore** -- users will make AI edits they regret. Restore must work
5. **Vercel production deployment** -- alpha needs to be accessible, not just running locally
6. **Auto schema migration in Docker** -- users should not manually run drizzle-kit after compose-up
7. **Documentation accuracy audit** -- every doc must match current code. Stale docs are worse than no docs

### Should Ship (improves alpha quality)

1. **Worktree 035 (content versioning/visual diff)** -- enhances revision history already built
2. **Worktree 041 (mobile responsive)** -- users will check on phones
3. **Worktree 037 (WCAG accessibility)** -- low-risk merge, improves quality baseline

### Defer to Post-Alpha

1. **Worktrees 031, 032, 034, 036, 038, 039, 040** -- merge only if clean. Skip if conflicts or risk destabilizing
2. **Rate limiting** -- no public traffic in alpha
3. **Paid feature enforcement** -- let alpha testers use everything
4. **Build-time env validation** -- runtime validation endpoint is sufficient
5. **Graceful shutdown** -- Docker/Vercel handle lifecycle

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Post-editing UX patterns | HIGH | Components verified in codebase, patterns match industry standard (Shape of AI, Writesonic, Jasper all use quick-action buttons + free-text feedback) |
| Docker experience | HIGH | Dockerfile and compose files verified in codebase, patterns match Next.js community best practices |
| Production deployment | HIGH | Healthcheck, deployment validation, CI pipeline all verified in codebase |
| Edit history | HIGH | Full revision system verified with manager.ts, API routes, diff viewers |
| Alpha feature scoping | MEDIUM | "What's table stakes for alpha" is partially subjective. Scoped based on SaaS launch checklists and competitor analysis |
| Worktree merge risk | LOW | Cannot assess merge conflict risk without examining each worktree branch diff against current main |

## Sources

- [Shape of AI - Restructure Patterns](https://www.shapeof.ai/patterns/restructure) -- AI content editing UX patterns
- [Fix It, Tweak It, Transform It (Medium)](https://medium.com/ui-for-ai/fix-it-tweak-it-transform-it-a-new-way-to-refine-ai-generated-content-dc53fd9d431f) -- Multi-level AI content refinement UX
- [GetApp AI Writing Assistant with Revision History](https://www.getapp.com/all-software/ai-writing-assistant/f/revision-management/) -- 83% rate revision history as important
- [Docker Compose Healthcheck Best Practices](https://www.denhox.com/posts/forget-wait-for-it-use-docker-compose-healthcheck-and-depends-on-instead/) -- depends_on with service_healthy
- [Next.js Deploying Guide](https://nextjs.org/docs/app/getting-started/deploying) -- standalone output, Docker multi-stage builds
- [Next.js Graceful Shutdown Issue #38298](https://github.com/vercel/next.js/issues/38298) -- standalone shutdown broken
- [Next.js Health Check Discussion #18055](https://github.com/vercel/next.js/discussions/18055) -- no built-in health endpoint
- [T3 Env for Next.js](https://env.t3.gg/docs/nextjs) -- build-time env validation (deferred for alpha)
- [SaaS Launch Checklist 2025 (DevSquad)](https://devsquad.com/blog/saas-launch-checklist) -- MoSCoW framework for feature prioritization
- [Hyperping: Next.js Health Check Endpoint](https://hyperping.com/blog/nextjs-health-check-endpoint) -- liveness vs readiness patterns
- [Headless CMS Comparison 2026 (Cosmic)](https://www.cosmicjs.com/blog/headless-cms-comparison-2026-cosmic-contentful-strapi-sanity-prismic-hygraph) -- content platform feature expectations
