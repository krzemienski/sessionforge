# Contributing to SessionForge

Thank you for taking the time to contribute. This document covers everything you need to make a clean, mergeable contribution: code style, commit conventions, branch workflow, PR process, and step-by-step walkthroughs for adding the most common extension points.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Development Setup](#development-setup)
- [Code Style](#code-style)
- [TypeScript Conventions](#typescript-conventions)
- [Commit Conventions](#commit-conventions)
- [Branch Workflow](#branch-workflow)
- [Pull Request Process](#pull-request-process)
- [How To: Add a New AI Agent](#how-to-add-a-new-ai-agent)
- [How To: Add a New API Route](#how-to-add-a-new-api-route)
- [How To: Add a New Database Table](#how-to-add-a-new-database-table)
- [Testing Your Changes](#testing-your-changes)

---

## Prerequisites

Before you start, make sure you have the exact tool versions the project requires:

| Tool | Version | Install |
|------|---------|---------|
| **Bun** | ≥ 1.2.4 | `curl -fsSL https://bun.sh/install \| bash` |
| **Node.js** | ≥ 20 | via [nvm](https://github.com/nvm-sh/nvm) or direct download |

You also need all external services configured. See [README.md — Local Setup](./README.md#local-setup) for a full walkthrough.

---

## Development Setup

```bash
# 1. Fork and clone
git clone https://github.com/your-username/sessionforge.git
cd sessionforge

# 2. Install all workspace dependencies
bun install

# 3. Configure environment
cp .env.example apps/dashboard/.env.local
# Edit apps/dashboard/.env.local with your credentials

# 4. Push database schema
bun db:push

# 5. Start development server (all apps, with Turbopack)
bun dev
```

The dashboard is available at [http://localhost:3000](http://localhost:3000).

---

## Code Style

SessionForge uses **ESLint** (configured per package) with **TypeScript strict mode**. The
formatter is the project's ESLint rules — there is no separate Prettier config.

Run the linter before every commit:

```bash
bun lint
```

### Key rules to follow

**No `console.log` in committed code.**
Use structured error objects and let the caller handle logging. In API routes,
return a `NextResponse.json({ error: message }, { status: 500 })`.

**No `any` types.**
Use `unknown` for truly unknown values, then narrow with `instanceof` or type guards.
The only acceptable `any` is a typed assertion (`as Anthropic.Tool[]`) where the SDK
demands it — comment it.

**Prefer explicit return types on exported functions.**

```typescript
// ✅ Correct
export function streamBlogWriter(input: BlogWriterInput): Response { ... }

// ❌ Avoid
export function streamBlogWriter(input: BlogWriterInput) { ... }
```

**Async error handling.**
Always wrap async operations in try/catch. In agent files, errors are surfaced via
`send("error", { message })` and then `close()` in the `finally` block.

```typescript
// ✅ Pattern used in all agents
try {
  // ... agent work
} catch (error) {
  send("error", {
    message: error instanceof Error ? error.message : String(error),
  });
} finally {
  close();
}
```

**No barrel re-exports (`index.ts`) inside `lib/`.**
Import directly from the module file to keep tree-shaking clean and avoid circular
dependency risk:

```typescript
// ✅ Correct
import { createSSEStream } from "@/lib/ai/orchestration/streaming";

// ❌ Avoid
import { createSSEStream } from "@/lib/ai/orchestration";
```

---

## TypeScript Conventions

### Typed input structs

Every agent and major function receives a typed input interface — never a plain
`Record<string, unknown>` or loose object:

```typescript
interface BlogWriterInput {
  workspaceId: string;
  insightId: string;
  tone?: BlogTone;             // optional with sensible default
  customInstructions?: string;
}
```

### Type narrowing with filter

Use typed filter callbacks rather than `as` casts to narrow union arrays:

```typescript
const toolUseBlocks = response.content.filter(
  (b): b is Anthropic.ContentBlock & { type: "tool_use" } =>
    b.type === "tool_use"
);
```

### String literal union types

Use string literal union types for bounded sets of values (e.g., agent names,
content types, tone options). Avoid enums — they compile to runtime code and
literal unions are simpler.

```typescript
type BlogTone = "technical" | "tutorial" | "conversational";
type AgentName = "insight-extractor" | "blog-writer" | "social-writer" | "changelog-writer" | "editor-chat";
```

---

## Commit Conventions

SessionForge uses the **Conventional Commits** specification. Every commit message must
follow this pattern:

```
<type>(<optional scope>): <short description>
```

### Types

| Type | When to use |
|------|-------------|
| `feat` | A new feature or capability |
| `fix` | A bug fix |
| `docs` | Documentation only — no code changes |
| `refactor` | Code restructuring with no behavior change |
| `chore` | Build system, dependency updates, tooling config |
| `test` | Adding or updating tests |
| `perf` | Performance improvement |

### Examples

```
feat: add newsletter agent with weekly digest format
fix: correct session path decoding for Windows-style separators
docs: add JSDoc to insight-extractor agent
refactor: extract dispatchTool into shared orchestration helper
chore: upgrade turbo to 2.5
```

### Rules

- Use the **imperative mood** in the description ("add", not "added" or "adds").
- Keep the description under **72 characters**.
- Reference GitHub issues in the commit body if applicable: `Closes #42`.
- Do not end the description with a period.

---

## Branch Workflow

SessionForge uses a **trunk-based development** model with short-lived feature branches.

```
main                    # always deployable; protected
 └── feat/new-agent     # your work lives here
```

### Creating a branch

```bash
# From an up-to-date main
git checkout main
git pull origin main
git checkout -b feat/your-feature-name
```

### Branch naming

| Prefix | Purpose |
|--------|---------|
| `feat/` | New feature |
| `fix/` | Bug fix |
| `docs/` | Documentation |
| `refactor/` | Refactoring |
| `chore/` | Maintenance |

Use **kebab-case** after the prefix: `feat/changelog-agent-html-output`.

### Keeping in sync

Rebase (not merge) against `main` to keep history clean:

```bash
git fetch origin
git rebase origin/main
```

---

## Pull Request Process

1. **Open a draft PR early** — this signals you're working on something and gets feedback
   sooner.

2. **Fill in the PR description** with:
   - What problem this solves
   - How you tested it
   - Screenshots/screen recordings for UI changes
   - Any follow-up work deferred to separate PRs

3. **Self-review your diff** before requesting a review. Check:
   - No debug `console.log` statements
   - No accidentally committed `.env.local` or secrets
   - All new functions have explicit return types
   - `bun lint` passes with zero errors

4. **Mark ready for review** — convert from draft when the checklist above is complete.

5. **Squash merges only.** The maintainer will squash all commits in a PR into one
   conventional commit on `main`. Make sure your PR title follows the commit convention
   format — it becomes the final commit message.

6. **Branch deletion** — delete your branch after merge.

### PR checklist

Before marking ready:

- [ ] `bun lint` passes
- [ ] `bun build` completes without errors
- [ ] New agent files have JSDoc comments explaining purpose, inputs, and outputs
- [ ] Environment variables added to `.env.example` (not `.env.local`)
- [ ] Database schema changes include a `bun db:generate` migration

---

## How To: Add a New AI Agent

All agents follow the identical agentic loop pattern. Here is the step-by-step process
to add, for example, a `newsletter-writer` agent.

### 1. Create the agent file

`apps/dashboard/src/lib/ai/agents/newsletter-writer.ts`

Follow the exact structure from `blog-writer.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { getModelForAgent } from "../orchestration/model-selector";
import { getToolsForAgent } from "../orchestration/tool-registry";
import { handleInsightTool } from "../tools/insight-tools";
import { handlePostManagerTool } from "../tools/post-manager";
import { createSSEStream, sseResponse } from "../orchestration/streaming";
import { NEWSLETTER_PROMPT } from "../prompts/newsletter";

const client = new Anthropic();

interface NewsletterWriterInput {
  workspaceId: string;
  insightIds: string[];       // newsletters aggregate multiple insights
  lookbackDays?: number;
}

export function streamNewsletterWriter(input: NewsletterWriterInput): Response {
  const { stream, send, close } = createSSEStream();

  const run = async () => {
    try {
      const model = getModelForAgent("newsletter-writer");
      const tools = getToolsForAgent("newsletter-writer");

      const messages: Anthropic.MessageParam[] = [
        { role: "user", content: `Create a newsletter from insights: ${input.insightIds.join(", ")}` },
      ];

      send("status", { phase: "starting", message: "Initializing newsletter writer..." });

      let response = await client.messages.create({
        model,
        max_tokens: 8192,
        system: NEWSLETTER_PROMPT,
        tools: tools as Anthropic.Tool[],
        messages,
      });

      while (response.stop_reason === "tool_use") {
        const toolUseBlocks = response.content.filter(
          (b): b is Anthropic.ContentBlock & { type: "tool_use" } =>
            b.type === "tool_use"
        );

        for (const toolUse of toolUseBlocks) {
          send("tool_use", { tool: toolUse.name, input: toolUse.input });
        }

        const toolResults: Anthropic.MessageParam = {
          role: "user",
          content: await Promise.all(
            toolUseBlocks.map(async (toolUse) => {
              try {
                const result = await dispatchTool(input.workspaceId, toolUse.name, toolUse.input as Record<string, unknown>);
                send("tool_result", { tool: toolUse.name, success: true });
                return { type: "tool_result" as const, tool_use_id: toolUse.id, content: JSON.stringify(result) };
              } catch (error) {
                const errMsg = error instanceof Error ? error.message : String(error);
                send("tool_result", { tool: toolUse.name, success: false, error: errMsg });
                return { type: "tool_result" as const, tool_use_id: toolUse.id, content: `Error: ${errMsg}`, is_error: true };
              }
            })
          ),
        };

        messages.push({ role: "assistant", content: response.content });
        messages.push(toolResults);

        response = await client.messages.create({ model, max_tokens: 8192, system: NEWSLETTER_PROMPT, tools: tools as Anthropic.Tool[], messages });
      }

      for (const block of response.content) {
        if (block.type === "text") send("text", { content: block.text });
      }

      send("complete", { usage: response.usage });
    } catch (error) {
      send("error", { message: error instanceof Error ? error.message : String(error) });
    } finally {
      close();
    }
  };

  run();
  return sseResponse(stream);
}

async function dispatchTool(workspaceId: string, toolName: string, toolInput: Record<string, unknown>): Promise<unknown> {
  if (toolName.startsWith("get_insight") || toolName === "get_top_insights") {
    return handleInsightTool(workspaceId, toolName, toolInput);
  }
  if (toolName === "create_post" || toolName === "update_post") {
    return handlePostManagerTool(workspaceId, toolName, toolInput);
  }
  throw new Error(`Unknown tool: ${toolName}`);
}
```

### 2. Register in `model-selector.ts`

Open `apps/dashboard/src/lib/ai/orchestration/model-selector.ts` and add
`"newsletter-writer"` to the `AgentName` type and its model mapping. Newsletter
writers are high-quality output, so use `claude-opus-4-5-20250514`.

### 3. Register in `tool-registry.ts`

Open `apps/dashboard/src/lib/ai/orchestration/tool-registry.ts` and add the
`"newsletter-writer"` entry to `AGENT_TOOL_SETS`. Choose the minimal set of tool
groups the agent needs (e.g., `["insight", "post"]`).

### 4. Create the system prompt

`apps/dashboard/src/lib/ai/prompts/newsletter.ts`

```typescript
export const NEWSLETTER_PROMPT = `You are a newsletter writer...`;
```

### 5. Create the API route

`apps/dashboard/src/app/api/agents/newsletter/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { streamNewsletterWriter } from "@/lib/ai/agents/newsletter-writer";

export async function POST(req: NextRequest): Promise<Response> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  return streamNewsletterWriter({
    workspaceId: body.workspaceId,
    insightIds: body.insightIds,
    lookbackDays: body.lookbackDays,
  });
}
```

### 6. Wire up the frontend

Add a `generateNewsletter` mutation in the relevant TanStack Query hook
(`apps/dashboard/src/hooks/use-content.ts`) that streams from the new route.

---

## How To: Add a New API Route

API routes live in `apps/dashboard/src/app/api/`. They use Next.js App Router
conventions with the following pattern:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { yourTable } from "@sessionforge/db";
import { eq } from "drizzle-orm";

// GET /api/your-resource
export async function GET(req: NextRequest): Promise<NextResponse> {
  // 1. Auth check — always first
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse params/query
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  // 3. Query DB
  try {
    const rows = await db
      .select()
      .from(yourTable)
      .where(eq(yourTable.userId, session.user.id));

    return NextResponse.json(rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

Rules:
- Auth check is always the **first thing** in every handler.
- Return `NextResponse.json` for all responses, including errors.
- Wrap DB calls in try/catch and return a `500` on failure.
- For SSE streaming agents, return a plain `Response` (not `NextResponse`) — see
  the agent API routes for examples.

---

## How To: Add a New Database Table

SessionForge uses **Drizzle ORM** with a Neon PostgreSQL database. All schema
definitions live in `packages/db/src/schema.ts`.

### 1. Define the table in the schema

```typescript
// packages/db/src/schema.ts

export const newsletters = pgTable("newsletters", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content"),
  status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// If there are relations to other tables, add them to the existing relations blocks
export const newslettersRelations = relations(newsletters, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [newsletters.workspaceId],
    references: [workspaces.id],
  }),
}));
```

### 2. Push the schema (development)

```bash
bun db:push
```

Drizzle introspects the schema and applies only the additive changes. Safe to run
multiple times.

### 3. Generate a migration (for production / PR)

```bash
bun db:generate
```

This creates a SQL file in `packages/db/migrations/`. Commit this file alongside
your schema changes.

### 4. Export from the package

Make sure the new table is re-exported from `packages/db/src/index.ts` (or wherever
the package's public surface is) so application code can import it cleanly:

```typescript
import { newsletters } from "@sessionforge/db";
```

---

## Testing Your Changes

SessionForge does not currently have an automated test suite. Verification is manual:

### Before submitting a PR

```bash
# TypeScript — zero errors
bunx tsc --noEmit -p apps/dashboard/tsconfig.json

# Lint — zero warnings or errors
bun lint

# Production build — must succeed
bun build
```

### Feature-specific checks

| Area | What to verify |
|------|----------------|
| New agent | SSE events stream correctly in browser DevTools → Network tab |
| New API route | Test with `curl` or a REST client; verify auth rejection on missing session |
| New DB table | `bun db:push` succeeds; table visible in Neon dashboard |
| UI components | Render without console errors in both light and dark themes |
| Session scanning | `POST /api/sessions/scan` indexes sessions from `~/.claude/` correctly |

---

## Questions?

Open a [GitHub Discussion](https://github.com/your-username/sessionforge/discussions)
for design questions or architectural feedback. Reserve GitHub Issues for confirmed
bugs or specific feature requests with clear acceptance criteria.
