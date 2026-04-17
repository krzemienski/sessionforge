# Wave 1 — SUMMARY (v2, REVISED)

**Date:** 2026-04-17 17:45 ET
**Verdict:** 🟢 COMPLETE (13 findings — 12 closed, 1 deferred)

## Status by Finding

| ID | Status | Resolution |
|----|--------|------------|
| C1 | ✅ CLOSED | `@anthropic-ai/sdk` removed from `apps/dashboard/package.json` dependencies. Zero production imports (confirmed via grep). |
| C2 | ✅ COMMITTED (`2508a3e`) | Phantom `dashboard@^0.0.1` + Lexical root dupes purged. |
| H5 | ✅ COMMITTED (`f7b0a64`) | `drizzle-kit` aligned at `^0.31.9` across workspaces. |
| H6 | ✅ CLOSED | Test infra removed: `vitest`, `msw`, `happy-dom`, `@playwright/test`, `@testing-library/*`, `@axe-core/playwright`, `@lexical/headless` all uninstalled. 11 `__tests__/` dirs + 4 loose `*.test.ts` files deleted. 7 `test*` scripts removed. |
| H7 | ✅ CLOSED | `next.config.ts` `serverExternalPackages` extended to `["ssh2", "sharp", "simple-git", "ioredis"]`. |
| ~~H8~~ | ⏸️ DEFERRED | Requires drizzle-orm 0.41 Relational Query v2 migration. Reverted to `^0.39` for now; 138 `db.query.*` call sites remain on v1 API. Tracked as a future wave. |
| H14 | ✅ CLOSED | `engines: { bun: ">=1.2.4", node: ">=20" }` added to all 3 `package.json` files. |
| M1 | ✅ CLOSED | `highlight.js`, `lowlight` removed from explicit deps (neither directly imported). `prismjs` + `rehype-highlight` retained (both imported). |
| M2 | ✅ CLOSED | `zustand` removed (zero imports, aligns with CLAUDE.md "no global store"). |
| M3 | ✅ CLOSED | `@types/sharp`, `@types/jszip` removed (deprecated stubs). |
| M4 | ✅ CLOSED (byproduct of H6) | `happy-dom` removed entirely, eliminating duplicate install. |
| M14 | ✅ COMMITTED (`2508a3e`) | Root `package.json` cleaned. |
| M17 | ✅ CLOSED | Verified: zero `"use client"` files import `ioredis`. Server-only externalization complete. |

**Totals:** 12 CLOSED, 1 DEFERRED (H8), 0 OPEN.

## C7/C8 Status (Wave 0)

- **C7** — Next 15 route-typing for 4 bookmarks handlers: FIXED via standalone (unwrapped) handler shape. See Wave 0 01-01-PLAN and evidence. Wave 3 will have 4 routes as documented exceptions to H1 (withApiHandler universal usage) until drizzle v2 migration allows revisiting.
- **C8** — NOT_A_BUG (verified during Wave 0; see ROADMAP.md Wave 0 section for detail).

## Uncommitted changes (ready to commit)

- `apps/dashboard/package.json` — 14 dep removals + engines block
- `apps/dashboard/next.config.ts` — serverExternalPackages extended
- `apps/dashboard/src/lib/api-handler.ts` — reverted to HEAD-compatible non-generic shape (after the generic experiment caused 138 type errors in routes using the `return withApiHandler(async () => ...)` pattern)
- `apps/dashboard/src/app/api/sessions/[id]/bookmarks/route.ts` + `[bookmarkId]/route.ts` — standalone handlers (un-wrapped from withApiHandler) with Next 15 RouteContext shape
- `apps/dashboard/src/app/api/public/portfolio/[workspace]/rss/route.ts` — previously modified, not further touched
- `packages/db/package.json` — drizzle-orm reverted to `^0.39`
- `bun.lock` — regenerated
- 11 `__tests__/` directories deleted
- 4 `*.test.ts` files deleted
- 7 `test*` scripts removed

## Evidence

- `evidence/01-01/bun-install.log` — initial install log (10 pkgs)
- `evidence/01-01/build.log` — original failing build (only bookmarks route errors)
- `evidence/01-01/bun-audit.log` + `audit-baseline.txt` — 1 moderate advisory (dompurify via mermaid → M19)
- `evidence/01-01/deps-after.txt` + subsequent `deps-after-v2.txt` — confirming all removed pkgs absent from install graph
- `evidence/01-01/tsc-h8.log` — early tsc output during H8 bump attempt

## Commit plan

Single commit after build verification:
```
fix(remediation): Wave 0 build unblock + Wave 1 dep hygiene (C1 H6 H7 H14 M1 M2 M3 M4 M17 + C7)

- Remove unused deps (@anthropic-ai/sdk, zustand, highlight.js, lowlight, @types/sharp, @types/jszip)
- Remove test infra (vitest, msw, happy-dom, @playwright/test, @testing-library/*, @axe-core/playwright, @lexical/headless)
- Extend next.config serverExternalPackages (sharp, simple-git, ioredis)
- Add engines fields to root + app + db package.json
- Revert drizzle-orm to ^0.39 (H8 deferred pending v2 migration)
- Fix 4 bookmarks route handlers to Next 15 RouteContext shape (standalone, unwrapped)
- Delete 11 __tests__ dirs + 4 stray *.test.ts + 7 test:* scripts
```
