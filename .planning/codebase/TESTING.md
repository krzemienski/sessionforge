# Testing Patterns

**Analysis Date:** 2026-03-22

## Project Mandate

**This project uses functional validation, not unit testing as primary QA.**

The project mandate (enforced via Claude hooks) is:
- NEVER write mocks, stubs, test doubles, unit tests, or test files
- ALWAYS build and run the real system
- Validate through actual user interfaces (browser UI via Playwright MCP)
- Capture screenshots/logs as evidence before claiming completion

Despite this mandate, a body of library-level tests DOES exist in `__tests__/` directories. These are integration tests for pure library functions (no server, no browser required) written in bun:test.

## Test Framework

**Runner:**
- `bun:test` — Bun's built-in test runner (no separate install)
- Config: `apps/dashboard/tsconfig.json` explicitly excludes `**/__tests__/**` and `**/*.test.ts` from TypeScript compilation (tests run directly via Bun)

**Assertion Library:**
- Bun's built-in `expect()` — Jest-compatible API

**Run Commands:**
```bash
# Run all tests in the dashboard app
cd apps/dashboard && bun test

# Run tests matching a pattern
cd apps/dashboard && bun test --filter "static-site"

# Run a specific test file
cd apps/dashboard && bun test src/lib/export/__tests__/static-site-e2e.test.ts

# Watch mode
cd apps/dashboard && bun test --watch
```

**CI:**
- Tests run in `.github/workflows/test.yml` and `.github/workflows/e2e.yml`
- Main CI (`ci.yml`) runs: type check → lint → build → schema drift check
- Tests are NOT in the primary CI job — they run in a separate workflow

## Test File Organization

**Location:** Co-located with source in `__tests__/` subdirectories

**Naming:** `{subject}.test.ts` — matches the module being tested

**Structure:**
```
src/lib/export/
├── static-site-builder.ts
├── markdown-export.ts
├── rss-generator.ts
├── sitemap-generator.ts
└── __tests__/
    ├── static-site-e2e.test.ts       # Integration: full pipeline
    ├── github-pages-deployment.test.ts # Integration: deployment requirements
    └── lighthouse-audit.test.ts       # Integration: HTML quality checks

src/lib/sessions/
├── parser.ts
├── normalizer.ts
├── indexer.ts
└── __tests__/
    ├── parser.test.ts
    ├── normalizer.test.ts
    └── indexer.test.ts

src/lib/ai/agents/
├── blog-writer.ts
└── __tests__/
    └── blog-writer.test.ts

src/lib/
├── permissions.ts
├── workspace-auth.ts
└── __tests__/
    ├── permissions.test.ts
    └── workspace-auth.test.ts
```

All test files under `apps/dashboard/src/`:
- `src/lib/export/__tests__/` — static site export, GitHub Pages, Lighthouse audit
- `src/lib/sessions/__tests__/` — parser, normalizer, indexer, scanner
- `src/lib/ai/agents/__tests__/` — blog-writer, insight-extractor, newsletter-writer, social-writer
- `src/lib/ai/tools/__tests__/` — post-manager, post-manager-unit
- `src/lib/automation/__tests__/` — cron-utils, file-watcher, pipeline
- `src/lib/citations/__tests__/` — extractor, formatter, renderer, export
- `src/lib/writing-coach/__tests__/` — ai-pattern-detector, authenticity-scorer, vocab-diversity
- `src/lib/__tests__/` — permissions, workspace-auth
- `src/app/api/__tests__/` — insights

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "bun:test";

describe("parseSessionFile", () => {
  afterEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
  });

  describe("non-existent or empty files", () => {
    it("returns empty result for non-existent file", async () => {
      const result = await parseSessionFile(join(TMP_DIR, "no-such-file.jsonl"));
      expect(result.messageCount).toBe(0);
    });
  });

  describe("message counting", () => {
    it("counts human messages", async () => {
      // ...
    });
  });
});
```

**Patterns:**
- `beforeAll` for expensive shared setup (building ZIPs, pre-loading fixtures)
- `afterEach` for cleanup (deleting temp directories)
- `beforeEach` for resetting mutable state between tests
- Nested `describe` blocks group related behaviors within a subject

## Mocking

**Framework:** `bun:test`'s `mock()` and `mock.module()`

**Pattern for agent tests** (modules with side effects):
```typescript
import { describe, it, expect, mock, beforeAll } from "bun:test";

// 1. Create stable mock references BEFORE imports
const mockRunAgentStreaming = mock(
  (_opts: unknown, _meta?: unknown): Response =>
    new Response("data: mock\n\n", { headers: { "Content-Type": "text/event-stream" } })
);

// 2. Register module mocks BEFORE dynamic import of the module under test
mock.module("../../agent-runner", () => ({
  runAgentStreaming: mockRunAgentStreaming,
}));

mock.module("@/lib/templates/db-operations", () => ({
  getTemplateById: mockGetTemplateById,
  incrementTemplateUsage: mockIncrementTemplateUsage,
}));

// 3. Dynamically import the module under test AFTER mock registration
const { streamBlogWriter } = await import("../blog-writer");
```

**What to Mock:**
- External I/O: file system operations, database queries, network calls
- Agent SDK (`@anthropic-ai/claude-agent-sdk`) — never invoke real AI in tests
- MCP server factory (`createAgentMcpServer`) — prevents real server spawning

**What NOT to Mock:**
- Pure functions operating on in-memory data (parsers, formatters, validators)
- ZIP generation (`buildStaticSiteZip`) — tested via real in-process invocation
- Library utilities (`cn`, `formatDuration`) — tested directly

## Test Data

**Pattern: Named constants with typed mock data**
```typescript
const MOCK_POSTS: ExportablePost[] = [
  {
    id: "post-001",
    title: "Getting Started with TypeScript",
    markdown: `# Getting Started with TypeScript\n\n...`,
    contentType: "tutorial",
    status: "published",
    createdAt: new Date("2024-01-15T10:00:00Z"),
    updatedAt: new Date("2024-01-16T12:00:00Z"),
    platformFooterEnabled: false,
    durationMinutes: 45,
  },
  // ...
];
```

**Temp file helpers** for file system tests:
```typescript
const TMP_DIR = join(import.meta.dir, "__tmp_parser_tests__");

async function writeTmpFile(name: string, content: string): Promise<string> {
  await mkdir(TMP_DIR, { recursive: true });
  const filePath = join(TMP_DIR, name);
  await writeFile(filePath, content, "utf8");
  return filePath;
}
```
Always clean up in `afterEach`: `await rm(TMP_DIR, { recursive: true, force: true })`

**Location:** Test data defined inline in test files — no shared fixture directory

## Test Types Present

**Integration tests (dominant pattern):**
- Exercise full library pipelines end-to-end without a running server
- Example: `buildStaticSiteZip()` → inspect ZIP contents for correctness
- Files: `static-site-e2e.test.ts`, `github-pages-deployment.test.ts`, `lighthouse-audit.test.ts`

**Unit tests (pure functions):**
- Direct calls to pure functions, assert return values
- Example: `permissions.test.ts` — calls `hasPermission(ROLES.VIEWER, PERMISSIONS.CONTENT_READ)`
- Files: `permissions.test.ts`, `parser.test.ts`, `cron-utils.test.ts`

**Agent unit tests (mocked I/O):**
- Mock all external dependencies; verify prompt construction, delegation, parameter passing
- Files: `blog-writer.test.ts`, `newsletter-writer.test.ts`, `social-writer.test.ts`

**NOT present:**
- React component tests (no component rendering)
- API route tests via HTTP (integration via real server not in test suite)
- E2E browser tests via Playwright in test suite (done manually via Playwright MCP)

## Functional Validation (Primary QA Method)

The primary validation approach for features is **manual functional validation** through the running UI:

**Process:**
1. Start dev server: `cd apps/dashboard && bun dev` (port 3000)
2. Exercise feature through browser UI (Playwright MCP)
3. Capture screenshots as evidence
4. Verify actual state (DB queries, API responses, UI state)
5. Evidence stored in `e2e-evidence/` and `evidence/` directories

**Manual test checklists:** `tests/MANUAL_TEST_CHECKLIST.md` — step-by-step UI flows with SQL verification queries

**Shell scripts for API smoke testing:** `tests/quick-api-test.sh`, `tests/verify-database.sh`

## CI Validation Pipeline

**`ci.yml` (runs on every push/PR to main):**
```
type check (tsc --noEmit) → lint (ESLint) → build (Next.js) → schema drift (drizzle-kit)
```

**`test.yml`:** Runs `bun:test` suite
**`e2e.yml`:** E2E workflow (separate from CI)

**Schema drift check:** `bunx drizzle-kit generate --check` — exits non-zero if Drizzle schema is out of sync with committed migration files. Does NOT require a live database.

## Coverage

**Requirements:** No coverage thresholds enforced — no `--coverage` flag in scripts

**Gaps (by design):**
- React components have no test coverage
- API route handlers have no test coverage
- AI agent streaming (real SSE) has no test coverage
- The mandate is functional validation via UI, not test coverage metrics

## Common Patterns

**Async testing:**
```typescript
it("generates a valid ZIP buffer", async () => {
  const buffer = await buildStaticSiteZip(MOCK_POSTS, { themeId });
  expect(buffer).toBeInstanceOf(Buffer);
  expect(buffer.length).toBeGreaterThan(1000);
});
```

**Parameterized tests across variants:**
```typescript
const THEMES: ThemeId[] = ["minimal-portfolio", "technical-blog", "changelog"];

describe.each(THEMES)("Theme: %s", (themeId) => {
  it("generates a valid ZIP buffer", async () => { /* ... */ });
  it("includes index.html", () => { /* ... */ });
});
```

**Shared setup with `beforeAll`:**
```typescript
beforeAll(async () => {
  for (const themeId of THEMES) {
    const buffer = await buildStaticSiteZip(SAMPLE_POSTS, { themeId });
    zips[themeId] = await JSZip.loadAsync(buffer);
  }
});
```

**Content assertions (string/XML/HTML inspection):**
```typescript
expect(indexHtml).toContain("<!DOCTYPE html>");
expect(sitemapXml).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
expect(rssXml).not.toContain("localhost");
```

---

*Testing analysis: 2026-03-22*
