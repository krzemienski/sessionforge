# Contributing to SessionForge

Guidelines for contributing to the SessionForge project.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 18+ | Or use Bun runtime directly |
| Bun | 1.2.4+ | Package manager and runtime |
| PostgreSQL | 14+ | Local instance or [Neon](https://neon.tech) serverless |
| Claude CLI | Latest | Authenticated via `claude login` — required for AI features |

No `ANTHROPIC_API_KEY` is needed. AI features use `@anthropic-ai/claude-agent-sdk`, which inherits authentication from your Claude CLI session.

---

## Development Setup

```bash
# Clone the repository
git clone https://github.com/nick/sessionforge.git
cd sessionforge

# Install dependencies
bun install

# Setup environment variables
cp .env.example .env.local
# Edit .env.local — required vars:
#   NEON_DATABASE_URL (PostgreSQL connection string)
#   BETTER_AUTH_SECRET (auth signing key)
# Optional:
#   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
#   UPSTASH_QSTASH_TOKEN
#   Platform OAuth credentials (GitHub, Twitter, LinkedIn)

# Push schema to database
bun run db:push

# Start development server
bun run dev
# Runs on http://localhost:3000
```

**Important:** Use `next dev` (not `--turbopack`). Turbopack has known issues with drizzle-orm relation resolution in this project.

After changing routes, schema, or server configuration, restart the dev server to avoid stale cache errors.

---

## Project Structure

```
sessionforge/
├── apps/dashboard/          # Next.js 15 application
│   └── src/
│       ├── app/             # Pages and API routes
│       ├── components/      # React components
│       ├── hooks/           # TanStack Query hooks
│       └── lib/             # Business logic, agents, integrations
└── packages/db/             # Shared Drizzle ORM schema
```

For a comprehensive architecture overview, see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Code Standards

Full standards are documented in [code-standards.md](./code-standards.md). Key points:

- **File naming:** kebab-case for all files and folders
- **File size:** Target 200-400 lines, max 800
- **Exports:** Named exports only (no default exports)
- **Components:** `"use client"` directive on all client components; props defined as `<Name>Props` interface
- **API routes:** Auth check at top of every handler; Zod validation for request bodies; `NextResponse.json()` for responses
- **Imports:** Use `@/` path alias for local imports, `@sessionforge/db` for schema
- **State:** TanStack Query for server state, React Context + useState for client state
- **AI:** Import only from `@anthropic-ai/claude-agent-sdk`; never use `@anthropic-ai/sdk` or set `ANTHROPIC_API_KEY`

---

## Development Workflow

1. **Plan** — Understand the scope. Read related files before writing any code.
2. **Implement** — Follow existing patterns. Keep files small and focused.
3. **Validate** — Test through the actual browser UI. No mock files, no test harnesses, no stubs. Run the real application and verify features work end-to-end.
4. **Review** — Self-review for logic errors, missing error handling, and code standard compliance.
5. **Commit** — Use conventional commits. Push to a feature branch and open a PR.

---

## Commit Messages

Use [conventional commits](https://www.conventionalcommits.org/) format:

```
<type>: <description>

<optional body>
```

| Type | Usage |
|------|-------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code restructuring without behavior change |
| `docs` | Documentation updates |
| `chore` | Build config, dependencies, tooling |
| `perf` | Performance improvement |
| `ci` | CI/CD pipeline changes |

Examples:

```
feat: add WordPress publishing integration
fix: resolve SEO panel auto-refresh on save
refactor: decompose content page into focused components
docs: update architecture diagram with analytics flow
```

---

## Pull Requests

1. Create a feature branch from `main`
2. Make focused, atomic commits
3. Include a clear description of what changed and why
4. Provide validation evidence (screenshots, build output, or logs showing the feature works)
5. Ensure production build passes: `bun run build`

---

## Validation Policy

SessionForge does not use test files, mocks, or test frameworks. All validation is done through the real running application:

- Start the dev server (`bun run dev`)
- Exercise the feature through the browser UI
- Verify behavior matches expectations
- Capture screenshots or logs as evidence when submitting PRs

This ensures every feature is validated in the environment users actually experience.

---

## Getting Help

- **Architecture:** [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Code standards:** [code-standards.md](./code-standards.md)
- **API reference:** [api-reference.md](./api-reference.md)
- **Module guide:** [code-modules.md](./code-modules.md)
