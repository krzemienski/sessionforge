# Worktree Consolidation — Execution Plan (Research-Informed)

**Baseline:** main @ 13897ad (build passes, 637-line schema)
**Total:** 21 branches → main, sequential with validation gates

---

## Updated Merge Order (Research-Corrected)

### TIER 1 — Zero Schema, Zero Overlap
| # | Branch | Risk | Key Notes |
|---|--------|------|-----------|
| 1 | 010-social-parsers | ZERO | 2 new files only |
| 2 | 032-dark-mode-shortcuts | LOW | Theme system + keyboard shortcuts; touches app-sidebar, workspace-shell |
| 3 | 003-content-preview | LOW | Preview components; [postId]/page.tsx conflicts with 032 — resolve by keeping 032's additions |

### TIER 2 — Zero Schema, Broader Changes
| # | Branch | Risk | Key Notes |
|---|--------|------|-----------|
| 4 | 006-error-handling | MEDIUM | withApiHandler wraps ALL API routes. MUST merge before 029 |
| 5 | 029-global-search | MEDIUM | Cmd+K search + filtering. Touches app-sidebar (post-032) |
| 6 | 022-test-suite | LOW | Tests written against 029-style errors; update for 006's AppError format |

### TIER 3 — Small Schema, Isolated Features
| # | Branch | Risk | Key Notes |
|---|--------|------|-----------|
| 7 | 001-onboarding | LOW | +1 schema line (onboardingCompleted) |
| 8 | 004-error-recovery | MEDIUM | +41 lines (agentRuns table). Modifies all 4 AI agents |
| 9 | 009-hashnode | MEDIUM | +30 lines. Touches [postId]/page.tsx (3rd touch) |
| 10 | 021-skill-loader | MEDIUM | +34 lines (writingSkills). Modifies agents. **024 depends on this** |

### TIER 3b — Dependency Chain (021→024→025)
| # | Branch | Risk | Key Notes |
|---|--------|------|-----------|
| 11 | 024-repurposing | MEDIUM | +14 lines. Imports skillLoaderTools from 021 |
| 12 | 025-seo-toolkit | MEDIUM | +22 lines. Imports getHaikuModel from 024's model-selector |

### TIER 4 — Medium Schema, Core Enhancements
| # | Branch | Risk | Key Notes |
|---|--------|------|-----------|
| 13 | 020-style-learning | HIGH | +64 lines (styleProfiles). Modifies all agents (already modified by 004, 021) |
| 14 | 019-transcript-viewer | MEDIUM | +39 lines (sessionBookmarks). 8 new components, mostly isolated |
| 15 | 013-automation-pipeline | HIGH | +58 lines (automationRuns). Migration is full baseline — extract incremental only |

### TIER 5 — Large Schema, Complex Integrations
| # | Branch | Risk | Key Notes |
|---|--------|------|-----------|
| 16 | 018-analytics | HIGH | +78 lines (contentMetrics, platformSettings). New deps: recharts, @upstash/redis |
| 17 | 027-revision-history | HIGH | +51 lines (postRevisions). Delta chain with diff pkg. Modifies post-manager.ts |
| 18 | 031-public-api | HIGH | +30 lines (webhookEndpoints). Removes Analytics from sidebar — re-add! |
| 19 | 034-wordpress | MEDIUM | +30 lines (wordpressConnections). Needs lib/export from 026 — defer if missing |
| 20 | 035-billing | HIGH | +120 lines (subscriptions, usageEvents, usageMonthlySummary). Stripe integration |

### TIER 6 — Massive, Highest Risk
| # | Branch | Risk | Key Notes |
|---|--------|------|-----------|
| 21 | 026-calendar-pipeline | CRITICAL | +238 lines. Changes postStatusEnum (BREAKING). 5 new tables. Newsletter agent. Dev.to. RSS. Export |

---

## Critical Dependencies Discovered

1. **021→024→025**: 024 imports `skillLoaderTools` from 021's `skill-loader.ts`. 025 imports `getHaikuModel` from 024's `model-selector.ts`.
2. **006→029→022**: 029's API routes conflict with 006's withApiHandler pattern. 022's tests assert 029-style error format.
3. **026 MUST be last**: Changes postStatusEnum (adds "idea", "in_review"), touches almost every shared file.
4. **034 needs lib/export**: `markdownToHtml` import comes from 026's `lib/export` module — may need stub or 026 first. Check main for existing export module.
5. **031 removes Analytics nav**: Must re-add after merge since 018 adds Analytics.
6. **013's migration**: Full baseline snapshot — extract only automationRuns DDL.

## Schema Merge Strategy

Use main as base. Each merge adds schema tables/columns incrementally. Key conflict zones:
- `workspacesRelations`: Accumulates `many()` references from 001, 004, 009, 021, 018, 027, 031, 034, 035, 026
- `postsRelations`: Gains revisions (027), contentMetrics (018), author + devtoPublication (026)
- `usersRelations`: Gains subscriptions + usage (035), memberships + activity (026)
- `posts` table: Gains columns from 025 (seo), 027 (revision meta), 034 (wordpress), 026 (badge, footer, createdBy, publishedAt)

## New Dependencies (All Branches Combined)

| Package | From Branch | Purpose |
|---------|-------------|---------|
| recharts | 018 | Analytics charts |
| @upstash/redis | 018 | Metrics caching |
| diff | 027 | Revision diffing |
| stripe | 035 | Billing integration |
| jszip | 026 | Content export |
| marked | 026 | Feed markdown→HTML |

## Validation Protocol Per Merge

1. `git merge auto-claude/<branch> --no-commit`
2. Resolve conflicts (schema.ts primary target)
3. `bun run build` — must pass
4. Quick functional check (key pages render, new API routes respond)
5. Commit merge
6. Report: files changed, conflicts resolved, build status
