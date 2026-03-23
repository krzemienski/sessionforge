# Requirements: SessionForge v0.1.0-alpha

**Defined:** 2026-03-22
**Core Value:** Every feature branch merged cleanly into main, the full stack running identically in local Docker and Vercel production, and 50+ features proven functional end-to-end

## v1 Requirements

Requirements for v0.1.0-alpha release. Each maps to roadmap phases.

### Spec Audit

- [x] **AUDIT-01**: User can verify specs 001-030 are fully merged into main with no missing code
- [x] **AUDIT-02**: User can see a merge manifest ranking remaining worktrees (031-041) by conflict risk
- [x] **AUDIT-03**: User can confirm branch 038 is skipped (test file mandate violation, 15K+ lines)
- [x] **AUDIT-04**: User can see git diff stats for each remaining worktree against current main

### Worktree Convergence

- [x] **CONV-01**: User can confirm non-schema worktrees (037, 041, 036) merge cleanly into main with build passing
- [x] **CONV-02**: User can confirm schema-touching worktrees (035, 031, 034) merge with Drizzle migration regenerated after each
- [x] **CONV-03**: User can confirm cross-cutting worktrees (039, 040, 032) merge with functional validation
- [x] **CONV-04**: User can see all worktrees removed and branches deleted after successful merge
- [x] **CONV-05**: User can run `git worktree list` showing only the main worktree
- [x] **CONV-06**: User can run `bun run build` on converged main with zero errors

### Docker Containerization

- [ ] **DOCK-01**: User can run `docker compose up` from a clean clone and get the full app with local Postgres
- [x] **DOCK-02**: User can see Postgres schema auto-migrated on first compose up (no manual db:push)
- [ ] **DOCK-03**: User can access the app at localhost:3000 with data from local Postgres
- [ ] **DOCK-04**: User can see all containers pass healthchecks (app + postgres)
- [x] **DOCK-05**: User can build the Docker image independently with `docker build`
- [x] **DOCK-06**: User can see node:22-slim runner image (not node:20), sharp installed, CLAUDECODE env cleared
- [x] **DOCK-07**: User can see .env.example documents every required environment variable

### Vercel + Neon Deployment

- [ ] **DEPL-01**: User can access SessionForge at a live Vercel production URL
- [ ] **DEPL-02**: User can see Neon database provisioned with production branch (scale-to-zero disabled)
- [ ] **DEPL-03**: User can see pooled connection string used for runtime, unpooled for migrations
- [ ] **DEPL-04**: User can see build command runs drizzle-kit push before turbo build
- [ ] **DEPL-05**: User can see all required env vars configured in Vercel project
- [ ] **DEPL-06**: User can see /api/healthcheck returns 200 on production
- [ ] **DEPL-07**: User can see /api/deployment/validate confirms all services connected

### Documentation

- [ ] **DOCS-01**: User can read an accurate README with quick-start, feature list, and env var reference
- [ ] **DOCS-02**: User can read self-hosted deployment guide (docs/self-hosted.md) verified against current Docker setup
- [ ] **DOCS-03**: User can read API reference (docs/api-reference.md) verified against current v1 routes
- [ ] **DOCS-04**: User can read accurate architecture overview matching current codebase
- [ ] **DOCS-05**: User can see CHANGELOG.md with v0.1.0-alpha entry listing all merged features
- [ ] **DOCS-06**: User can see all 16 docs in docs/ audited for accuracy against current codebase

### Feature Validation

- [ ] **FVAL-01**: User can see 50+ features validated end-to-end in local Docker environment
- [ ] **FVAL-02**: User can see 50+ features validated end-to-end in Vercel production environment
- [ ] **FVAL-03**: User can see post-editing controls (make longer/shorter, feedback, length presets) working in editor
- [ ] **FVAL-04**: User can see edit history with restore working in editor
- [ ] **FVAL-05**: User can see AI chat with streaming tool use working in editor
- [ ] **FVAL-06**: User can see session ingestion producing insights and content
- [ ] **FVAL-07**: User can see v0.1.0-alpha git tag created after all validations pass

## v2 Requirements

Deferred to post-alpha. Tracked but not in current roadmap.

### CI Pipeline Consolidation

- **CICD-01**: CI pipeline adds container smoke test (compose up, healthcheck, teardown)
- **CICD-02**: CI pipeline uses oven-sh/setup-bun@v2 consistently across all workflows
- **CICD-03**: CI pipeline adds Turbo remote cache via Vercel
- **CICD-04**: Preview deployment workflow creates Neon branch per PR

### Additional Worktree Features

- **FEAT-01**: A/B headline experimentation (spec 031) -- merge if clean, defer if conflicts
- **FEAT-02**: Compliance billing trust center (spec 032) -- merge if clean, defer if conflicts
- **FEAT-03**: Voice calibration engine (spec 034) -- merge if clean, defer if conflicts

## Out of Scope

| Feature | Reason |
|---------|--------|
| Branch 038 (test coverage expansion) | 15,397 lines of test files violates no-mock mandate |
| Graceful shutdown (NEXT_MANUAL_SIG_HANDLE) | Known broken in Next.js standalone mode (issues #38298, #54522) |
| Build-time env validation (t3-env) | Runtime /api/deployment/validate is sufficient for alpha |
| E2E test suite (Playwright/Cypress) | Project mandate: functional validation through real UI only |
| Paid feature gating enforcement | Billing UI exists but enforcement deferred |
| Rate limiting | Alpha focuses on correctness, not abuse prevention |
| Database seeding | Alpha users bring their own sessions |
| Multi-cloud deployment configs | Document container portability, don't implement provider-specific configs |
| Hot reload in Docker | Docker is for deployment parity; local bun run dev is the dev experience |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUDIT-01 | Phase 1 | Complete |
| AUDIT-02 | Phase 1 | Complete |
| AUDIT-03 | Phase 1 | Complete |
| AUDIT-04 | Phase 1 | Complete |
| CONV-01 | Phase 1 | Complete |
| CONV-02 | Phase 1 | Complete |
| CONV-03 | Phase 1 | Complete |
| CONV-04 | Phase 1 | Complete |
| CONV-05 | Phase 1 | Complete |
| CONV-06 | Phase 1 | Complete |
| DOCK-01 | Phase 2 | Pending |
| DOCK-02 | Phase 2 | Complete |
| DOCK-03 | Phase 2 | Pending |
| DOCK-04 | Phase 2 | Pending |
| DOCK-05 | Phase 2 | Complete |
| DOCK-06 | Phase 2 | Complete |
| DOCK-07 | Phase 2 | Complete |
| DEPL-01 | Phase 3 | Pending |
| DEPL-02 | Phase 3 | Pending |
| DEPL-03 | Phase 3 | Pending |
| DEPL-04 | Phase 3 | Pending |
| DEPL-05 | Phase 3 | Pending |
| DEPL-06 | Phase 3 | Pending |
| DEPL-07 | Phase 3 | Pending |
| DOCS-01 | Phase 4 | Pending |
| DOCS-02 | Phase 4 | Pending |
| DOCS-03 | Phase 4 | Pending |
| DOCS-04 | Phase 4 | Pending |
| DOCS-05 | Phase 4 | Pending |
| DOCS-06 | Phase 4 | Pending |
| FVAL-01 | Phase 5 | Pending |
| FVAL-02 | Phase 5 | Pending |
| FVAL-03 | Phase 5 | Pending |
| FVAL-04 | Phase 5 | Pending |
| FVAL-05 | Phase 5 | Pending |
| FVAL-06 | Phase 5 | Pending |
| FVAL-07 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 37 total
- Mapped to phases: 37
- Unmapped: 0

---
*Requirements defined: 2026-03-22*
*Last updated: 2026-03-22 after roadmap creation*
