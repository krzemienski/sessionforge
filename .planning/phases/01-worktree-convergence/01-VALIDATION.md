---
phase: 1
slug: worktree-convergence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bun build + TypeScript compiler |
| **Config file** | `apps/dashboard/tsconfig.json` |
| **Quick run command** | `cd apps/dashboard && bun run build 2>&1 | tail -20` |
| **Full suite command** | `cd /Users/nick/Desktop/sessionforge && bun run build` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/dashboard && bun run build 2>&1 | tail -20`
- **After every plan wave:** Run `cd /Users/nick/Desktop/sessionforge && bun run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | AUDIT-01 | build | `bun run build` | ✅ | ⬜ pending |
| 01-01-02 | 01 | 1 | AUDIT-02 | build | `bun run build` | ✅ | ⬜ pending |
| 01-01-03 | 01 | 1 | AUDIT-03 | build | `bun run build` | ✅ | ⬜ pending |
| 01-01-04 | 01 | 1 | AUDIT-04 | build | `bun run build` | ✅ | ⬜ pending |
| 01-02-01 | 02 | 1 | CONV-01 | git+build | `git worktree list && bun run build` | ✅ | ⬜ pending |
| 01-02-02 | 02 | 2 | CONV-02 | git+build | `git merge --no-commit && bun run build` | ✅ | ⬜ pending |
| 01-02-03 | 02 | 2 | CONV-03 | git+build | `git log --oneline -5 && bun run build` | ✅ | ⬜ pending |
| 01-03-01 | 03 | 3 | CONV-04 | schema | `cd packages/db && bun run build` | ✅ | ⬜ pending |
| 01-03-02 | 03 | 3 | CONV-05 | build | `bun run build` | ✅ | ⬜ pending |
| 01-03-03 | 03 | 3 | CONV-06 | git | `git worktree list` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. No additional test framework needed — this phase validates through git operations and production builds.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Merge conflict resolution correctness | CONV-02, CONV-04 | Conflict resolution requires human judgment for schema merges | Review diff after each schema-touching merge, verify no data loss |
| Branch 038 skip rationale | CONV-03 | Documentation review | Confirm skip manifest entry explains 15K test file lines violating no-mock mandate |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
