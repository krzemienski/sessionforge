# Roadmap: SessionForge v0.1.0-alpha

## Overview

This roadmap takes the existing SessionForge codebase -- 21 pages, 76+ API routes, 30 tables, 6 AI agents -- from 10 divergent worktrees to a validated alpha release running identically in local Docker and Vercel production. The dependency chain is strict: converge first (cannot containerize divergent code), then Docker (fastest local feedback loop), then Vercel+Neon (same standalone output to production), then documentation (must describe the final state), then validation and release (proves everything works end-to-end).

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Worktree Convergence** - Audit specs 001-030, merge remaining worktrees into main with per-merge validation, produce a clean unified codebase
- [ ] **Phase 2: Docker Hardening** - Fix known container defects, add auto-migration, achieve zero-step `docker compose up` from clean clone
- [ ] **Phase 3: Vercel + Neon Deployment** - Deploy to production Vercel with Neon Postgres, wire migrations into build command, validate all services connected
- [ ] **Phase 4: Documentation** - Write and audit all docs (README, self-hosted guide, API reference, architecture, changelog) against the final codebase
- [ ] **Phase 5: Feature Validation & Release** - Validate 50+ features end-to-end in both Docker and Vercel, tag v0.1.0-alpha

## Phase Details

### Phase 1: Worktree Convergence
**Goal**: A single stable main branch with all alpha-scope worktrees merged, clean Drizzle schema, and passing production build
**Depends on**: Nothing (first phase)
**Requirements**: AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04, CONV-01, CONV-02, CONV-03, CONV-04, CONV-05, CONV-06
**Success Criteria** (what must be TRUE):
  1. User can see a merge manifest listing all worktrees ranked by conflict risk with git diff stats
  2. User can confirm specs 001-030 are fully merged into main with no missing code
  3. User can see branch 038 explicitly skipped with documented rationale
  4. User can run `bun run build` on converged main with zero TypeScript errors
  5. User can run `git worktree list` showing only the main worktree with all feature branches merged or skipped
**Plans**: TBD

Plans:
- [ ] 01-01: TBD
- [ ] 01-02: TBD
- [ ] 01-03: TBD

### Phase 2: Docker Hardening
**Goal**: A working `docker compose up` experience from a clean clone -- Postgres starts, schema auto-migrates, app serves at localhost:3000, healthchecks pass
**Depends on**: Phase 1
**Requirements**: DOCK-01, DOCK-02, DOCK-03, DOCK-04, DOCK-05, DOCK-06, DOCK-07
**Success Criteria** (what must be TRUE):
  1. User can run `docker compose up` from a clean clone with no manual setup and access the app at localhost:3000
  2. User can see Postgres schema auto-migrated on first startup without running any manual commands
  3. User can see all containers pass healthchecks (docker compose ps shows healthy for app and postgres)
  4. User can see .env.example documenting every required environment variable
  5. User can build the Docker image independently with `docker build` using node:22-slim runner with sharp installed
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD
- [ ] 02-03: TBD

### Phase 3: Vercel + Neon Deployment
**Goal**: SessionForge live at a Vercel production URL with Neon Postgres, automatic schema migrations in the build pipeline, and all services verified connected
**Depends on**: Phase 2
**Requirements**: DEPL-01, DEPL-02, DEPL-03, DEPL-04, DEPL-05, DEPL-06, DEPL-07
**Success Criteria** (what must be TRUE):
  1. User can access SessionForge at a live Vercel production URL and see the dashboard
  2. User can see /api/healthcheck return 200 and /api/deployment/validate confirm all services connected
  3. User can see Neon database provisioned with pooled connection for runtime and unpooled for migrations
  4. User can see build command runs drizzle-kit push before turbo build in Vercel project settings
  5. User can see all required env vars configured in Vercel project dashboard
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD
- [ ] 03-03: TBD

### Phase 4: Documentation
**Goal**: Accurate, complete documentation covering quick-start, self-hosted deployment, API reference, architecture, and changelog -- all verified against the final deployed codebase
**Depends on**: Phase 3
**Requirements**: DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-05, DOCS-06
**Success Criteria** (what must be TRUE):
  1. User can read a README with quick-start instructions that work when followed step-by-step
  2. User can follow the self-hosted deployment guide and get the app running via Docker
  3. User can read the API reference and successfully call every documented v1 endpoint
  4. User can see CHANGELOG.md with a v0.1.0-alpha entry listing all merged features
  5. User can see all 16 docs in docs/ audited and accurate against the current codebase
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD
- [ ] 04-03: TBD

### Phase 5: Feature Validation & Release
**Goal**: 50+ features proven functional end-to-end in both Docker and Vercel production, with the v0.1.0-alpha tag created after all validations pass
**Depends on**: Phase 4
**Requirements**: FVAL-01, FVAL-02, FVAL-03, FVAL-04, FVAL-05, FVAL-06, FVAL-07
**Success Criteria** (what must be TRUE):
  1. User can see 50+ features validated end-to-end in local Docker environment with evidence
  2. User can see 50+ features validated end-to-end in Vercel production environment with evidence
  3. User can use post-editing controls (make longer/shorter, feedback, length presets) in the editor and see AI respond
  4. User can see edit history entries and restore a previous version in the editor
  5. User can see v0.1.0-alpha git tag created after all validations pass
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD
- [ ] 05-03: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 --> 2 --> 3 --> 4 --> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Worktree Convergence | 0/3 | Not started | - |
| 2. Docker Hardening | 0/3 | Not started | - |
| 3. Vercel + Neon Deployment | 0/3 | Not started | - |
| 4. Documentation | 0/3 | Not started | - |
| 5. Feature Validation & Release | 0/3 | Not started | - |
