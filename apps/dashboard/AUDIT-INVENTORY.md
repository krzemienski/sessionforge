# Full Functional Audit — Interaction Inventory

## Summary
- **17 screens** (+ 6 settings tabs, auth pages, onboarding)
- **~137 user-facing interactions**
- **76+ API routes** (internal) + 9 public v1 routes
- **Priority breakdown**: P0: 52 | P1: 60 | P2: 25

## Navigation Structure
- **Sidebar** (desktop): Dashboard, Sessions, Insights, Content, Pipeline, Automation, Settings
- **Mobile bottom nav**: Dashboard, Sessions, Content, Pipeline, More (→ sheet: Insights, Automation, Settings)
- **Middleware redirects** (308): /series→/content?filter=series, /collections→/content?filter=collections, /recommendations→/insights, /settings/{sub}→/settings?tab={sub}

---

## Dashboard (`/[ws]`)

| ID | Interaction | Trigger | Backend | P |
|----|-------------|---------|---------|---|
| D01 | View stat cards (sessions, insights, content, published) | Page load | GET /api/workspace/[slug]/stats | P0 |
| D02 | Scan Now button | Click | POST /api/workspace/[slug]/scan | P0 |
| D03 | Quick Actions grid navigation | Click cards | Client routing | P1 |
| D04 | Activity log display | Page load | GET /api/workspace/[slug]/activity | P1 |

## Sessions List (`/[ws]/sessions`)

| ID | Interaction | Trigger | Backend | P |
|----|-------------|---------|---------|---|
| S01 | View session list with pagination | Page load | GET /api/sessions | P0 |
| S02 | Scan button (streaming SSE) | Click | POST /api/workspace/[slug]/scan | P0 |
| S03 | File upload (drag-drop + click) | Drag/Click | POST /api/sessions/upload | P1 |
| S04 | Filter panel (project, files, cost, date) | Click filters | Client-side | P1 |
| S05 | Multi-select + Extract Insights batch | Checkbox+shift | POST /api/insights/extract | P1 |
| S06 | Pagination controls | Click | GET /api/sessions?page=N | P0 |
| S07 | Navigate to session detail | Click row | Client routing | P0 |

## Session Detail (`/[ws]/sessions/[id]`)

| ID | Interaction | Trigger | Backend | P |
|----|-------------|---------|---------|---|
| SD01 | View session metadata | Page load | GET /api/sessions/[id] | P0 |
| SD02 | Back button | Click | Client routing | P1 |
| SD03 | Extract Insights button | Click | POST /api/insights/extract | P1 |
| SD04 | Cancel extraction | Click | Client-side | P2 |
| SD05 | Agent output panel (live SSE) | SSE stream | GET /api/insights/extract/status | P2 |
| SD06 | TranscriptViewer | Page load | Embedded in session data | P1 |

## Insights List (`/[ws]/insights`)

| ID | Interaction | Trigger | Backend | P |
|----|-------------|---------|---------|---|
| I01 | View insights list | Page load | GET /api/insights | P0 |
| I02 | Filter by category tags | Click tags | Client filtering | P1 |
| I03 | Min score slider | Drag | Client filtering | P2 |
| I04 | Date range filter | Input | Client filtering | P2 |
| I05 | Session ID filter | Input | Client filtering | P2 |
| I06 | Suggested topics | Click | GET /api/content/suggest-arcs | P2 |
| I07 | Multi-select + Generate Content | Checkbox+button | POST /api/content/generate | P1 |

## Insight Detail (`/[ws]/insights/[id]`)

| ID | Interaction | Trigger | Backend | P |
|----|-------------|---------|---------|---|
| ID01 | View insight with scores | Page load | GET /api/insights/[id] | P0 |
| ID02 | Back button | Click | Client routing | P1 |
| ID03 | TemplateSelector | Click | Client-side | P2 |
| ID04 | Format checkboxes (blog, twitter, etc.) | Click | Client-side | P1 |
| ID05 | Generate Selected button | Click | POST /api/content/generate | P1 |
| ID06 | View generated content link | Click | Client routing | P1 |

## Content List (`/[ws]/content`)

| ID | Interaction | Trigger | Backend | P |
|----|-------------|---------|---------|---|
| C01 | View content list | Page load | GET /api/content | P0 |
| C02 | Calendar view tab | Click | Client-side | P1 |
| C03 | Pipeline view tab | Click | Client-side | P1 |
| C04 | List view tab | Click | Client-side | P0 |
| C05 | Export panel | Click | Client-side | P2 |
| C06 | Series/collections filter | URL params | Client-side | P2 |
| C07 | Navigate to content editor | Click row | Client routing | P0 |
| C08 | Navigate to new content | Click "New" | Client routing | P0 |
| C09 | Manage Series dialog | Click | Client-side | P2 |
| C10 | Manage Collections dialog | Click | Client-side | P2 |
| C11 | Pipeline status line | Page load | GET /api/automation/runs | P1 |

## Content Editor (`/[ws]/content/[postId]`)

| ID | Interaction | Trigger | Backend | P |
|----|-------------|---------|---------|---|
| CE01 | View/edit content | Page load | GET /api/content/[id] | P0 |
| CE02 | Save (Cmd+S) | Click/keyboard | PUT /api/content/[id] | P0 |
| CE03 | View mode toggle (Edit/Split/Preview) | Click | Client-side | P0 |
| CE04 | Status dropdown (Draft/Published/Archived) | Select | PUT /api/content/[id] | P1 |
| CE05 | Publish to Hashnode | Click | POST /api/content/[id]/publish/hashnode | P1 |
| CE06 | Publish to Dev.to | Click | POST /api/content/[id]/publish/devto | P2 |
| CE07 | ExportDropdown | Click | Client-side | P2 |
| CE08 | Repurpose dropdown | Click | POST /api/content/[id]/repurpose | P2 |
| CE09 | History toggle | Click | GET /api/content/[id]/history | P2 |
| CE10 | Title input | Type | Client-side | P0 |
| CE11 | AI Chat sidebar tab | Click | POST /api/content/[id]/chat | P1 |
| CE12 | SEO sidebar tab | Click | GET /api/content/[id]/seo | P1 |
| CE13 | Evidence sidebar tab | Click | GET /api/content/[id]/evidence | P2 |
| CE14 | More/Supplementary tab | Click | GET /api/content/[id]/supplementary | P2 |
| CE15 | Media tab | Click | GET /api/content/[id]/media | P2 |
| CE16 | Repo tab | Click | GET /api/content/[id]/repository | P2 |
| CE17 | Auto-save (2 min) | Timer | PUT /api/content/[id] | P1 |
| CE18 | Create Template from Post | Click | POST /api/content/templates | P2 |
| CE19 | Mobile AI Chat FAB | Click | Client-side | P2 |
| CE20 | Back button | Click | Client routing | P1 |

## Content New (`/[ws]/content/new`)

| ID | Interaction | Trigger | Backend | P |
|----|-------------|---------|---------|---|
| CN01 | Topic textarea | Type | Client-side | P0 |
| CN02 | Perspective textarea | Type | Client-side | P1 |
| CN03 | Add external URLs | Click+type | Client-side | P1 |
| CN04 | Add GitHub repos | Click+type | Client-side | P1 |
| CN05 | Arc selection (auto-suggest) | Click | POST /api/content/suggest-arcs | P1 |
| CN06 | Generate Evidence-Based Content | Click | POST /api/content/generate | P0 |
| CN07 | Cancel generation | Click | Client-side | P1 |
| CN08 | Back button | Click | Client routing | P1 |

## Analytics (`/[ws]/analytics`)

| ID | Interaction | Trigger | Backend | P |
|----|-------------|---------|---------|---|
| AN01 | View metrics tiles | Page load | GET /api/analytics | P0 |
| AN02 | Timeframe selector | Click | GET /api/analytics?range=X | P1 |
| AN03 | Platform breakdown | Page load | Included in analytics | P1 |

## Automation (`/[ws]/automation`)

| ID | Interaction | Trigger | Backend | P |
|----|-------------|---------|---------|---|
| AU01 | View trigger list | Page load | GET /api/automation/triggers | P0 |
| AU02 | Create trigger (form) | Click+form | POST /api/automation/triggers | P0 |
| AU03 | Delete trigger | Click | DELETE /api/automation/triggers/[id] | P1 |
| AU04 | Run Now button | Click | POST /api/automation/triggers/[id]/run | P0 |
| AU05 | Batch Generate | Click | POST /api/automation/batch-generate | P1 |
| AU06 | View run history | Page load | GET /api/automation/runs | P0 |
| AU07 | Auto-refetch runs | Timer (5s) | GET /api/automation/runs | P2 |

## Pipeline (`/[ws]/observability`)

| ID | Interaction | Trigger | Backend | P |
|----|-------------|---------|---------|---|
| OB01 | View pipeline flow visualization | Page load | GET /api/observability/runs | P0 |
| OB02 | View run history table | Page load | GET /api/observability/runs | P0 |
| OB03 | Auto-refetch during active runs | Timer (3s) | GET /api/observability/runs | P2 |

## Settings — General (`/[ws]/settings`)

| ID | Interaction | Trigger | Backend | P |
|----|-------------|---------|---------|---|
| ST01 | Save workspace name/slug/paths | Click | PUT /api/workspace/[slug] | P0 |
| ST02 | Resume Setup Wizard link | Click | Client routing | P2 |
| ST03 | Copy RSS/Atom feed URLs | Click | Client-side | P2 |
| ST04 | Upload History | Page load | GET /api/workspace/[slug]/uploads | P2 |

## Settings — Style (`/[ws]/settings?tab=style`)

| ID | Interaction | Trigger | Backend | P |
|----|-------------|---------|---------|---|
| SS01 | Save tone/audience/instructions | Click | PUT /api/workspace/[slug]/style | P0 |
| SS02 | Tone dropdown | Select | Client-side | P1 |
| SS03 | Checkboxes (code/terminal) | Click | Client-side | P1 |
| SS04 | Max word count input | Type | Client-side | P1 |

## Settings — API Keys (`/[ws]/settings?tab=api-keys`)

| ID | Interaction | Trigger | Backend | P |
|----|-------------|---------|---------|---|
| SK01 | Create API key | Click+type | POST /api/api-keys | P0 |
| SK02 | Copy revealed key | Click | Client-side | P0 |
| SK03 | Delete API key | Click | DELETE /api/api-keys/[id] | P1 |

## Settings — Integrations (`/[ws]/settings?tab=integrations`)

| ID | Interaction | Trigger | Backend | P |
|----|-------------|---------|---------|---|
| SI01 | Save Hashnode settings | Click | PUT /api/workspace/[slug]/integrations | P0 |
| SI02 | View connection status | Page load | GET /api/workspace/[slug]/integrations | P1 |

## Settings — Webhooks (`/[ws]/settings?tab=webhooks`)

| ID | Interaction | Trigger | Backend | P |
|----|-------------|---------|---------|---|
| SW01 | Create webhook (URL + events) | Click+form | POST /api/webhooks | P0 |
| SW02 | Copy signing secret | Click | Client-side | P1 |
| SW03 | Toggle webhook | Click | PATCH /api/webhooks/[id] | P1 |
| SW04 | Delete webhook | Click | DELETE /api/webhooks/[id] | P1 |

## Settings — Sources (`/[ws]/settings?tab=sources`)

| ID | Interaction | Trigger | Backend | P |
|----|-------------|---------|---------|---|
| SC01 | Add SSH source | Click+form | POST /api/scan-sources | P0 |
| SC02 | Check connection | Click | POST /api/scan-sources/[id]/check | P0 |
| SC03 | Toggle source | Click | PATCH /api/scan-sources/[id] | P1 |
| SC04 | Delete source | Click | DELETE /api/scan-sources/[id] | P1 |

## Navigation

| ID | Interaction | Trigger | Backend | P |
|----|-------------|---------|---------|---|
| NAV01 | Sidebar navigation (7 items) | Click | Client routing | P0 |
| NAV02 | Mobile bottom nav (5 items) | Click | Client routing | P0 |
| NAV03 | Mobile "More" sheet (3 items) | Click | Client routing | P1 |
| NAV04 | Global search (Cmd+K) | Keyboard | Client-side | P1 |
| NAV05 | Health check indicator | 60s poll | GET /api/health | P2 |

## Auth & Onboarding

| ID | Interaction | Trigger | Backend | P |
|----|-------------|---------|---------|---|
| LG01 | Email/password login | Submit | POST /api/auth/sign-in/email | P0 |
| LG02 | GitHub OAuth | Click | GET /api/auth/sign-in/social | P1 |
| SU01 | Create account | Submit | POST /api/auth/sign-up/email | P0 |
| OW01 | Onboarding wizard (5 steps) | Next/Skip | Client + POST /api/workspace | P1 |

---

**Total: 137 inventoried interactions** — P0: 52 | P1: 60 | P2: 25
