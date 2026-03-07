# Phase 03 — Settings Page: Tab Navigation

**Priority:** HIGH
**Status:** NOT STARTED
**Effort:** Medium (3-4 hours)

---

## Context

The Settings page (`src/app/(dashboard)/[workspace]/settings/page.tsx`, 261 lines) currently only shows General settings: Workspace Name, Slug, Session Scan Paths, RSS Feeds, Upload History.

Five settings sub-pages were deleted with no replacement:
- Style settings (writing tone, voice preferences)
- API Keys (key generation, management)
- Integrations (Hashnode, Dev.to, WordPress, Twitter, LinkedIn)
- Webhooks (endpoint management, event subscriptions)
- WordPress (was supposed to fold into Integrations)

The functionality from these pages needs to be restored as tabs within the single Settings page.

## Pre-Work: Read Existing Settings Code

Before implementing, read the deleted settings page content from git history or existing API routes to understand what each tab needs:

```bash
# Check what API routes exist for each settings area
ls src/app/api/settings/
ls src/app/api/integrations/
ls src/app/api/webhooks/
```

The API backends likely still exist — only the UI pages were deleted.

## Implementation

### Step 1: Add Tab Navigation Component

**File:** `src/app/(dashboard)/[workspace]/settings/page.tsx`

- Add shadcn Tabs component with 5 tabs: General | Style | API Keys | Integrations | Webhooks
- General tab keeps existing content (Workspace Name, Slug, Scan Paths, RSS, Upload History)
- URL state: `?tab=general`, `?tab=style`, `?tab=api-keys`, `?tab=integrations`, `?tab=webhooks`

### Step 2: Style Tab

- Writing tone/voice settings
- Content style preferences
- Fetch from existing style API routes
- Save functionality

### Step 3: API Keys Tab

- List existing API keys (masked)
- "Generate New Key" button
- Copy/reveal/delete actions
- Fetch from existing API keys routes

### Step 4: Integrations Tab

- Hashnode, Dev.to, WordPress connection cards
- Twitter, LinkedIn integration cards (added in recent commit)
- Each with connect/disconnect, configuration fields
- Fetch from existing integrations API routes

### Step 5: Webhooks Tab

- List existing webhooks with endpoint URLs
- "Create Webhook" button/form
- Event type selection (content.created, content.published, etc.)
- Signing secret display (one-time reveal)
- Enable/disable/delete actions
- Fetch from existing webhooks API routes

### Step 6: URL Redirects

- `/[workspace]/settings/style` → `/[workspace]/settings?tab=style`
- `/[workspace]/settings/api-keys` → `/[workspace]/settings?tab=api-keys`
- `/[workspace]/settings/integrations` → `/[workspace]/settings?tab=integrations`
- `/[workspace]/settings/webhooks` → `/[workspace]/settings?tab=webhooks`
- `/[workspace]/settings/wordpress` → `/[workspace]/settings?tab=integrations`

## Files to Modify

- `src/app/(dashboard)/[workspace]/settings/page.tsx` — Add tab navigation + all tab content

## Files to Create (Redirects)

- `src/app/(dashboard)/[workspace]/settings/style/page.tsx` — Redirect
- `src/app/(dashboard)/[workspace]/settings/api-keys/page.tsx` — Redirect
- `src/app/(dashboard)/[workspace]/settings/integrations/page.tsx` — Redirect
- `src/app/(dashboard)/[workspace]/settings/webhooks/page.tsx` — Redirect
- `src/app/(dashboard)/[workspace]/settings/wordpress/page.tsx` — Redirect

## Validation Gate

Before proceeding to Phase 04:

- [ ] Navigate to Settings page via Playwright
- [ ] Tab navigation visible with 5 tabs (screenshot)
- [ ] General tab loads with workspace name, slug, scan paths (screenshot)
- [ ] Style tab loads with writing preferences (screenshot)
- [ ] API Keys tab loads, "Generate New Key" button visible (screenshot)
- [ ] Integrations tab loads with Hashnode/Dev.to/WordPress/Twitter/LinkedIn cards (screenshot)
- [ ] Webhooks tab loads with webhook list or empty state (screenshot)
- [ ] Click each tab — URL updates with ?tab= parameter
- [ ] `/settings/style` redirects to `/settings?tab=style` (navigate and verify)
- [ ] `/settings/api-keys` redirects to `/settings?tab=api-keys` (navigate and verify)
- [ ] Settings save correctly on General tab (fill form, save, reload, verify values persist)
- [ ] `bun run build` passes with zero errors
- [ ] No console errors on Settings page

## Success Criteria

- [ ] All 5 settings areas accessible via tabs
- [ ] Tab state reflected in URL
- [ ] All settings functionality restored (Style, API Keys, Integrations, Webhooks)
- [ ] Old sub-page URLs redirect properly
- [ ] Save/load works for each tab
- [ ] Production build passes
