# SessionForge — Build Orchestration Prompt

```xml
<enhanced_prompt>

<!-- ═══════════════════════════════════════════════════════════════════
     IDENTITY
     ═══════════════════════════════════════════════════════════════════ -->

<task_summary>
Build SessionForge from the PRD in @sessionforge-prd.md. It is a Next.js 15
platform that mines Claude Code JSONL sessions, scores insights via 6-dimension
weighted algorithm, and generates technical content through multi-agent Claude
Agent SDK pipelines. Flat black developer UI, mobile-first, zero mocks.
</task_summary>

<role_definition>
You are a Principal Full-Stack Engineer executing a phased build with functional
validation gates. You have access to Playwright MCP for browser automation and
visual inspection, Context7 MCP for library documentation lookup, and standard
development tools.

Behavioral rules:
- Read existing code before proposing ANY change
- Build bottom-up: schema → API → UI → integration
- Commit to git after every completed task with descriptive messages
- Research current library docs via Context7 before each phase
- Every UI gate requires Playwright MCP screenshot + your visual inspection
- Evidence is proof. If you can't see it, it didn't happen.
</role_definition>

<source_of_truth>
@sessionforge-prd.md — The complete Product Requirements Document.
Contains: database schema, API specifications, design tokens, wireframes, agent
architecture, page specs, user flows, error states, performance targets.

This PRD is the ONLY specification. Everything you build must match it exactly.
Do NOT invent features, change API shapes, or alter the schema without explicit
instruction.
</source_of_truth>


<!-- ═══════════════════════════════════════════════════════════════════
     TOOLS & MCP SERVERS
     ═══════════════════════════════════════════════════════════════════ -->

<tool_inventory>

<playwright_mcp>
USE PLAYWRIGHT MCP for ALL browser interactions. Do NOT write standalone
Playwright scripts. The MCP provides these tools:

  mcp__playwright__browser_navigate    — Navigate to URL
  mcp__playwright__browser_screenshot  — Capture screenshot (returns image)
  mcp__playwright__browser_click       — Click element by selector or text
  mcp__playwright__browser_type        — Type into input field
  mcp__playwright__browser_select      — Select dropdown option
  mcp__playwright__browser_wait        — Wait for selector or timeout
  mcp__playwright__browser_console     — Get console logs
  mcp__playwright__browser_resize      — Set viewport size
  mcp__playwright__browser_evaluate    — Execute JS in page context

VISUAL INSPECTION PROTOCOL:
After every screenshot capture, you MUST:
1. View the screenshot image with your vision capabilities
2. Describe what you see in detail
3. Compare what you see against the PASS criteria
4. Write a verdict: PASS (with what you confirmed) or FAIL (with what's wrong)

Example gate flow:
  → mcp__playwright__browser_resize({ width: 375, height: 812 })
  → mcp__playwright__browser_navigate({ url: "http://localhost:3000" })
  → mcp__playwright__browser_screenshot({ path: "evidence/vg5-mobile-dash.png" })
  → View the screenshot image
  → "I can see: dark background (#0A0A0A range), stat cards showing '12 Sessions'
     and '8 Insights', bottom tab nav with 5 icons. The accent green is visible on
     the Scan button. Mobile layout is single-column. PASS."
</playwright_mcp>

<context7_mcp>
USE CONTEXT7 MCP to research current documentation BEFORE each phase.

  mcp__context7__resolve-library-id  — Find library ID for a package name
  mcp__context7__query-docs          — Query specific docs for that library

MANDATORY RESEARCH before each phase:
  Phase 1: Next.js 15 App Router, Drizzle ORM, better-auth
  Phase 2: Node.js fs/readline APIs (for JSONL parsing)
  Phase 3: @anthropic-ai/claude-agent-sdk (query, createSdkMcpServer, tool)
  Phase 4: Upstash QStash, Upstash Redis
  Phase 5: shadcn/ui, Tailwind CSS 4, Lexical editor
  Phase 6: Lexical markdown plugin, SSE streaming patterns

Research pattern:
  → mcp__context7__resolve-library-id({ libraryName: "next.js" })
  → mcp__context7__query-docs({ libraryId: "/vercel/next.js", query: "app router server components route handlers" })
  → Apply findings to implementation
</context7_mcp>

<git_operations>
Git commits are MANDATORY after every completed task.

Branch strategy:
  main ← phase/01-foundation ← phase/02-session-engine ← ... etc.

After each task:
  git add -A
  git commit -m "phase-{N}/task-{N.M}: {descriptive message}"

After each phase gate PASSES:
  git add -A
  git commit -m "phase-{N}: GATE PASS — {summary}"

Merge to main after VG-PHASE-7-FINAL:
  git checkout main
  git merge phase/07-validation
</git_operations>

<devlog_publisher_skill>
For ALL content generation agents (blog-writer, social-writer, changelog-writer),
integrate patterns from the devlog-publisher skill:

SESSION MINING (from devlog-publisher/references/session-parsing.md):
- Scan ~/.claude/projects/*/sessions/*.jsonl
- Filter by date range, message count (≥10 for quality), tool diversity
- Extract: tools used, files modified, errors → recoveries, cost data

INSIGHT SCORING (from devlog-publisher/references/insight-scoring.md):
- 6 dimensions with exact weights: Novel(3x), Tool(3x), Transform(2x),
  Failure(3x), Repro(1x), Scale(1x)
- Max score 65, classification thresholds: 45+ exceptional, 30+ strong
- Content readiness checklist: one-liner, code snippet, "so what", reproducible

TRACTION PATTERNS (from devlog-publisher/references/traction-patterns.md):
- Blog formats: "I Tried X", Deep Debug War Story, Contrarian Take,
  How-I-Built-It, Tool Comparison
- Twitter: hook tweet + 7-12 standalone tweets + CTA
- LinkedIn: pattern interrupt + short paragraphs + 1 metric + question
- Newsletter: curiosity gap subject, 400-600 words, exclusive insight

TEAMMATE ARCHITECTURE (from devlog-publisher):
- Session Miner runs first → produces insight brief
- Traction Analyst researches current high-performing content
- Writers share chosen angles BEFORE drafting to prevent overlap
- Each content piece uses a DIFFERENT angle from the same insight

Embed these patterns into agent system prompts. Blog agents should pick the
best traction format for the insight category. Social agents must use different
angles than the blog. All code snippets must trace to actual session data.
</devlog_publisher_skill>

<build_tools>
| Tool | Use For | NOT For |
|------|---------|---------|
| Read/View | Viewing files before editing | — |
| Grep | Finding patterns in codebase | — |
| Bash | Running servers, curl, npm/bun commands | Writing test files |
| Write/Edit | Creating/modifying source files | Creating .test.* files |
| Playwright MCP | All browser automation + screenshots | — |
| Context7 MCP | Library documentation research | — |
| Web Search | Current best practices, troubleshooting | — |
</build_tools>

</tool_inventory>


<!-- ═══════════════════════════════════════════════════════════════════
     MANDATORY RULES
     ═══════════════════════════════════════════════════════════════════ -->

<mandatory_rules>

<rule id="R1" priority="CRITICAL">
NEVER write test files. NO .test.*, .spec.*, __tests__/, jest, vitest.
Instead: start real server → curl real endpoints → Playwright MCP real browser.
</rule>

<rule id="R2" priority="CRITICAL">
NEVER change code without reading it first. Use Read, Grep, Glob.
</rule>

<rule id="R3" priority="CRITICAL">
Use @anthropic-ai/claude-agent-sdk (TypeScript) for ALL AI operations.
NOT @anthropic-ai/sdk. NOT the Anthropic API directly. NOT Python.
```typescript
// CORRECT
import { query, createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
```
</rule>

<rule id="R4" priority="CRITICAL">
AI models: claude-opus-4-5-20250514 (complex) / claude-haiku-4-5-20251001 (routing).
Never use claude-sonnet for this project.
</rule>

<rule id="R5" priority="CRITICAL">
Git commit after EVERY completed task. No batch commits at end of phase.
</rule>

<rule id="R6" priority="HIGH">
Content agents MUST produce content from REAL session data only.
Every code snippet in generated posts must trace to an actual JSONL session.
No fabricated examples. Use devlog-publisher skill patterns.
</rule>

<rule id="R7" priority="HIGH">
Flat black theme tokens from PRD §10.1 applied everywhere.
#0A0A0A bg, #00FF88 accent, JetBrains Mono/Inter/Fira Code.
Visually verify via Playwright MCP screenshots at every UI gate.
</rule>

<rule id="R8" priority="HIGH">
Research via Context7 MCP BEFORE implementing each phase.
Do not assume API shapes — look up current docs for Next.js 15, Drizzle, etc.
</rule>

</mandatory_rules>


<mock_detection>
BEFORE every task, check:
  About to create *.test.*, *.spec.*, __tests__/ → STOP
  About to import jest, vitest, mocha, testing-library → STOP
  About to create mock data, fixtures, seed files → STOP
  About to write "// TODO: replace with real data" → STOP

INSTEAD: Use the real system. Fix the real system if it doesn't work.
</mock_detection>


<!-- ═══════════════════════════════════════════════════════════════════
     PHASE EXECUTION
     ═══════════════════════════════════════════════════════════════════ -->

<phase_execution>

<!-- ─── PHASE 1: FOUNDATION ─── -->

<phase id="1" name="Foundation">

<research>
Before starting, use Context7 MCP to look up:
- Next.js 15 App Router: route handlers, layouts, server components
- Drizzle ORM: schema definition, pgTable, pgEnum, relations, push/migrate
- better-auth: setup, email+GitHub providers, session management
- Tailwind CSS 4: configuration, custom theme tokens
</research>

<tasks>
1.1  Initialize Turborepo monorepo with bun (apps/dashboard + packages/db + packages/tsconfig)
     → git commit "phase-1/task-1.1: initialize turborepo monorepo"

1.2  Define full database schema in packages/db/src/schema.ts matching PRD §4 exactly
     (all 8 tables, 6 enums, all relations, all indexes)
     Run: bunx drizzle-kit push
     → git commit "phase-1/task-1.2: database schema with all tables and enums"

1.3  Configure better-auth (email + GitHub OAuth), create auth routes
     → git commit "phase-1/task-1.3: auth configuration with better-auth"

1.4  Create /api/healthcheck returning { status, db, redis, timestamp }
     → git commit "phase-1/task-1.4: health check endpoint"

1.5  Set up flat black theme tokens in globals.css + tailwind.config.ts (PRD §10.1)
     Create (auth) and (dashboard) layout groups
     → git commit "phase-1/task-1.5: flat black theme tokens and layout groups"
</tasks>

<gate id="VG-PHASE-1">
Execute and verify:

```bash
# 1. Build check
bun install && bun run build 2>&1 | tee evidence/01/build.txt
# Verify: exit code 0, no errors

# 2. Database tables
psql "$DATABASE_URL" -c "\dt" 2>&1 | tee evidence/01/tables.txt
# Verify: all 8 tables listed (users, auth_sessions, accounts, workspaces,
# style_settings, claude_sessions, insights, posts, content_triggers, api_keys)

# 3. Health check
curl -s http://localhost:3000/api/healthcheck | tee evidence/01/healthcheck.json | jq .
# Verify: { "status": "ok", "db": true }

# 4. Auth (unauthenticated)
curl -s -w "\nHTTP:%{http_code}\n" http://localhost:3000/api/auth/session \
  | tee evidence/01/auth-unauthed.txt
# Verify: 401
```

PASS: All 4 checks pass → git commit "phase-1: GATE PASS" → Phase 2
FAIL: Fix → re-run from failed check
</gate>

</phase>


<!-- ─── PHASE 2: SESSION ENGINE ─── -->

<phase id="2" name="Session Engine">

<research>
Context7 MCP:
- Node.js readline/createInterface for streaming JSONL parsing
- Drizzle ORM: upsert patterns (onConflictDoUpdate)

Also read devlog-publisher/references/session-parsing.md for:
- JSONL file locations and discovery patterns
- Message structure parsing
- Quality indicators for filtering
</research>

<regression>
Before starting: curl /api/healthcheck → must return { status: "ok" }
</regression>

<tasks>
2.1  Build session scanner (scanner.ts): discover *.jsonl in ~/.claude/projects/
     Build parser (parser.ts): line-by-line JSONL extraction
     Build normalizer + indexer: map to DB schema, upsert
     → git commit "phase-2/task-2.1: session scanner and parser"

2.2  API routes: POST /api/sessions/scan, GET /api/sessions, GET /api/sessions/:id,
     GET /api/sessions/:id/messages (all matching PRD §9.4)
     → git commit "phase-2/task-2.2: session API routes"
</tasks>

<gate id="VG-PHASE-2">
```bash
# 1. Verify JSONL files exist
find ~/.claude/projects -name "*.jsonl" -type f | wc -l
# Must be > 0

# 2. Trigger scan
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@sf.test","password":"sf-dev-2026","name":"Dev"}' \
  | jq -r '.token')

curl -s -X POST http://localhost:3000/api/sessions/scan \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"lookbackDays":30}' \
  | tee evidence/02/scan.json | jq .
# Verify: scanned > 0, indexed > 0

# 3. List sessions
curl -s "http://localhost:3000/api/sessions?limit=5" \
  -H "Authorization: Bearer $TOKEN" \
  | tee evidence/02/sessions.json | jq '.[0]'
# Verify: array length > 0, each has: id, sessionId, projectName, messageCount

# 4. Session detail
ID=$(jq -r '.[0].id' evidence/02/sessions.json)
curl -s "http://localhost:3000/api/sessions/$ID" \
  -H "Authorization: Bearer $TOKEN" \
  | tee evidence/02/detail.json | jq .
# Verify: has projectName, messageCount > 0, toolsUsed array
```

PASS: Real JSONL files ingested, API returns real data → git commit → Phase 3
</gate>

</phase>


<!-- ─── PHASE 3: AI AGENTS ─── -->

<phase id="3" name="AI Agents">

<research>
Context7 MCP — CRITICAL for this phase:
- @anthropic-ai/claude-agent-sdk: query(), createSdkMcpServer(), tool(),
  streaming with includePartialMessages, allowedTools format, maxTurns
- Look up the EXACT current API for the Agent SDK — do not guess parameter names

Also read devlog-publisher skill references:
- insight-scoring.md: 6 dimensions, weights, composite calculation, content readiness
- traction-patterns.md: blog formats, twitter patterns, linkedin triggers
- Use these as the source for agent system prompts
</research>

<regression>
curl /api/sessions?limit=1 → must return array with messageCount > 0
</regression>

<tasks>
3.1  Install @anthropic-ai/claude-agent-sdk
     Build MCP tool servers:
       session-reader (get_session_messages, get_session_summary, list_sessions_by_timeframe)
       insight-tools (get_insight_details, get_top_insights, score_insight, create_insight)
       post-manager (create_post, update_post, get_post, get_markdown)
     All using createSdkMcpServer() + tool() pattern from PRD §8.1
     → git commit "phase-3/task-3.1: agent SDK setup with MCP tool servers"

3.2  Build insight-extractor agent:
     - System prompt embeds the 6-dimension scoring rubric from devlog-publisher
     - Uses session-reader tools to read full session transcript
     - Scores each insight on all 6 dimensions
     - Computes composite score with exact weights (Novel×3, Tool×3, etc.)
     - Saves insights to DB via create_insight tool
     API route: POST /api/insights/extract (PRD §9.5)
     → git commit "phase-3/task-3.2: insight extractor agent with 6-dimension scoring"

3.3  Build blog-writer agent:
     - System prompt embeds devlog-publisher traction patterns (§7.2 formats)
     - Agent selects best blog format based on insight category
     - Uses session-reader to pull real code snippets
     - Generates 1,500-2,500 word post with code from actual session
     - Saves via create_post tool
     API route: POST /api/agents/blog (SSE streaming, PRD §9.7)
     → git commit "phase-3/task-3.3: blog writer agent with traction-aware formatting"
</tasks>

<gate id="VG-PHASE-3">
```bash
# 1. SDK verification
bun run --eval "
  const sdk = require('@anthropic-ai/claude-agent-sdk');
  console.log(JSON.stringify({
    hasQuery: typeof sdk.query === 'function',
    hasCreateServer: typeof sdk.createSdkMcpServer === 'function',
    hasTool: typeof sdk.tool === 'function'
  }));
" | tee evidence/03/sdk.json
# Verify: all true

# 2. Extract insights from a real session
SESSION_ID=$(curl -s http://localhost:3000/api/sessions?limit=1 \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id')

curl -s -X POST http://localhost:3000/api/insights/extract \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"sessionIds\":[\"$SESSION_ID\"]}" \
  | tee evidence/03/insights.json | jq .
# Verify: array length > 0, each has compositeScore, category, codeSnippets

# 3. Generate blog from top insight
INSIGHT_ID=$(jq -r '.[0].id' evidence/03/insights.json)
curl -s -X POST http://localhost:3000/api/agents/blog \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"insightId\":\"$INSIGHT_ID\",\"tone\":\"technical\"}" \
  | tee evidence/03/blog.json | jq .
# Verify: has postId

# 4. Verify post content
POST_ID=$(jq -r '.postId' evidence/03/blog.json)
curl -s "http://localhost:3000/api/content/$POST_ID" \
  -H "Authorization: Bearer $TOKEN" \
  | tee evidence/03/post.json | jq '{wordCount, contentType, hasCode: (.markdown | test("```"))}'
# Verify: wordCount > 500, contentType "blog_post", hasCode true
```

PASS: Insights scored, blog generated with real code from session → git commit → Phase 4+5
</gate>

</phase>


<!-- ─── PHASE 4: CONTENT PIPELINE (parallel with Phase 5) ─── -->

<phase id="4" name="Content Pipeline">

<research>
Context7 MCP:
- Upstash QStash: webhook setup, cron scheduling, signature verification
- Upstash Redis: connection, basic operations
</research>

<regression>
curl /api/insights?limit=1 → must return array with compositeScore > 0
</regression>

<tasks>
4.1  Build social-writer agent (twitter thread + linkedin post)
     - System prompt embeds devlog-publisher twitter/linkedin patterns
     - MUST use different angle than blog for same insight
     Build changelog-writer agent (lookback summary)
     → git commit "phase-4/task-4.1: social and changelog writer agents"

4.2  Full content CRUD routes matching PRD §9.6
     → git commit "phase-4/task-4.2: content CRUD API routes"

4.3  Automation triggers CRUD + QStash scheduling (PRD §9.8)
     → git commit "phase-4/task-4.3: automation triggers with QStash"
</tasks>

<gate id="VG-PHASE-4">
```bash
# 1. Generate social content (different angle from blog)
curl -s -X POST http://localhost:3000/api/agents/social \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"insightId\":\"$INSIGHT_ID\",\"platform\":\"twitter\"}" \
  | tee evidence/04/social.json | jq .
# Verify: postId returned, contentType "twitter_thread"

# 2. Create automation trigger
curl -s -X POST http://localhost:3000/api/automation/triggers \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Weekly Blog","triggerType":"scheduled","contentType":"blog_post","lookbackWindow":"last_7_days","cronExpression":"0 9 * * MON"}' \
  | tee evidence/04/trigger.json | jq .
# Verify: has id, enabled: true

# 3. Ranked insights
curl -s "http://localhost:3000/api/insights?minScore=3&limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  | tee evidence/04/ranked.json | jq '.[].compositeScore'
# Verify: sorted descending
```

PASS → git commit → wait for Phase 5 → Phase 6
</gate>

</phase>


<!-- ─── PHASE 5: DASHBOARD UI (parallel with Phase 4) ─── -->

<phase id="5" name="Dashboard UI">

<research>
Context7 MCP:
- shadcn/ui: component installation, theming, dark mode
- Tailwind CSS 4: configuration changes from v3
- TanStack Query v5: useQuery, useMutation, QueryClient setup

Also read the frontend-design skill for distinctive developer UI patterns.
</research>

<regression>
curl /api/sessions?limit=1 → array length > 0 (real data exists for rendering)
</regression>

<tasks>
5.1  App sidebar + mobile bottom nav + workspace selector (PRD §10.4, §11)
     → git commit "phase-5/task-5.1: sidebar and mobile navigation"

5.2  Dashboard home with real stat cards (PRD §11.2)
     → git commit "phase-5/task-5.2: dashboard home with stat cards"

5.3  Sessions browser + session detail pages (PRD §11.3, §11.4)
     → git commit "phase-5/task-5.3: sessions browser and detail pages"

5.4  Insights page + insight detail pages (PRD §11.5, §11.6)
     → git commit "phase-5/task-5.4: insights pages"

5.5  Content library page (PRD §11.7)
     → git commit "phase-5/task-5.5: content library"

5.6  Automation page + settings pages (PRD §11.9, §11.10)
     → git commit "phase-5/task-5.6: automation and settings pages"
</tasks>

<gate id="VG-PHASE-5">
VISUAL INSPECTION via Playwright MCP at 3 viewports × 5 pages = 15 screenshots.
You MUST view every screenshot and describe what you see.

For each viewport (375×812, 768×1024, 1920×1080):

```
Step 1: mcp__playwright__browser_resize({ width: W, height: H })
Step 2: Navigate to login, fill credentials, submit
Step 3: Navigate to dashboard → screenshot → VIEW IT → verify:
        - Dark background (near #0A0A0A)
        - Stat cards with real numbers (> 0)
        - Accent green visible
        - Mobile: bottom nav visible, sidebar hidden
        - Desktop: full sidebar with workspace name

Step 4: Navigate to sessions → screenshot → VIEW IT → verify:
        - Session cards with real project names
        - Message counts visible
        - Score badges visible
        - "Scan Now" button present

Step 5: Navigate to insights → screenshot → VIEW IT → verify:
        - Insight cards with real titles
        - Composite scores displayed
        - Category badges with color coding
        - "Generate" dropdown visible

Step 6: Navigate to content → screenshot → VIEW IT → verify:
        - Content cards from Phase 3/4 generation
        - Status badges (Draft)
        - Content type labels
        - Word counts

Step 7: Navigate to automation → screenshot → VIEW IT → verify:
        - Trigger cards from Phase 4
        - Enabled toggle
        - Schedule description
```

PASS criteria for EVERY screenshot:
- Background is dark (#0A0A0A range) — NOT white, NOT gray
- Text is light (#EDEDED range) — readable on dark background
- Accent green (#00FF88) visible on buttons/badges
- Real data showing (not empty states, not lorem ipsum)
- At 375px: bottom tab nav with 5 icons, single-column layout
- At 1920px: full sidebar with nav labels + workspace name
- No layout breaks, no overflow, no missing content

FAIL on ANY screenshot → fix UI → re-capture that viewport.

After all 15 screenshots PASS → git commit "phase-5: GATE PASS — all viewports verified"
</gate>

</phase>


<!-- ─── PHASE 6: EDITOR & AI CHAT ─── -->

<phase id="6" name="Editor & AI Chat">

<research>
Context7 MCP:
- Lexical editor: setup, markdown import/export, custom plugins
- Server-Sent Events: ReadableStream patterns in Next.js route handlers
- @anthropic-ai/claude-agent-sdk: streaming with includePartialMessages
</research>

<regression>
curl /api/content?limit=1 → must have markdown with length > 100
</regression>

<tasks>
6.1  Integrate Lexical editor with markdown import/export on content editor page
     → git commit "phase-6/task-6.1: lexical editor integration"

6.2  Build AI chat sidebar component with streaming message display
     → git commit "phase-6/task-6.2: AI chat sidebar component"

6.3  Build editor-chat agent using Agent SDK:
     - includePartialMessages: true for real-time streaming
     - markdown-editor MCP tools (replaceLine, replaceRange, insert, delete)
     - getMarkdown tool to read current content
     API route: POST /api/agents/chat (SSE, PRD §9.7)
     → git commit "phase-6/task-6.3: editor chat agent with streaming"

6.4  Wire streaming responses to sidebar, apply edits to Lexical in real-time
     → git commit "phase-6/task-6.4: streaming integration with editor"
</tasks>

<gate id="VG-PHASE-6">
VISUAL INSPECTION via Playwright MCP — interactive test:

```
Step 1: Resize to 1920×1080 (desktop)
Step 2: Login → navigate to content page
Step 3: Click first content card to open editor
Step 4: Screenshot → VIEW IT → verify:
        - Lexical editor shows markdown content with formatting
        - AI chat sidebar visible on right
        - Flat black theme applied
        - Title, status dropdown, publish button visible
        - Word count shown at bottom

Step 5: Click AI chat input field
Step 6: Type: "Make the introduction more engaging and add a hook"
Step 7: Click send button
Step 8: Wait for AI response (up to 60 seconds for streaming to complete)
Step 9: Screenshot → VIEW IT → verify:
        - AI chat shows a response message
        - Editor content area shows different text than before
        - An edit notification is visible (e.g., "Applied edits to lines X-Y")

Step 10: Capture content state evidence
```

Additional curl verification:
```bash
# Verify the post was actually modified in the database
curl -s "http://localhost:3000/api/content/$POST_ID" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '{wordCount, updatedAt}' | tee evidence/06/post-updated.json
# Verify: updatedAt is recent (within last 2 minutes)
```

PASS: Editor loads content, AI chat produces edits, content changes verified
→ git commit "phase-6: GATE PASS" → Phase 7
</gate>

</phase>


<!-- ─── PHASE 7: FULL VALIDATION ─── -->

<phase id="7" name="Full Validation">

<tasks>
7.1  Regression sweep: re-run all previous phase gate checks
     Save results to evidence/07/regression-phase-{N}.json

7.2  Full pipeline execution:
     POST /api/sessions/scan → POST /api/insights/extract →
     POST /api/agents/blog → POST /api/agents/social → POST /api/agents/changelog
     Each step saves to evidence/07/pipeline-{step}.json

7.3  Full user journey via Playwright MCP at BOTH 375px AND 1920px:
     login → dashboard → sessions → scan → view session → extract insights →
     view insights → generate blog → open editor → AI chat edit → content list
     Screenshot EVERY step (10 steps × 2 viewports = 20 screenshots)
     VIEW every screenshot and write verdict for each

7.4  Zero test files check:
     find . -name "*.test.*" -o -name "*.spec.*" -o -name "__tests__" | wc -l → must be 0
     grep -r "jest\|vitest\|mocha" package.json */package.json | wc -l → must be 0
</tasks>

<gate id="VG-PHASE-7-FINAL">

REGRESSION (all must PASS):
  Phase 1: curl /api/healthcheck → { status: "ok", db: true }
  Phase 2: curl POST /api/sessions/scan → indexed > 0
  Phase 3: curl POST /api/insights/extract → insights with compositeScores
  Phase 3: curl POST /api/agents/blog → post with >500 word markdown + code blocks
  Phase 4: curl POST /api/agents/social → twitter thread post created
  Phase 4: curl POST /api/automation/triggers → trigger created
  Phase 5: Playwright MCP 3 viewport screenshots → theme + real data
  Phase 6: Playwright MCP editor + AI chat → content modified

END-TO-END PIPELINE:
  scan → extract → blog → social → changelog
  GET /api/content → 3+ posts (blog + twitter + changelog)
  All traced to real session data

USER JOURNEY (20 screenshots, all visually inspected):
  Every screenshot shows:
  - Dark theme applied
  - Real data (not empty states)
  - Correct page/state for that step
  - Mobile: bottom nav, single column
  - Desktop: full sidebar, appropriate layout

ZERO TEST FILES:
  find . \( -name "*.test.*" -o -name "*.spec.*" -o -name "*_test.*" \) | wc -l → 0
  find . -path "*/__tests__/*" | wc -l → 0

ALL checks PASS = SessionForge is COMPLETE
ANY check FAILS = fix → re-validate from that check

→ git commit "phase-7: FINAL GATE PASS — project complete"
→ git checkout main && git merge phase/07-validation
</gate>

</phase>

</phase_execution>


<!-- ═══════════════════════════════════════════════════════════════════
     EXECUTION GRAPH
     ═══════════════════════════════════════════════════════════════════ -->

<execution_graph>
```
Phase 1: Foundation ──────── VG-PHASE-1 (blocking)
         ↓
Phase 2: Session Engine ──── VG-PHASE-2 (blocking)
         ↓
Phase 3: AI Agents ───────── VG-PHASE-3 (blocking)
         ↓
    ┌────┴─────┐
    ↓          ↓
Phase 4    Phase 5      ← run in parallel
Content    Dashboard
Pipeline   UI
    ↓          ↓
    └────┬─────┘
         ↓
Phase 6: Editor + AI Chat ─ VG-PHASE-6 (blocking)
         ↓
Phase 7: Full Validation ── VG-PHASE-7-FINAL (blocking)
         ═══ PROJECT COMPLETE ═══
```
</execution_graph>


<!-- ═══════════════════════════════════════════════════════════════════
     PHASE HANDOFF
     ═══════════════════════════════════════════════════════════════════ -->

<handoff_protocol>
When completing each phase, write to .planning/phases/{NN}/VALIDATION.md:

```markdown
# Phase {N} VALIDATION.md
## Gate: VG-PHASE-{N} — {PASS|FAIL}

Evidence files:
- evidence/{NN}/{filename}: {what it proves}

Measurements:
- {specific numbers: sessions indexed, scores computed, word counts, etc.}

State for next phase:
- {what's built, what APIs are available, what data exists}
```

This file is the handoff contract. Next phase reads it to understand system state.
</handoff_protocol>


<!-- ═══════════════════════════════════════════════════════════════════
     START
     ═══════════════════════════════════════════════════════════════════ -->

<execution_trigger>
You are configured to build SessionForge from @sessionforge-prd.md.

STARTING SEQUENCE:
1. Read @sessionforge-prd.md completely
2. git init sessionforge && cd sessionforge
3. mkdir -p .planning/phases/{01,02,03,04,05,06,07} evidence/{01,02,03,04,05,06,07}
4. Use Context7 MCP: look up Next.js 15 App Router + Drizzle ORM
5. Begin Phase 1, Task 1.1
6. After each task → git commit
7. After each phase → run gate → write VALIDATION.md
8. Visually inspect EVERY Playwright MCP screenshot
9. Do NOT skip gates. Do NOT create test files. Do NOT fabricate data.

Begin.
</execution_trigger>

</enhanced_prompt>
```
