# Codebase Concerns

**Analysis Date:** 2026-03-22

## Tech Debt

**Workspace Auth Split: ownerId vs. getAuthorizedWorkspace:**
- Issue: Two competing workspace authorization patterns exist. Most routes use the robust `getAuthorizedWorkspace()` from `src/lib/workspace-auth.ts` (slug lookup + member table check + permission system). However, 10 API routes bypass this entirely by fetching the workspace independently and comparing `workspace.ownerId !== session.user.id` directly — which breaks for workspace members (non-owners).
- Files:
  - `src/app/api/analytics/export/route.ts` (line 42)
  - `src/app/api/analytics/attribution/route.ts` (line 34)
  - `src/app/api/analytics/roi/route.ts` (line 57)
  - `src/app/api/content/[id]/verify/route.ts` (line 54)
  - `src/app/api/content/[id]/risk-flags/route.ts` (line 45)
  - `src/app/api/content/[id]/risk-flags/[flagId]/route.ts` (line 45)
  - `src/app/api/writing-coach/digest/route.ts` (lines 227, 305)
  - `src/app/api/onboarding/route.ts` (line 24)
  - `src/app/api/workspace/route.ts` (line 22)
- Impact: Workspace members (non-owners) are denied access to analytics export/attribution/ROI, content verification, risk flags, and writing coach digest. Authorization logic is split across two patterns making future auditing error-prone.
- Fix approach: Migrate all 10 routes to use `getAuthorizedWorkspace(session, slug, requiredPermission)` from `src/lib/workspace-auth.ts`.

**Usage Metering Stub in Batch Processor:**
- Issue: `recordBatchUsage()` in `src/lib/queue/batch-processor.ts` (lines 36-44) is a documented no-op with two `TODO` comments. Batch operations (archive, delete, publish, unpublish, insight extraction, content generation) do not count against workspace plan limits.
- Files: `src/lib/queue/batch-processor.ts`
- Impact: Users on limited plans can run unlimited batch operations, bypassing billing limits. The `recordUsage()` call for individual items is implemented but batch-level metering is not.
- Fix approach: Implement `recordBatchUsage()` to call `recordUsage()` per item, or integrate with the billing metering system before batch operations ship publicly.

**Portfolio Series Filtering Not Implemented:**
- Issue: `src/components/portfolio/post-grid.tsx` line 97 has a `TODO: Filter by series/collection when post relationships are available`. The post grid renders all posts without series/collection filtering.
- Files: `src/components/portfolio/post-grid.tsx`
- Impact: Portfolio pages do not respect series/collection filters, showing all posts regardless of filter selection.
- Fix approach: Implement post relationship queries and wire filter params to the post grid component.

**Writing Coach Digest Email Never Sent:**
- Issue: `src/app/api/writing-coach/digest/route.ts` line 334 has `// TODO: Send digest email here`. The digest is computed but never delivered to users.
- Files: `src/app/api/writing-coach/digest/route.ts`
- Impact: Writing coach digest feature is silently incomplete — no email is sent despite the API computing the digest.
- Fix approach: Integrate an email sending library (Resend, SendGrid, etc.) at that TODO callsite.

## Known Bugs

**decodeProjectPath Lossy Encoding (CRITICAL):**
- Symptoms: Project paths containing literal hyphens (`-`) cannot be reliably distinguished from path separators (`/`), because Claude encodes both as `-`. A project at `/Users/nick/my-project` encodes to `-Users-nick-my-project`, which is identical to `/Users/nick/my/project`.
- Files: `src/lib/sessions/scanner.ts` (lines 41-100)
- Trigger: Any project whose directory name contains a hyphen (e.g., `my-app`, `session-forge`). The filesystem-existence heuristic mitigates this when the project exists on disk but fails for deleted/remote/nonexistent projects.
- Workaround: The current implementation uses `fsSync.existsSync()` to probe both interpretations and prefer the one that exists. This only works when the project directory is present on the same machine.

**BETTER_AUTH_URL Missing for OAuth Callbacks:**
- Symptoms: OAuth callback URLs may be constructed using the wrong base URL in production if `BETTER_AUTH_URL` is not set. `src/lib/auth.ts` falls back to `NEXT_PUBLIC_APP_URL` with only a `console.warn`. In server-side contexts where `NEXT_PUBLIC_APP_URL` is a public-facing URL that differs from the internal server URL, OAuth redirects may fail silently.
- Files: `src/lib/auth.ts` (lines 7-21)
- Trigger: Production deployment without `BETTER_AUTH_URL` set when `NEXT_PUBLIC_APP_URL` is not reachable server-side.
- Workaround: Set `BETTER_AUTH_URL` explicitly in all production environments.

**GitHub OAuth Conditionally Registered:**
- Symptoms: GitHub OAuth is only registered as a social provider when `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` env vars are present at startup (conditional spread in `src/lib/auth.ts` lines 35-44). If the env vars are absent and a user visits the GitHub login flow, they will receive an unhelpful error rather than a clear "not configured" message.
- Files: `src/lib/auth.ts` (lines 35-44)
- Trigger: Deployment without GitHub OAuth env vars when GitHub login UI is shown to users.
- Workaround: Hide GitHub login button when env vars are absent, or add a guard endpoint.

## Security Considerations

**SSH Scan Source Passwords Stored in Plaintext in Dev:**
- Risk: `src/lib/crypto/source-credentials.ts` warns at line 16: "passwords stored in plaintext (dev only)" when `SCAN_SOURCE_ENCRYPTION_KEY` is not set, and the `encryptPassword()` function returns `plain:<password>` in that case. If a dev database is ever shared or leaked, SSH passwords are exposed.
- Files: `src/lib/crypto/source-credentials.ts`
- Current mitigation: Warning logged; dev-only documented. `SCAN_SOURCE_ENCRYPTION_KEY` enforces encryption in production if set.
- Recommendations: Enforce encryption key presence regardless of `NODE_ENV`. The plaintext fallback should be removed or gated behind an explicit `ALLOW_PLAINTEXT_PASSWORDS=true` opt-in.

**Stripe Secret Key Falls Back to Placeholder String:**
- Risk: `src/lib/stripe.ts` line 7 uses `process.env.STRIPE_SECRET_KEY ?? "placeholder-stripe-secret-key"`. If the env var is absent in production, Stripe calls will be made with a placeholder key and fail silently with potentially confusing errors rather than a startup crash.
- Files: `src/lib/stripe.ts`
- Current mitigation: None. The placeholder will cause Stripe SDK calls to fail at runtime.
- Recommendations: Throw at module load time if `STRIPE_SECRET_KEY` is absent in production: `if (!process.env.STRIPE_SECRET_KEY && process.env.NODE_ENV === 'production') throw new Error(...)`.

**QStash Signature Verification Bypassed When Placeholder Keys Present:**
- Risk: `src/lib/qstash.ts` initializes a `Receiver` with placeholder signing key strings when env vars are absent. `verifyQStashRequest()` will still be called but will fail to verify real signatures or accept requests signed with placeholders. Any caller that catches the verification error and falls through may accept unsigned webhook callbacks.
- Files: `src/lib/qstash.ts` (lines 27-40, 112-123)
- Current mitigation: `isQStashAvailable()` guards schedule creation. Verification errors are not silently swallowed in reviewed code.
- Recommendations: Short-circuit `verifyQStashRequest()` to return `false` immediately when `isPlaceholderToken` is true, rather than attempting verification with placeholder keys.

**No Rate Limiting on Most API Routes:**
- Risk: Only `src/app/api/integrations/health/check/route.ts` has per-workspace rate limiting (in-memory fallback + Redis). The 76+ other API routes have no rate limiting. AI agent routes, batch processing endpoints, and public v1 routes can be called without restriction.
- Files: `src/app/api/agents/`, `src/app/api/content/`, `src/app/api/v1/`
- Current mitigation: Anthropic API calls in batch processor are capped at 5 concurrent (semaphore in `src/lib/queue/batch-processor.ts`), but this only limits concurrency within a single job, not across users.
- Recommendations: Apply rate limiting middleware to all agent/AI routes and public v1 endpoints.

**WordPress App Passwords Encrypted with BETTER_AUTH_SECRET:**
- Risk: `src/lib/wordpress/crypto.ts` derives its AES-256-CBC encryption key from `BETTER_AUTH_SECRET`. If `BETTER_AUTH_SECRET` is rotated (e.g., after a security incident), all stored WordPress app passwords become undecryptable without a migration path.
- Files: `src/lib/wordpress/crypto.ts`
- Current mitigation: `throw new Error` at decrypt time if secret is unset.
- Recommendations: Use a dedicated `WORDPRESS_ENCRYPTION_KEY` env var separate from the auth secret to prevent key rotation from breaking stored credentials.

## Performance Bottlenecks

**decodeProjectPath Makes Synchronous Filesystem Calls:**
- Problem: `fsSync.existsSync()` and `fsSync.statSync()` are called in a loop for each `-` segment in the encoded path in `src/lib/sessions/scanner.ts`. For deeply nested paths, this performs O(n²) synchronous blocking filesystem calls during session scanning.
- Files: `src/lib/sessions/scanner.ts` (lines 60-100)
- Cause: Synchronous fs calls in hot path during session file discovery.
- Improvement path: Cache previously resolved path prefixes, or implement an async variant. For paths with known prefix matches (lines 46-52), the segment loop can terminate early.

**Batch Job Cancellation Checks Fetch Full Job Record Per Item:**
- Problem: In `src/lib/queue/batch-processor.ts`, cancellation is checked by calling `getJob(jobId)` (a database round-trip) before processing each item. For a 100-item batch with MAX_CONCURRENT_AI_CALLS=5, this adds 100 extra DB queries.
- Files: `src/lib/queue/batch-processor.ts` (lines 148-156, 210-218)
- Cause: No in-process cancellation signal (e.g., AbortController). Polling via DB is the only mechanism.
- Improvement path: Use an in-memory cancellation flag (AbortController or a shared Set of cancelled job IDs) that is set when the cancel API is called, to avoid per-item DB queries.

## Fragile Areas

**CLAUDECODE Env Deletion — Module-Level Side Effect Spread Across 14 Files:**
- Files:
  - `src/lib/ai/agent-runner.ts`
  - `src/lib/ai/mcp-server-factory.ts`
  - `src/lib/ai/agents/style-learner.ts`
  - `src/lib/seo/generator.ts`
  - `src/lib/seo/meta-generator.ts`
  - `src/lib/media/diagram-generator.ts`
  - `src/lib/ingestion/source-assembler.ts`
  - `src/lib/ingestion/text-processor.ts`
  - `src/lib/ingestion/repo-analyzer.ts`
  - `src/lib/sessions/evidence-classifier.ts`
  - `src/app/api/content/suggest-arcs/route.ts`
  - `src/app/api/content/[id]/supplementary/route.ts`
  - `src/app/api/content/[id]/supplementary/[suppId]/route.ts`
- Why fragile: `delete process.env.CLAUDECODE` is a module-level side effect required before any `@anthropic-ai/claude-agent-sdk` `query()` call. Any new file that imports the agent SDK without this line will fail silently (nested session rejection, exit code 1). There is no compile-time or lint enforcement.
- Safe modification: When adding any new file that calls `query()`, the first line of the module must be `delete process.env.CLAUDECODE`. Consider centralizing this in `agent-runner.ts` and routing all SDK calls through it.
- Test coverage: No automated test catches a missing `delete process.env.CLAUDECODE` in new files.

**Redis Client is Nullable — Callers Must Handle null:**
- Files: `src/lib/redis.ts`
- Why fragile: `getRedis()` returns `RedisClient | null`. Any caller that does not check for `null` will throw at runtime. The in-memory rate limit fallback in `src/app/api/integrations/health/check/route.ts` demonstrates the correct pattern, but other Redis consumers may not handle `null` gracefully.
- Safe modification: Always check `const redis = await getRedis(); if (!redis) { /* handle */ }` before using the client.

**`SeoScoreBadge` Component Typed as `any`:**
- Files: `src/lib/content-constants.tsx` (line 38)
- Why fragile: `function SeoScoreBadge({ post }: { post: any })` — the shared SEO score badge component accepts any shape for `post`. Refactors to the post type will not surface type errors in this component.
- Fix approach: Type the `post` parameter with the actual Drizzle inferred type from `@sessionforge/db`.

**`db-adapter.ts` Placeholder Connection String:**
- Files: `src/lib/db-adapter.ts` (line 10)
- Why fragile: Falls back to `postgresql://user:pass@localhost:5432/placeholder`. If `DATABASE_URL` is unset in any environment (including CI), the app will start without error but all DB queries will fail at runtime.
- Fix approach: Throw at module load if `DATABASE_URL` is absent in non-test environments.

## Scaling Limits

**In-Memory Rate Limiter for Integration Health Checks:**
- Current capacity: The in-memory map in `src/app/api/integrations/health/check/route.ts` (lines 18-26) resets on every cold start. In a multi-instance deployment (Vercel serverless), each instance has its own map.
- Limit: Rate limits are not shared across serverless instances. A user can bypass the per-workspace rate limit by hitting different instances.
- Scaling path: The code already checks Redis first and falls back to in-memory. Ensuring `UPSTASH_REDIS_URL` is configured is the fix.

**QStash File-Watch Schedule Fixed at 5-Minute Intervals:**
- Current capacity: `src/lib/qstash.ts` hardcodes `cron: "*/5 * * * *"` for file-watch schedules.
- Limit: On Vercel Hobby plan, minimum cron interval is daily. The 5-minute schedule requires a Pro plan and QStash.
- Scaling path: This is documented as a QStash dependency; ensure QStash is configured in production.

## Dependencies at Risk

**`@anthropic-ai/claude-agent-sdk` — Auth via CLI Session (Non-Standard):**
- Risk: The SDK authenticates by inheriting the logged-in Claude CLI user session via subprocess. This is designed for local dev/personal use. In a multi-tenant SaaS context, all AI calls run under the same CLI user's account and quota.
- Impact: Rate limits, usage billing, and quota exhaustion affect all users globally, not per-workspace.
- Migration plan: No direct migration — this is the current architecture. Monitor for Anthropic API key support being added to the SDK.

## Missing Critical Features

**Digest Email Delivery:**
- Problem: Writing coach digest is computed but the email sending step is a TODO stub.
- Blocks: Writing coach digest feature cannot deliver value to users.

**Batch Usage Metering:**
- Problem: Batch operations do not decrement plan limits.
- Blocks: Enforcing plan quotas on batch insight extraction and content generation.

## Test Coverage Gaps

**No Coverage for decodeProjectPath Edge Cases on Non-Existent Paths:**
- What's not tested: Behavior when both `/` and `-` interpretations do not exist on disk for mid-path segments (falls back to `/`). Tests in `src/lib/sessions/__tests__/scanner.test.ts` cover known prefixes but the disk-probing heuristic is only exercised indirectly.
- Files: `src/lib/sessions/__tests__/scanner.test.ts`, `src/lib/sessions/scanner.ts`
- Risk: Regressions in path resolution for deleted/remote projects go undetected.
- Priority: Medium

**No Coverage for CLAUDECODE Deletion in New SDK Files:**
- What's not tested: No automated check verifies that every file importing `@anthropic-ai/claude-agent-sdk` has `delete process.env.CLAUDECODE` before calling `query()`.
- Files: Any new file added to the codebase that uses the agent SDK.
- Risk: A developer adds a new agent/route file and forgets the deletion; AI calls fail silently in dev.
- Priority: High — consider adding a lint rule or pre-commit grep check.

**No Coverage for Workspace Member Access to ownerId-Gated Routes:**
- What's not tested: The 10 routes using `workspace.ownerId !== session.user.id` are not tested with workspace member sessions. Test files use mock sessions that match `ownerId` directly.
- Files: `src/app/api/analytics/export/route.ts`, `src/app/api/analytics/attribution/route.ts`, `src/app/api/analytics/roi/route.ts`, `src/app/api/content/[id]/verify/route.ts`, `src/app/api/content/[id]/risk-flags/route.ts`
- Risk: The member-access regression described in Tech Debt section goes undetected.
- Priority: High

---

*Concerns audit: 2026-03-22*
