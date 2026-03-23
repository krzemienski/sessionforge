# Phase 1: Worktree Convergence - Research

**Researched:** 2026-03-23
**Domain:** Git worktree convergence, Drizzle ORM schema merging, monorepo build validation
**Confidence:** HIGH

## Summary

Phase 1 is a pure git operations phase -- no new code to write, no new libraries to install. The challenge is entirely operational: merging 9 worktree branches (skipping 038) into main, resolving schema conflicts in a single-file Drizzle ORM schema, and ensuring the production build passes after convergence.

The critical risk is the `packages/db/src/schema.ts` file. Three branches (031, 034, 040) modify it independently, and all 7 branches based on merge-base `2e6586` are 178 commits behind main HEAD. The schema file grew from 2521 lines (when most branches diverged) to 2902 lines on main. The merge-tree analysis reveals 5 branches modifying `content/[postId]/page.tsx` (the highest-conflict file), 3 branches modifying `settings/page.tsx`, and 3 branches modifying `schema.ts`. The locked merge order (D-04) handles this correctly by deferring high-conflict branches to later tiers.

An additional complication: branches 040, 039, and 034 contain test files (`.test.ts`) that violate the project's no-mock mandate. These files must be discarded during merge, not carried into main.

**Primary recommendation:** Execute the locked merge order (D-04) exactly as specified. For each merge: attempt merge, resolve conflicts favoring main for schema.ts base, cherry-pick only NEW additions from the branch, rebuild with `bun run build`, and regenerate Drizzle migrations for schema-modifying merges. Discard test files from branches 034, 039, and 040 during merge.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Full audit with build verification -- read each spec's acceptance criteria, grep codebase for implementation, verify build compiles with features present
- **D-02:** Fix gaps before merging -- if audit finds partially implemented or missing features from specs 001-030, fix them before proceeding to worktree merges
- **D-03:** Merge all 9 remaining branches (skip 038 only) -- maximum feature coverage for alpha
- **D-04:** Merge order by risk tier: low-risk UI-only first (037 -> 041 -> 036), then schema-touching (035 -> 031 -> 034), then cross-cutting (039 -> 040 -> 032)
- **D-05:** Never skip a branch -- if a branch has conflicts, keep working until it merges. No branch left behind
- **D-06:** Branch 038 (comprehensive test coverage) is explicitly skipped -- 15,397 lines of test files violates the no-mock mandate
- **D-07:** Regenerate Drizzle migrations after each schema-modifying merge -- delete all migration files, run drizzle-kit generate + push after each merge
- **D-08:** Main-first schema merge strategy -- accept main's schema.ts as base, cherry-pick only NEW tables/columns from the branch on top
- **D-09:** Each merge gets: merge -> resolve conflicts -> build -> drizzle-kit generate -> drizzle-kit push -> validate -> commit

### Claude's Discretion
- Exact conflict resolution strategy for each branch (semantic analysis of each conflict file)
- Build validation approach (full build vs typecheck-only between merges)
- Whether to create safety tags between merges (recommended but not mandated)
- How to handle the CLAUDECODE env var fix in merged branches (ensure all AI files retain the fix)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUDIT-01 | User can verify specs 001-030 are fully merged into main with no missing code | Spec directory analysis: 22 of 30 spec directories exist (001,005-007,012-013,015-030); 8 numbers missing (002-004,008-011,014) -- these were never created, not lost. Audit requires reading each spec.md acceptance criteria and grepping for implementation |
| AUDIT-02 | User can see a merge manifest ranking remaining worktrees by conflict risk with git diff stats | Complete diff stats gathered: 037(40 files,682+), 041(20 files,2505+), 036(6 files,1155+), 035(7 files,1082+), 031(16 files,3146+), 034(20 files,1544+), 039(17 files,3721+), 040(31 files,2874+), 032(8 files,2148+). Overlap matrix computed |
| AUDIT-03 | User can confirm branch 038 is skipped with documented rationale | 038 analysis complete: 29 files, 15,428 insertions, ALL are test/config files (.test.ts, vitest.config.ts). Zero production code. Clear mandate violation |
| AUDIT-04 | User can see git diff stats for each remaining worktree against current main | Diff stats collected for all 9 branches. Merge-base distances computed: 7 branches are 178 commits behind, 031 is 84 behind, 034 is 8 behind |
| CONV-01 | User can confirm non-schema worktrees (037, 041, 036) merge cleanly with build passing | Overlap analysis: 037 and 041 share 7 files (content-list-view, workspace-shell, mobile-bottom-nav, globals.css, 3 pages). 036 is isolated (6 portfolio files). Merge order handles this |
| CONV-02 | User can confirm schema-touching worktrees (035, 031, 034) merge with Drizzle migration regenerated | Schema changes identified: 031 adds 2 enums + experiments table + 2 relations (2880 lines), 034 adds 7 columns to writingStyleProfiles (2909 lines), 040 adds "doc_page" to contentTypeEnum (2521 lines). 035 does NOT modify schema.ts. Migration regeneration protocol established per D-07/D-08/D-09 |
| CONV-03 | User can confirm cross-cutting worktrees (039, 040, 032) merge with functional validation | 039 touches SEO routes + export (17 files, includes 2 test files to discard). 040 touches repurpose engine + schema (31 files, includes 11 test files to discard). 032 is isolated to billing (8 files, no overlap) |
| CONV-04 | User can see all worktrees removed and branches deleted after successful merge | 10 worktrees confirmed active via `git worktree list`. Removal sequence: `git worktree remove <path>` then `git branch -d <branch>` for each |
| CONV-05 | User can run `git worktree list` showing only the main worktree | Currently shows 10 worktree entries + main. Post-convergence: only main entry should remain |
| CONV-06 | User can run `bun run build` on converged main with zero errors | Build runs through turbo -> next build. Must pass after each merge per D-09. Final build is the gate |
</phase_requirements>

## Standard Stack

No new packages needed. This phase uses only git and existing project tooling.

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| git | 2.53.0 | Branch merging, conflict resolution, worktree management | Already installed, sole merge tool |
| bun | 1.3.6 (local) / 1.2.4 (project lock) | Package manager, build runner | Project's locked package manager |
| drizzle-kit | 0.31.10 | Schema migration generation and push | Already installed, required for D-07 |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| `bun run build` | n/a | Production build validation | After every merge (D-09) |
| `bunx drizzle-kit generate` | 0.31 | Generate migration files from schema diff | After schema-modifying merges (D-07) |
| `bunx drizzle-kit push` | 0.31 | Push schema to database | After schema-modifying merges (D-07) |

### Alternatives Considered
None -- this phase is git operations only, no library choices to make.

**Note on bun version:** Local environment has bun 1.3.6 but project's `package.json` locks to 1.2.4. Using `bun install --frozen-lockfile` may warn about version mismatch. This is acceptable for merge operations. The lockfile (`bun.lock`) should remain consistent.

## Architecture Patterns

### Recommended Merge Execution Structure

The phase has three distinct waves of work:

```
Wave 1: Audit (AUDIT-01 through AUDIT-04)
  Read each spec's acceptance criteria
  Grep codebase for implementation
  Produce merge manifest with diff stats
  Fix any gaps in specs 001-030

Wave 2: Merge (CONV-01 through CONV-03)
  Tier 1 (low-risk): 037 -> 041 -> 036
  Tier 2 (schema-touching): 035 -> 031 -> 034
  Tier 3 (cross-cutting): 039 -> 040 -> 032

Wave 3: Cleanup (CONV-04, CONV-05, CONV-06)
  Remove all worktrees
  Delete merged branches
  Final build validation
```

### Pattern 1: Main-First Schema Merge (D-08)

**What:** When merging a branch that modifies `schema.ts`, accept main's version as the base and surgically add the branch's NEW tables/columns/enums on top.

**When to use:** Every merge where `schema.ts` conflicts (branches 031, 034, 040, and potentially any branch 178 commits behind main).

**How:**
```bash
# Start the merge
git merge auto-claude/<branch> --no-commit

# For schema.ts conflicts: accept main's version first
git checkout --ours packages/db/src/schema.ts

# Then manually apply ONLY the new additions from the branch
# (read the branch's schema diff to identify what to add)
git diff main...auto-claude/<branch> -- packages/db/src/schema.ts
# Apply additions by hand

# Stage and continue
git add packages/db/src/schema.ts
```

**Critical:** Do NOT use `git checkout --theirs` for schema.ts. The branch's version is 381+ lines shorter than main and would destroy all schema additions from specs 022-030.

### Pattern 2: Test File Exclusion During Merge

**What:** Some branches (034, 039, 040) contain `.test.ts` files that violate the no-mock mandate. These must be excluded during merge.

**When to use:** When merging branches that contain test files.

**How:**
```bash
# After merge but before commit, unstage test files
git reset HEAD -- '*.test.ts' '*.spec.ts' '*/__tests__/*'
git checkout -- '*.test.ts' '*.spec.ts' '*/__tests__/*'
```

**Branches with test files to discard:**
- 034: 2 test files (`insight-extractor.test.ts`, `newsletter-writer.test.ts`)
- 039: 2 test files (`structured-data-generator.test.ts`, `structured-data-validator.test.ts`)
- 040: 11 test files (all `__tests__/` directories) + `__test-utils__/shared-schema-mock.ts`

### Pattern 3: Post-Merge Migration Regeneration (D-07)

**What:** After merging a schema-modifying branch, delete all migration artifacts and regenerate.

**When to use:** After merging branches 031, 034, and 040 (the three schema-modifying branches).

**How:**
```bash
# Delete existing migrations
rm -rf packages/db/migrations/*

# Regenerate from converged schema
cd packages/db && bunx drizzle-kit generate

# Push to database (requires DATABASE_URL)
cd packages/db && bunx drizzle-kit push
```

**Warning from CLAUDE.md:** `drizzle-kit push` may hang on interactive prompts for new enums or columns. If it hangs, use direct SQL `ALTER TABLE` statements as a workaround.

### Anti-Patterns to Avoid

- **Rebasing branches onto main before merge:** The branches are 178 commits behind. Rebasing would replay each branch commit onto modern main, producing 10-20 conflicts per commit instead of one merge conflict to resolve. Use `git merge` (not rebase).
- **Batch-merging multiple branches:** D-09 mandates build validation after EACH merge. Never merge two branches before validating the first.
- **Using `git checkout --theirs` for schema.ts:** The branch version is hundreds of lines shorter than main. This would destroy all schema progress from specs 022-030.
- **Keeping branch migration files:** Branches 034 and 040 have standalone `.sql` migration files (`add_voice_calibration_columns.sql`, `add_doc_page_enum.sql`). These are branch-specific and must be replaced by regenerated migrations after merge (D-07).
- **Merging 038:** Decision D-06 explicitly skips this branch. All 29 files are test/config files.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Conflict preview | Manual file-by-file inspection | `git diff main...<branch> --stat` + `git merge-tree` | Accurate, shows exact conflict regions |
| Schema merge | Hand-editing merged schema.ts | Main-first strategy (Pattern 1) | Avoids accidental deletion of main's 382 new lines |
| Migration history | Trying to merge journal.json manually | Delete + regenerate (D-07) | Drizzle journal requires linear history; hand-editing corrupts it |
| Test file filtering | Manually identifying which files to skip | `git diff --name-only` filtered by `.test.ts` pattern | Systematic, catches all test files |

**Key insight:** The Drizzle migration journal (`_journal.json`) is not safely mergeable. It has duplicate `idx` values even on main (two entries with `idx: 1`, two with `idx: 4`). Any attempt to merge branch migration journals will corrupt it further. The only safe strategy is full regeneration (D-07).

## Common Pitfalls

### Pitfall 1: Schema.ts Line Count Regression

**What goes wrong:** Accepting the wrong "side" of a schema.ts conflict discards hundreds of lines of table definitions that were added by previously merged specs (022-030).
**Why it happens:** The branch version of schema.ts is 2521 lines (from when it diverged). Main is at 2902 lines. A careless `--theirs` or wrong conflict resolution drops 381 lines.
**How to avoid:** Always `--ours` (main) for schema.ts, then surgically add branch-specific additions. After merge, verify line count >= 2902.
**Warning signs:** Schema line count drops after merge. `bun run build` fails with "table X is not defined" errors.

### Pitfall 2: content/[postId]/page.tsx Five-Way Conflict

**What goes wrong:** This file is modified by 5 of the 9 branches (031, 034, 035, 037, 041). By the time later branches merge, the file has been modified 2-4 times already, making conflict resolution progressively harder.
**Why it happens:** This is the main content editor page -- every feature adds panels, tabs, or buttons to it.
**How to avoid:** The merge order (D-04) already handles this. 037 and 041 merge first (they add a11y and mobile changes). 035 merges next (versioning UI). Then 031 and 034 merge last (experiments tab, voice tab). Each subsequent merge resolves against the accumulated changes from prior merges.
**Warning signs:** Build fails mentioning duplicate JSX keys, missing imports, or component signature mismatches in the editor page.

### Pitfall 3: CLAUDECODE Env Fix Lost During Merge

**What goes wrong:** All 12 AI-related files have `delete process.env.CLAUDECODE` as a critical runtime fix. If a branch modifies one of these files and the conflict resolution drops the deletion line, AI agent calls will silently fail.
**Why it happens:** The deletion line looks like dead code or debugging artifact. During conflict resolution, it might be mistakenly removed.
**How to avoid:** After each merge, grep for the fix: `grep -r "delete process.env.CLAUDECODE" apps/dashboard/src/`. Must find 12 occurrences. If any are missing, add them back.
**Warning signs:** Agent-related routes return empty responses or exit code 1 after merge.

### Pitfall 4: Drizzle-kit Push Hanging on Interactive Prompts

**What goes wrong:** `drizzle-kit push` for new enums or columns may hang waiting for user confirmation (`Are you sure you want to add enum X?`).
**Why it happens:** drizzle-kit's push command is designed for interactive use by default.
**How to avoid:** Use `--force` flag if available, or pipe `yes` to the command: `yes | bunx drizzle-kit push`. Alternatively, per CLAUDE.md, use direct `ALTER TABLE` SQL statements as a workaround.
**Warning signs:** The push command runs for more than 30 seconds without output.

### Pitfall 5: bun.lock Drift After Multiple Merges

**What goes wrong:** Each branch may have its own version of `bun.lock` with slightly different dependency resolutions. After merging 9 branches, the lockfile may be corrupted or inconsistent.
**Why it happens:** Multiple branches modified `package.json` or added dependencies independently.
**How to avoid:** After each merge, run `bun install` (not `--frozen-lockfile`) to regenerate a clean lockfile. Then commit the updated `bun.lock` as part of the merge commit.
**Warning signs:** `bun install --frozen-lockfile` fails. `bun run build` reports "Cannot find module" errors.

### Pitfall 6: Branch-Specific Migration SQL Files Persisting

**What goes wrong:** Branches 034 and 040 have manual `.sql` migration files (`add_voice_calibration_columns.sql`, `add_doc_page_enum.sql`) in `packages/db/migrations/`. If these persist alongside the regenerated migrations, `drizzle-kit migrate` may apply them out of order or apply conflicting DDL.
**Why it happens:** These files are committed as branch-specific workarounds, not Drizzle-generated migrations.
**How to avoid:** When executing D-07 (migration regeneration), delete ALL files in `packages/db/migrations/` including these manual SQL files. Only keep the regenerated output.
**Warning signs:** Multiple migration files with the same table/column modifications.

## Code Examples

### Merge Protocol Per Branch (D-09)

```bash
# Source: Derived from locked decisions D-04, D-08, D-09
BRANCH="auto-claude/037-wcag-accessibility-compliance"

# 1. Safety tag before merge
git tag pre-merge-037

# 2. Attempt merge
git merge $BRANCH --no-ff --no-commit

# 3. Check for conflicts
git status

# 4. For schema.ts conflicts: main-first strategy
# git checkout --ours packages/db/src/schema.ts
# (then manually add branch-specific additions)

# 5. For test files: exclude them
git reset HEAD -- '*.test.ts' '*.spec.ts' '*/__tests__/*' '*/__test-utils__/*'
git checkout -- '*.test.ts' '*.spec.ts' '*/__tests__/*' '*/__test-utils__/*' 2>/dev/null

# 6. Resolve remaining conflicts manually

# 7. Verify CLAUDECODE fix is intact
grep -r "delete process.env.CLAUDECODE" apps/dashboard/src/ | wc -l
# Must be >= 12

# 8. Build validation
bun install
bun run build

# 9. If schema-modifying: regenerate migrations (D-07)
# rm -rf packages/db/migrations/*
# cd packages/db && bunx drizzle-kit generate

# 10. Commit
git add .
git commit -m "merge: spec 037 (WCAG accessibility compliance)"

# 11. Post-merge tag
git tag post-merge-037
```

### Spec Audit Protocol (AUDIT-01)

```bash
# For each spec directory in .auto-claude/specs/0XX-*/
# 1. Read spec.md for acceptance criteria
# 2. Grep codebase for implementation evidence
# 3. Record status: COMPLETE / PARTIAL / MISSING

# Example for spec 001:
grep -r "upload" apps/dashboard/src/app/api/ --include="*.ts" -l
grep -r "UploadZone\|upload-zone" apps/dashboard/src/components/ -l
# If files exist and match spec criteria -> COMPLETE
```

### Merge Manifest Structure (AUDIT-02, AUDIT-04)

```markdown
# Merge Manifest

| Branch | Files | Insertions | Deletions | Schema? | Test Files? | Risk |
|--------|-------|------------|-----------|---------|-------------|------|
| 037 | 40 | 682 | 66 | No | 1 (axe-audit) | LOW |
| 041 | 20 | 2505 | 493 | No | No | LOW |
| 036 | 6 | 1155 | 225 | No | No | LOW |
| 035 | 7 | 1082 | 114 | No | No | MEDIUM |
| 031 | 16 | 3146 | 1 | YES (2 enums + table) | No | HIGH |
| 034 | 20 | 1544 | 19 | YES (7 columns) | 2 files | HIGH |
| 039 | 17 | 3721 | 44 | No | 2 files | MEDIUM |
| 040 | 31 | 2874 | 80 | YES (enum value) | 11 files | HIGH |
| 032 | 8 | 2148 | 0 | No | No | LOW |
| 038 | 29 | 15428 | 4 | No | ALL (skip) | SKIP |
```

## Conflict Hotspot Analysis

Files modified by 3+ branches -- these will require careful sequential resolution:

| File | Branches | Merge Order (per D-04) | Resolution Strategy |
|------|----------|------------------------|---------------------|
| `content/[postId]/page.tsx` | 037, 041, 035, 031, 034 (5 branches) | 037 first, 041 second, then 035, 031, 034 | Each merge adds tabs/panels; accept prior merge, add new features |
| `schema.ts` | 031, 034, 040 (3 branches) | 031 before 034, then 040 in tier 3 | Main-first (D-08); cherry-pick additions |
| `settings/page.tsx` | 037, 034, 032 (3 branches) | 037 first, 034 in tier 2, 032 in tier 3 | Each adds new settings tab; accept cumulative |
| `content/page.tsx` | 037, 041, 040 (3 branches) | 037 first, 041 second, 040 in tier 3 | Additive changes to content list |

## Spec Audit Findings

### Spec Directory Coverage

22 of 30 spec numbers have directories on main. The 8 "missing" numbers were never created (they were not part of the development plan):

**Present (001-030):** 001, 005, 006, 007, 012, 013, 015, 016, 017, 018, 019, 020, 021, 022, 023, 024, 025, 026, 027, 028, 029, 030

**Never created:** 002, 003, 004, 008, 009, 010, 011, 014

**Spec 033** exists (critical-bug-resolution-schema-stability) -- this was a bug-fix spec, not a feature spec.

### Audit Approach

For each of the 22 specs with directories:
1. Read `spec.md` acceptance criteria
2. Read `requirements.json` for specific requirements
3. Grep codebase for implementation (routes, components, lib modules)
4. Check `build-progress.txt` and `completion-report.md` if they exist
5. Record: COMPLETE (all criteria met), PARTIAL (some criteria met), or MISSING (no implementation found)

This audit must complete before any merges begin (per D-02).

## Branch-Specific Risk Analysis

### Tier 1: Low-Risk (non-schema, UI-only)

**037 - WCAG Accessibility** (40 files, 682+/66-)
- Risk: LOW. Changes are CSS/ARIA attributes across many files. No functional logic changes.
- Overlap: 7 files shared with 041 (content-list-view, workspace-shell, mobile-bottom-nav, globals.css, 3 pages)
- Test files: 1 (`axe-audit.spec.ts`) -- discard
- Strategy: Merge first. Accept all a11y improvements as base for subsequent merges.

**041 - Mobile Responsive** (20 files, 2505+/493-)
- Risk: LOW-MEDIUM. Significant deletions (493 lines) indicate refactoring, not just additions.
- Overlap: 7 files shared with 037 (same list above). Since 037 merges first, 041 must resolve against 037's changes.
- New files: `bottom-sheet.tsx`, `swipeable-card.tsx`, `mobile-week-calendar.tsx`, `use-pull-to-refresh.ts`, `use-swipe-gesture.ts` -- no conflict risk
- Strategy: After 037, merge 041. Focus conflict resolution on workspace-shell.tsx and content-list-view.tsx.

**036 - Series/Collection Filtering** (6 files, 1155+/225-)
- Risk: LOW. Completely isolated to portfolio components. No overlap with any other branch.
- Strategy: Merge after 041. Should be clean.

### Tier 2: Schema-Touching

**035 - Content Versioning Visual Diff** (7 files, 1082+/114-)
- Risk: MEDIUM. Does NOT modify schema.ts (despite being in tier 2). Modifies editor components.
- Overlap: `content/[postId]/page.tsx` (also in 037, 041, 031, 034)
- Note: CONTEXT.md places this in schema-touching tier, but research shows no schema changes. The merge is simpler than expected.
- Strategy: Merge after tier 1. Focus on editor page conflict resolution.

**031 - A/B Headlines** (16 files, 3146+/1-)
- Risk: HIGH. Adds 2 new pgEnums (`experimentStatusEnum`, `experimentKpiEnum`), full `experiments` table, and 2 relation additions. Schema is at 2880 lines (22 lines less than main's 2902 -- branched from an earlier state).
- Overlap: `content/[postId]/page.tsx`, `validation.ts`, `schema.ts`
- Migration: None branch-specific -- uses inline schema definition
- Strategy: Main-first for schema.ts. Add the 2 enums, experiments table, and relation entries on top of main's 2902-line schema. Regenerate migrations (D-07).

**034 - Voice Calibration** (20 files, 1544+/19-)
- Risk: HIGH. Adds 7 columns to existing `writingStyleProfiles` table. Schema is at 2909 lines (7 lines MORE than main -- branched more recently, merge-base only 8 commits behind).
- Overlap: `content/[postId]/page.tsx`, `settings/page.tsx`, `schema.ts`, `repurpose-writer.ts`, `profile-injector.ts`
- Test files: 2 (`insight-extractor.test.ts`, `newsletter-writer.test.ts`) -- discard
- Migration: Has `add_voice_calibration_columns.sql` -- discard, use regenerated migration
- Strategy: Since merge-base is only 8 commits behind, schema conflicts should be minimal. Main-first, add 7 columns. Regenerate migrations.

### Tier 3: Cross-Cutting

**039 - Structured Data/SEO** (17 files, 3721+/44-)
- Risk: MEDIUM. Adds SEO structured data generator/validator, modifies seo-panel and export modules.
- Overlap: `markdown-export.ts` (also in 040)
- Test files: 2 (`structured-data-generator.test.ts`, `structured-data-validator.test.ts`) -- discard
- Strategy: Merge after tier 2. Discard test files. No schema changes.

**040 - AI Repurposing Engine** (31 files, 2874+/80-)
- Risk: HIGH. Adds `"doc_page"` to `contentTypeEnum`, new repurpose writer agent, bulk repurpose API.
- Overlap: `content/page.tsx`, `batch-repurpose-dialog.tsx`, `markdown-export.ts`, `profile-injector.ts`, `templates.ts`, `schema.ts`
- Test files: 11 test files + 1 `__test-utils__/` mock -- discard ALL
- Migration: Has `add_doc_page_enum.sql` -- discard, use regenerated migration
- Strategy: This is the most complex merge (31 files, many overlaps). Main-first for schema. Discard all 12 test-related files. Regenerate migrations.

**032 - Compliance Billing** (8 files, 2148+/0)
- Risk: LOW. Pure additions -- no deletions, no modifications to existing code. Adds billing API routes and billing tab.
- Overlap: `settings/page.tsx` (also in 037, 034)
- Strategy: Merge last. Settings page will have been modified twice already (037 a11y, 034 voice tab). Add billing tab on top.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0 |
| Config file | `apps/dashboard/vitest.config.ts` |
| Quick run command | `cd apps/dashboard && bun run test:unit` |
| Full suite command | `cd apps/dashboard && bun run test` |

**NOTE:** Per project mandate (CLAUDE.md), test files must NOT be written. The existing vitest config exists from prior work but the project explicitly forbids writing new test files or mocks. Validation for this phase is through `bun run build` (production build pass) -- not test suites.

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUDIT-01 | Specs 001-030 implementation verified | manual audit | Grep-based: `grep -r "<pattern>" apps/dashboard/src/` | n/a (audit) |
| AUDIT-02 | Merge manifest with diff stats | manual generation | `git diff --stat main...<branch>` for each | n/a (artifact) |
| AUDIT-03 | Branch 038 skip documented | manual review | `git diff --name-only main...auto-claude/038-*` | n/a (artifact) |
| AUDIT-04 | Git diff stats available | manual generation | `git diff --stat main...<branch>` | n/a (artifact) |
| CONV-01 | Non-schema branches merge with build passing | build validation | `bun run build` | n/a (build) |
| CONV-02 | Schema branches merge with migrations regenerated | build + drizzle | `bun run build && cd packages/db && bunx drizzle-kit generate` | n/a (build) |
| CONV-03 | Cross-cutting branches merge with validation | build validation | `bun run build` | n/a (build) |
| CONV-04 | Worktrees removed, branches deleted | git commands | `git worktree list` (should show only main) | n/a (git) |
| CONV-05 | Only main worktree remains | git command | `git worktree list` | n/a (git) |
| CONV-06 | `bun run build` passes with zero errors | build | `bun run build` | n/a (build) |

### Sampling Rate
- **Per merge commit:** `bun run build` (mandatory per D-09)
- **Per wave merge:** `bun run build` + verify schema line count + grep CLAUDECODE fix
- **Phase gate:** `bun run build` clean + `git worktree list` shows only main

### Wave 0 Gaps
None -- this phase does not require any test infrastructure. Validation is entirely through build pass and git state verification.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| git | All merge operations | Yes | 2.53.0 | -- |
| bun | Build validation | Yes | 1.3.6 | -- |
| drizzle-kit | Migration regeneration (D-07) | Yes | 0.31.10 | -- |
| PostgreSQL | drizzle-kit push (D-07) | Requires DATABASE_URL | -- | Skip push, generate only |

**Missing dependencies with fallback:**
- PostgreSQL connection: `drizzle-kit push` requires a running database. If no DATABASE_URL is available, generate migrations only (`drizzle-kit generate`) and defer push to Phase 2 (Docker). The schema.ts itself is validated by the build.

**Missing dependencies with no fallback:**
- None. All required tools are available.

## Project Constraints (from CLAUDE.md)

- **No mocks/tests:** NEVER write test files, mocks, or stubs. Discard test files from branches during merge.
- **Agent SDK auth:** `delete process.env.CLAUDECODE` must be preserved in all 12 AI files after merge.
- **Dev server:** Use `next dev` (NOT --turbopack). Not relevant for this phase (build-only).
- **Merge safety:** One merge at a time, validate after each (aligns with D-09).
- **Codebase exploration first:** Read actual files before planning conflict resolution.
- **drizzle-kit push may hang:** On interactive prompts for new enums/columns. Use direct SQL as workaround.

## Open Questions

1. **Spec audit depth for "missing" spec numbers (002-004, 008-011, 014)**
   - What we know: These spec directories were never created. They are not gaps in implementation.
   - What's unclear: Were these spec numbers intentionally skipped, or do they represent features that were implemented without spec directories?
   - Recommendation: The audit should verify these numbers were never part of the development plan. If they map to features that exist in the codebase without specs, document them but do not treat as gaps.

2. **DATABASE_URL availability for drizzle-kit push**
   - What we know: drizzle-kit push requires a running PostgreSQL connection.
   - What's unclear: Whether a local or Neon database is available during Phase 1 execution.
   - Recommendation: If no database is available, use `drizzle-kit generate` only (produces migration SQL files). Defer `drizzle-kit push` to Phase 2 (Docker) when a local Postgres container is available. The schema.ts file itself is validated by the TypeScript build.

3. **035 tier classification**
   - What we know: CONTEXT.md places 035 in "schema-touching" tier. Research shows 035 does NOT modify schema.ts.
   - What's unclear: Whether the user intended 035 in this tier for ordering reasons or believed it modified schema.
   - Recommendation: Follow the locked merge order (D-04) exactly as specified. The fact that 035 does not modify schema makes it easier, not harder. No migration regeneration needed for 035.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `git worktree list`, `git diff --stat`, `git merge-base`, `git diff --name-only` for all 10 branches
- `packages/db/src/schema.ts` line counts: main=2902, 031=2880, 034=2909, 040=2521
- `packages/db/migrations/meta/_journal.json` - migration journal state on main
- `.auto-claude/specs/` directory listing - 22 of 30 spec numbers present

### Secondary (MEDIUM confidence)
- `.planning/research/PITFALLS.md` - Schema merge conflict analysis (Pitfalls 1, 9, 13)
- `.planning/research/ARCHITECTURE.md` - Merge order recommendations
- `.planning/research/SUMMARY.md` - Overall project research context

### Tertiary (LOW confidence)
- Merge conflict severity: Cannot assess actual conflict difficulty without running each merge. `git merge-tree` could provide preview but conflict resolution effort depends on semantic understanding of each file's purpose.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new tools needed, all verified installed
- Architecture: HIGH - Merge order, conflict hotspots, and schema strategy all derived from actual git analysis
- Pitfalls: HIGH - Based on direct branch inspection (line counts, file overlaps, test file detection)

**Research date:** 2026-03-23
**Valid until:** Until first merge changes the state (each merge changes the conflict landscape for subsequent merges)
