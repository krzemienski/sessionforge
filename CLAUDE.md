# SessionForge Project Instructions

## AI / Agent SDK Architecture (CRITICAL — READ EVERY SESSION)

This project uses `@anthropic-ai/claude-agent-sdk` exclusively for all AI features. The SDK's `query()` function inherits authentication directly from the Claude CLI session — there are NO API keys, NO ANTHROPIC_API_KEY env vars, NO local AI configuration. The SDK spawns the `claude` CLI subprocess which uses the logged-in user's credentials automatically.

**NEVER:**
- Suggest setting up ANTHROPIC_API_KEY or any AI-related env vars
- Assume the AI features need "local environment" API key configuration
- Propose alternative AI SDKs or direct API calls — everything goes through `query()`

**ALWAYS:**
- Remember: `delete process.env.CLAUDECODE` is required before any `query()` call in dev (prevents nested session rejection)
- All 12 SDK files already have this fix applied
- MCP tools provided to agents query the SessionForge database only — no external API keys needed

## Codebase Exploration First

NEVER plan or propose fixes based on prior session context or stale audit data. ALWAYS read the actual current codebase files before producing any plan, remediation, or audit. If you catch yourself writing a plan without having used Read/Grep/Glob first, stop and explore.

## Dev Server Management

After making code changes to routes or schema, always restart the dev server before running smoke tests. Stale Turbopack/Next.js caches cause false 500 errors. Prefer `next dev` over `next dev --turbopack` unless explicitly asked — Turbopack has known issues with drizzle-orm relations resolving to undefined and broken workspace symlinks in bun monorepos.

## Database Migrations

When using drizzle-kit push, it may hang on interactive prompts for new enums or columns. Prefer direct SQL ALTER TABLE statements as a workaround. Always verify the live database schema matches the drizzle schema — tables and columns may be missing from the live DB even if defined in code.

## Git Operations

Always verify CWD before running git commands. In monorepo subdirectories, use paths relative to the current directory, not the monorepo root. Be aware that git hooks may block certain bash commands — if a command is blocked, switch to dedicated tools (Glob, Read, Edit) instead of bash workarounds.

## Observer/Memory Agent Auth

Before spawning observer or memory agents, verify they are authenticated. If an agent reports 'Not logged in', do not continue feeding it events — stop and fix auth first. This is a known recurring blocker.
