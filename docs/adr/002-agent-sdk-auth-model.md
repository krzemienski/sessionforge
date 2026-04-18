# ADR 002: Agent SDK Auth Model (CLI-Inherited, Zero API Keys)

**Date:** 2026-04-18
**Status:** Accepted
**Deciders:** Nick (Engineering Lead)

---

## Context

SessionForge's core AI functionality relies on Claude API models for content generation, insights extraction, and real-time editing. The deployment model is **dual-layer:**

- **Local/self-hosted:** Developers run the app on their machines with filesystem access to `~/.claude/projects/`
- **Vercel/production:** The web UI and API routes run on Vercel; session scanning occurs from local dev environments

For the local deployment to work without storing API keys in environment variables or version control, the auth system needed to inherit credentials from an existing authenticated context. The `@anthropic-ai/claude-agent-sdk` offers exactly this: it spawns the `claude` CLI subprocess, which inherits authentication from the user's already-logged-in Claude Code session.

---

## Decision

**Use `@anthropic-ai/claude-agent-sdk` exclusively for all AI features, with zero API keys in environment variables.**

### Auth Flow

1. User logs into Claude Code via `claude auth login` (once per machine)
2. Claude Code session stores credentials in `~/.claude/` (OS-level security)
3. SessionForge calls `query()` from the Agent SDK, which spawns the `claude` CLI as a subprocess
4. The CLI subprocess inherits auth from the logged-in session
5. No API keys are stored, transmitted, or managed by SessionForge itself

### Implementation: Centralized CLAUDECODE Fix

When SessionForge runs inside a Claude Code session (itself), the parent process sets `CLAUDECODE` env var to prevent nested sessions. The SDK's subprocess rejects this as "nested session" (exit code 1).

**Solution:** Centralize the fix in `lib/ai/ensure-cli-auth.ts`:

```typescript
let cleared = false;

export function ensureCliAuth(): void {
  if (cleared) return;
  delete process.env.CLAUDECODE;
  cleared = true;
}
```

Every file importing `@anthropic-ai/claude-agent-sdk` calls `ensureCliAuth()` once at module load:

**Locations (12 files):**
- `apps/dashboard/src/lib/ai/agent-runner.ts:1–26` (agent orchestration entry point)
- `apps/dashboard/src/lib/ai/agents/style-learner.ts` (internal agent)
- `apps/dashboard/src/lib/seo/generator.ts` (SEO analysis)
- `apps/dashboard/src/lib/sessions/evidence-classifier.ts` (session classification)
- `apps/dashboard/src/lib/media/diagram-generator.ts` (diagram generation)
- `apps/dashboard/src/app/api/content/suggest-arcs/route.ts` (content suggestion)
- `apps/dashboard/src/app/api/content/[id]/supplementary/route.ts` (supplementary content)
- `apps/dashboard/src/app/api/content/[id]/supplementary/[suppId]/route.ts`
- `apps/dashboard/src/lib/ingestion/source-assembler.ts` (source ingestion)
- `apps/dashboard/src/lib/ingestion/text-processor.ts` (text processing)
- `apps/dashboard/src/lib/ingestion/repo-analyzer.ts` (repo analysis)

**Enforcement (as of 2026-03-04):**
- `block-api-key-references.js` hook — prevents any code write containing `ANTHROPIC_API_KEY` or `@anthropic-ai/sdk` imports
- `sdk-auth-subagent-enforcer.js` hook — injects SDK auth rules into every subagent spawn

---

## Consequences

### Positive
- **Zero key management:** No secrets to rotate, expose, or audit; eliminates API key sprawl across CI/CD
- **Simplified deployment:** Dev and production both inherit auth from user's CLI session
- **Local-first auth:** Respects developer's existing Claude Code login; zero additional setup
- **Audit trail:** All API calls attributable to the logged-in user's session

### Negative
- **CLI dependency:** SessionForge requires Claude CLI to be installed and authenticated. Offline execution or CI/CD pipelines cannot use AI features without a valid Claude login
- **Nested session rejection:** Requires `ensureCliAuth()` in all SDK call paths. Forgot the call = 500 error

### Neutral
- **Subprocess overhead:** Spawning the CLI adds ~100–200ms latency per query. Acceptable for content generation (10–60s duration), but not for real-time features
- **Locked to Claude ecosystem:** Cannot easily swap AI providers without refactoring all agentic loops

---

## Alternatives Considered

1. **Direct Anthropic API + environment variable keys**
   - Rationale: Standard practice for API integrations
   - Trade-off: Requires key rotation, secret management, CI/CD integration; exposes keys to environment
   - Rejected: Contradicts the "self-hosted, minimal config" philosophy

2. **Anthropic Managed Agents (batch API)**
   - Rationale: Isolate AI workloads in managed infra
   - Trade-off: Only supports batch workflows, not real-time SSE streaming; higher latency (minutes)
   - Rejected: Streaming is required for the editor-chat and content-generation UX

3. **Vercel AI SDK with custom model provider**
   - Rationale: Lighter abstraction for streaming
   - Trade-off: Still needs API keys; adds a dependency layer
   - Rejected: The SDK's patterns assume single-shot completions, not multi-turn agentic loops with custom tool dispatch

---

## References

- `apps/dashboard/src/lib/ai/ensure-cli-auth.ts` — centralized CLAUDECODE deletion
- `apps/dashboard/src/lib/ai/agent-runner.ts:1–26` — integration point for all agent runs
- `~/.claude/rules/project.md` — project-level CLAUDECODE rule documentation
- `docs/ARCHITECTURE.md` → Key Design Decisions → CLI-Inherited AI Auth

---
