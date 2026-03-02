# Findings & Decisions

## Requirements (from PRD)

### Tech Stack
- Frontend: Next.js 15 (App Router) + React 19 + Tailwind CSS 4
- UI: shadcn/ui + flat-black design tokens
- Editor: Lexical (rich text with markdown import/export)
- State: TanStack Query v5 (server) + Zustand (client)
- Auth: better-auth (email + GitHub OAuth)
- DB: PostgreSQL via Drizzle ORM (Neon serverless)
- Queue: Upstash QStash
- Cache: Upstash Redis
- AI: @anthropic-ai/claude-agent-sdk (TypeScript)
- Models: claude-opus-4-5-20250514 (complex), claude-haiku-4-5-20251001 (routing)
- Deploy: Vercel
- Monorepo: Turborepo with bun

### Database (PRD §4)
- 8 tables: users, auth_sessions, accounts, workspaces, style_settings, claude_sessions, insights, posts, content_triggers, api_keys
- 6 enums: lookbackWindow, postStatus, contentType, insightCategory, toneProfile, triggerType
- Key relations: workspace 1:many sessions/insights/posts/triggers/apikeys, workspace 1:1 style_settings

### Design System (PRD §10)
- BG: #0A0A0A primary, #111111 secondary, #1A1A1A tertiary
- Accent: #00FF88 electric green
- Fonts: JetBrains Mono (headings/nav), Inter (body), Fira Code (code)
- Radius: 6px default, 10px cards, 9999px pills
- Mobile breakpoint: 768px (bottom tab nav), Desktop: 1280px+ (full sidebar 260px)

### Insight Scoring (PRD §6)
- 6 dimensions: Novel(3x), Tool Discovery(3x), Before/After(2x), Failure Recovery(3x), Reproducibility(1x), Scale(1x)
- Max composite: 65
- Thresholds: 45+ exceptional, 30+ strong, 20+ moderate, <20 low

### Content Types (PRD §7)
- blog_post: 1,500-2,500 words
- twitter_thread: 7-12 tweets
- linkedin_post: 200-350 words
- changelog: 500-1,000 words
- newsletter: 400-600 words

## Research Findings

### Phase 1 Research
- (pending) Next.js 15 App Router patterns
- (pending) Drizzle ORM schema/push
- (pending) better-auth setup
- (pending) Tailwind CSS 4 config

## Technical Decisions
| Decision | Rationale |
|----------|-----------|

## Issues Encountered
| Issue | Resolution |
|-------|------------|

## Resources
- PRD: /Users/nick/Desktop/sessionforge/sessionforge-prd.md
- JSONL sessions: ~/.claude/projects/*/sessions/*.jsonl
- Session format: human/assistant messages with tool_use blocks, cost entries, error entries

## Visual/Browser Findings
- (none yet — will capture during Phase 5+ Playwright gates)

---
*Update this file after every 2 view/browser/search operations*
