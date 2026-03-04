# E2E Validation Analysis

## Platform: Web (Next.js 15 Fullstack)
## Startup: `bunx --bun next dev -p 3000` (from apps/dashboard/)
## URL/Port: http://localhost:3000

## User Journeys Identified

1. **Auth: Login** — Visit /login, fill email/password, submit, redirect to workspace
2. **Dashboard Home** — View stats cards, agent pipeline, content velocity chart
3. **Sessions List** — View sessions, filter by project, trigger scan
4. **Insights List** — View scored insights with /75 composite and /10 dimension bars
5. **Insight Detail** — 7-dimension breakdown, code snippets, generate actions
6. **Content List** — View posts with status badges, word counts
7. **Settings: General** — Edit name/slug/scan paths, save
8. **Settings: Scan Config** — Lookback window, project filter
9. **Settings: RSS Feeds** — View/copy RSS and Atom URLs
10. **Settings: Danger Zone** — Delete workspace with confirmation
11. **Responsive Layout** — Sidebar collapses to bottom bar on mobile

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/healthcheck | Health status (db, redis) |
| GET | /api/workspace/[slug] | Get workspace details |
| PUT | /api/workspace/[slug] | Update workspace settings |
| DELETE | /api/workspace/[slug] | Delete workspace |
| GET | /api/sessions/projects | Discover projects |
| POST | /api/insights/extract | Extract insights (SSE) |
| POST | /api/agents/blog | Generate blog post (SSE) |
| GET | /api/feed/[slug].xml | RSS 2.0 feed |
| GET | /api/feed/[slug].atom | Atom feed |

## Database: Neon PostgreSQL
Key tables: users, workspaces, insights, posts, claude_sessions
Workspace columns: default_lookback_days, scan_project_filter, last_scan_at
Insight scores: 7 dimensions (/10 each), composite_score (max 75)

## Risk Areas
- SSE agents require ANTHROPIC_API_KEY
- Redis returns false (graceful degradation)
- Scanner reads filesystem paths

## Validation Order
1. Healthcheck API
2. Auth login flow
3. Dashboard home
4. Sessions page
5. Insights page
6. Content page
7. Settings (all sections)
8. Responsive testing (375px, 768px, 1440px)
