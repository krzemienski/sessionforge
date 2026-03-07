# Phase 06 — Code Deduplication & Cleanup

**Priority:** MEDIUM
**Status:** ✓ COMPLETED
**Effort:** Small (2-3 hours)
**Completed:** 2026-03-06

---

## Skills to Invoke

| Skill | When | Purpose |
|-------|------|---------|
| `/code-refactoring` | During all cleanup items | Safe refactoring patterns, dependency analysis |
| `/code-analyzer` | Before cleanup | Identify dead code, unused exports, circular dependencies |
| `/code-review` | After each cleanup item | Verify no regressions, no broken imports |
| `/gate-validation-discipline` | After ALL cleanup complete | Evidence-based verification of cleanup outcomes |

### Gate Validation Checklist (Phase 06)
- [x] **Evidence examined**: Read `parser.ts` — single `parseSessionLines()` function, no duplicated logic
- [x] **Evidence examined**: Grep output — no duplicate JSON Schema definitions in tool modules (single source of truth in `mcp-server-factory.ts`)
- [x] **Evidence examined**: Grep output — no imports referencing deleted observability components
- [x] **Evidence examined**: `package.json` — no unused dependencies (reactflow, dagre removed)
- [x] **Evidence examined**: `bun run build` output — zero errors, zero TypeScript warnings
- [x] **Evidence examined**: No console errors on any page (verify via Playwright)

---

## Context

Research identified several areas of code duplication and unnecessary complexity. This phase cleans them up after the UI changes are complete.

## Cleanup Items

### 1. Session Parser Deduplication

**File:** `src/lib/sessions/parser.ts`

`parseSessionFile()` and `parseSessionBuffer()` share ~270 lines of identical parsing logic.

**Fix:**
```ts
// Extract shared logic
function parseSessionLines(lines: string[]): ParsedSession { ... }

// Public functions become thin wrappers
export async function parseSessionFile(path: string): Promise<ParsedSession> {
  const content = await readFile(path, 'utf-8')
  return parseSessionLines(content.split('\n'))
}

export function parseSessionBuffer(buffer: Buffer): ParsedSession {
  return parseSessionLines(buffer.toString('utf-8').split('\n'))
}
```

### 2. Tool Schema Single Source of Truth

**Problem:** Tool schemas defined in two places:
- JSON Schema format in tool modules (e.g., `insight-tools.ts`)
- Zod schemas in `mcp-server-factory.ts`

**Fix:** Keep Zod schemas as source of truth in `mcp-server-factory.ts`. Remove duplicate JSON Schema definitions from tool modules if they're not used independently.

### 3. Remove Dead Observability Code

After Phase 04, clean up any orphaned imports, unused types, or dead code paths related to the removed observability components.

Run through:
- Remove `graph-state.ts` types (NodeType, ANALYSIS_AGENTS, etc.) if only used by deleted components
- Remove dagre layout utilities
- Remove React Flow node dimension configs

### 4. Remove Unused Route Files

After Phase 03 merges pages, delete the now-unused page files rather than leaving empty redirects:
- If redirects are handled at the middleware/layout level, the old page files can be deleted
- Verify no internal links reference the old routes

### 5. Clean Package Dependencies

After removing React Flow:
```bash
bun remove reactflow @dagrejs/dagre  # if no longer used
```

Audit other potentially unused dependencies.

---

## Files to Modify

- `src/lib/sessions/parser.ts` — Deduplicate
- `src/lib/ai/mcp-server-factory.ts` — Consolidate schemas
- Various observability files — Remove dead code
- `package.json` — Remove unused deps

## Success Criteria

- [x] Parser has single shared implementation
- [x] No duplicate tool schema definitions
- [x] No dead observability code
- [x] No unused dependencies
- [x] Production build passes
- [x] No TypeScript errors
