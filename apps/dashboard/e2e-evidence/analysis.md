# E2E Validation Analysis

## Platform: fullstack (Next.js 15 + API Routes + Neon Postgres)
## Startup: `bun run dev` (port 3000)
## URL/Port: http://localhost:3000
## Auth: better-auth (GitHub OAuth + email/password)

## Database Schema (16 tables)
users, auth_sessions, accounts, verifications, workspaces, style_settings, claude_sessions, insights, posts, content_triggers, api_keys, workspace_members, workspace_invites, workspace_activity, devto_integrations, devto_publications

## API Endpoints (31 routes)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/healthcheck | Health check (DB + Redis) |
| GET | /api/workspace | List workspaces |
| POST | /api/workspace | Create workspace |
| GET | /api/workspace/[slug] | Get workspace by slug |
| PUT | /api/workspace/[slug]/style | Update style settings |
| GET | /api/sessions | List sessions |
| GET | /api/sessions/[id] | Get session detail |
| GET | /api/sessions/[id]/messages | Get session messages |
| POST | /api/sessions/scan | Scan for sessions |
| GET | /api/insights | List insights |
| GET | /api/insights/[id] | Get insight detail |
| POST | /api/insights/extract | Extract insights (SSE) |
| GET | /api/content | List posts |
| POST | /api/content | Create post |
| GET | /api/content/[id] | Get post |
| PUT | /api/content/[id] | Update post |
| DELETE | /api/content/[id] | Delete post |
| GET | /api/content/[id]/attribution | Get attribution |
| GET | /api/content/export | Export content |
| GET/POST | /api/api-keys | List/Create API keys |
| DELETE | /api/api-keys/[id] | Delete API key |
| GET/POST | /api/automation/triggers | List/Create triggers |
| GET/PUT/DELETE | /api/automation/triggers/[id] | CRUD trigger |
| POST | /api/automation/execute | Execute automation |
| POST | /api/automation/file-watch | File watch trigger |
| POST | /api/agents/blog | Generate blog |
| POST | /api/agents/changelog | Generate changelog |
| POST | /api/agents/chat | Chat agent |
| POST | /api/agents/newsletter | Generate newsletter |
| POST | /api/agents/social | Generate social |
| GET | /api/badge/[postId] | Badge SVG |
| GET | /api/feed/[...slug] | RSS feed |
| GET/POST/DELETE | /api/integrations/devto | Dev.to integration |
| GET/POST/PUT | /api/integrations/devto/publish | Dev.to publishing |
| ALL | /api/auth/[...all] | Better-auth handlers |

## Frontend Pages (14 routes)

| Route | Page | Key Elements |
|-------|------|--------------|
| /login | Auth login | Email/password form, GitHub OAuth |
| /signup | Auth signup | Registration form |
| /[workspace] | Dashboard | Stats badges, recent activity |
| /[workspace]/sessions | Sessions list | Session cards, scan button |
| /[workspace]/sessions/[id] | Session detail | Messages, metadata |
| /[workspace]/insights | Insights list | Score bars /10, categories |
| /[workspace]/insights/[id] | Insight detail | Dimension scores /10 |
| /[workspace]/content | Content list | Post cards, status filters |
| /[workspace]/content/[id] | Content detail | Editor, preview |
| /[workspace]/automation | Automation | Trigger list, create form |
| /[workspace]/settings | Settings | Workspace config |
| /[workspace]/settings/api-keys | API Keys | Key management |
| /[workspace]/settings/integrations | Integrations | Dev.to config |
| /[workspace]/settings/style | Style | Tone, audience settings |

## User Journeys

1. **Health Check** — GET /api/healthcheck returns {status, db, redis, timestamp}
2. **Auth Pages** — Login/signup pages render with forms
3. **Dashboard Overview** — Main page loads with workspace stats
4. **Session Management** — List/view sessions, scan for new ones
5. **Insight Extraction** — View insights, scores displayed as /10
6. **Content Pipeline** — Create/edit/delete posts, preview markdown
7. **Automation** — Configure triggers (scheduled, file-watch)
8. **Settings** — Workspace config, API keys, integrations, style
9. **Responsive Design** — All pages at mobile/tablet/desktop viewports

## Recommended Validation Order
1. Database connectivity (healthcheck)
2. API layer (key endpoints via curl)
3. Frontend pages (browser automation)
4. Integration (frontend actions → API → DB consistency)
5. Responsive testing
