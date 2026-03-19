# SessionForge Full Functional Audit — Interaction Inventory

**Date:** 2026-03-18 | **Branch:** main | **Version:** v0.1.0-alpha

## Summary

| Category | Count |
|----------|-------|
| User-facing pages | 23 |
| API routes | 161 |
| Interactive components | 33+ |
| Middleware redirects | 11 |

## Screen Inventory (Priority-Ordered)

### P0 — Core Flows (Must Validate)

| ID | Screen | Route | Key Interactions | Backend Deps |
|----|--------|-------|------------------|-------------|
| S01 | Login | `/login` | Email/password form, submit, OAuth buttons | `/api/auth/[...all]` |
| S02 | Signup | `/signup` | Registration form, submit | `/api/auth/[...all]` |
| S03 | Dashboard Home | `/:ws` | Activity feed, quick actions, stats cards | `/api/workspace/:slug/activity` |
| S04 | Sessions List | `/:ws/sessions` | Upload zone, batch ops, filter, scan button | `/api/sessions`, `/api/sessions/scan` |
| S05 | Session Detail | `/:ws/sessions/:id` | Message viewer, bookmarks, back nav | `/api/sessions/:id`, `/api/sessions/:id/messages` |
| S06 | Content List | `/:ws/content` | View tabs (calendar/pipeline/list), status filter, export, manage series/collections | `/api/content`, `/api/series`, `/api/collections` |
| S07 | Content Editor | `/:ws/content/:id` | Lexical editor, AI chat, SEO panel, save, publish modals, export dropdown, repurpose, tabs (SEO/Evidence/Supplementary/Media/Repo) | 15+ endpoints |
| S08 | Settings | `/:ws/settings` | 6 tabs (General/Style/API Keys/Integrations/Webhooks/Sources), save forms | `/api/workspace/:slug/*` |
| S09 | Navigation | Sidebar + Mobile | 8 sidebar links, mobile bottom nav (5 tabs + More sheet), logout | N/A |

### P1 — Secondary Features

| ID | Screen | Route | Key Interactions | Backend Deps |
|----|--------|-------|------------------|-------------|
| S10 | Content New | `/:ws/content/new` | Topic/Perspective/URLs/Repos fields, create button | `/api/content` POST |
| S11 | Insights List | `/:ws/insights` | Category filter, batch generate, insight cards | `/api/insights` |
| S12 | Insight Detail | `/:ws/insights/:id` | Insight content, generate content button | `/api/insights/:id` |
| S13 | Automation | `/:ws/automation` | Trigger list, create trigger, run history | `/api/automation/*` |
| S14 | Observability | `/:ws/observability` | Pipeline flow diagram, event stream | `/api/observability/*` |
| S15 | Analytics | `/:ws/analytics` | Charts, metrics, date filters | `/api/analytics/*` |
| S16 | Writing Coach | `/:ws/writing-coach` | Analysis results, digest, feedback | `/api/writing-coach/*` |

### P2 — Edge Cases & Public Pages

| ID | Screen | Route | Key Interactions | Backend Deps |
|----|--------|-------|------------------|-------------|
| S17 | Onboarding | `/onboarding` | Setup wizard, workspace creation | `/api/onboarding` |
| S18 | Public Portfolio | `/p/:ws` | Public profile, published posts list | `/api/public/portfolio/:ws` |
| S19 | Portfolio Settings | `/:ws/settings/portfolio` | Visibility toggle, bio, pinned posts | `/api/portfolio/*` |
| S20 | Skills Settings | `/:ws/settings/skills` | Skill list, import, CRUD | `/api/skills` |

## Modal/Dialog Inventory

| ID | Component | Trigger | Screen | Priority |
|----|-----------|---------|--------|----------|
| M01 | Batch Repurpose Dialog | Menu item in editor | S07 | P1 |
| M02 | Manage Group Dialog | Settings gear in content list | S06 | P1 |
| M03 | Create Template Dialog | Button in editor | S07 | P1 |
| M04 | Schedule Modal | Schedule button | S07 | P1 |
| M05 | Hashnode Publish Modal | Publish button | S07 | P1 |
| M06 | Dev.to Publish Modal | Publish button | S07 | P1 |
| M07 | Job Progress Modal | Batch operations | S06/S07 | P1 |
| M08 | Global Search Modal | Cmd+K | Any | P0 |
| M09 | Keyboard Shortcuts Modal | Cmd+/ | Any | P2 |

## Middleware Redirect Inventory

| ID | Source | Target | Status Code |
|----|--------|--------|-------------|
| R01 | `/:ws/series` | `/:ws/content?filter=series` | 308 |
| R02 | `/:ws/series/:id` | `/:ws/content?filter=series` | 308 |
| R03 | `/:ws/collections` | `/:ws/content?filter=collections` | 308 |
| R04 | `/:ws/collections/:id` | `/:ws/content?filter=collections` | 308 |
| R05 | `/:ws/recommendations` | `/:ws/insights` | 308 |
| R06 | `/:ws/calendar` | `/:ws/content?view=calendar` | 308 |
| R07 | `/:ws/settings/style` | `/:ws/settings?tab=style` | 308 |
| R08 | `/:ws/settings/api-keys` | `/:ws/settings?tab=api-keys` | 308 |
| R09 | `/:ws/settings/integrations` | `/:ws/settings?tab=integrations` | 308 |
| R10 | `/:ws/settings/webhooks` | `/:ws/settings?tab=webhooks` | 308 |
| R11 | `/:ws/settings/wordpress` | `/:ws/settings?tab=integrations` | 308 |

## API Endpoint Summary (by domain)

| Domain | Routes | Auth Type |
|--------|--------|-----------|
| Auth | 2 | None (Better Auth) |
| Content | 39 | Session |
| Sessions | 11 | Session |
| Workspace | 10 | Session |
| AI Agents | 10 | Session |
| Integrations | 29 | Session + OAuth |
| Series/Collections | 12 | Session |
| Insights/Analytics | 9 | Session |
| Recommendations | 4 | Session |
| Scheduling | 6 | Session + Cron |
| Automation | 8 | Session + Cron |
| Webhooks | 6 | Session + Signature |
| Billing | 3 | Session |
| API Keys/Skills | 6 | Session |
| Templates | 4 | Session |
| Scan Sources | 3 | Session |
| Jobs | 3 | Session |
| Public/Portfolio | 5 | None |
| Observability | 3 | Session |
| Writing Coach | 4 | Session |
| Misc (search, usage, health) | 10 | Mixed |
| **V1 Public API** | **8** | **API Key** |

## Validation Priority Matrix

| Priority | Screens | Est. Interactions | Strategy |
|----------|---------|-------------------|----------|
| P0 | S01-S09 | ~80 | Full browser validation with screenshots |
| P1 | S10-S16, M01-M07 | ~60 | Browser validation + curl for API |
| P2 | S17-S20, R01-R11, M08-M09 | ~30 | Curl + targeted browser checks |
| API | 161 routes | ~161 | Healthcheck + auth verification + key endpoint curl |
