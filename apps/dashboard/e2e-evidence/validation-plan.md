# E2E Validation Plan
Generated: 2026-03-03
Platform: Web (Next.js 15 Fullstack)

## Prerequisites
- [x] Dev server running: `curl http://localhost:3000/api/healthcheck`
- [x] Database connected: healthcheck returns `db: true`
- [x] Playwright MCP browser available

## Journey 1: API Healthcheck
**PASS Criteria:**
- [ ] GET /api/healthcheck returns HTTP 200
- [ ] Response contains `"status":"ok"` and `"db":true`

**Steps:**
1. curl GET /api/healthcheck
   Evidence: `e2e-evidence/web/01-healthcheck.json`

---

## Journey 2: Auth Login Flow
**PASS Criteria:**
- [ ] /login page renders with email/password fields and "Sign in" button
- [ ] After login, redirects to /[workspace] dashboard
- [ ] Dashboard shows user name in sidebar

**Steps:**
1. Navigate to /login, screenshot
   Evidence: `e2e-evidence/web/02-login-page.png`
2. Fill credentials, submit
3. Screenshot dashboard after redirect
   Evidence: `e2e-evidence/web/02-post-login-dashboard.png`

---

## Journey 3: Dashboard Home
**PASS Criteria:**
- [ ] Page shows "Settings" heading or stats cards
- [ ] Sidebar navigation has all 6+ links
- [ ] No console errors

**Steps:**
1. Navigate to /my-workspace, screenshot at 1440px
   Evidence: `e2e-evidence/web/03-dashboard-1440.png`

---

## Journey 4: Sessions Page
**PASS Criteria:**
- [ ] Page renders with "Sessions" heading
- [ ] "Scan Now" button visible
- [ ] Filter input visible
- [ ] Empty state or session list displayed

**Steps:**
1. Navigate to /my-workspace/sessions, screenshot
   Evidence: `e2e-evidence/web/04-sessions-1440.png`

---

## Journey 5: Insights Page
**PASS Criteria:**
- [ ] Page renders with "Insights" heading
- [ ] Score bars use /10 scale (not /5)
- [ ] Composite scores use /75 scale

**Steps:**
1. Navigate to /my-workspace/insights, screenshot
   Evidence: `e2e-evidence/web/05-insights-1440.png`

---

## Journey 6: Content Page
**PASS Criteria:**
- [ ] Page renders with "Content" heading
- [ ] Empty state or post list displayed

**Steps:**
1. Navigate to /my-workspace/content, screenshot
   Evidence: `e2e-evidence/web/06-content-1440.png`

---

## Journey 7: Settings Page (All Sections)
**PASS Criteria:**
- [ ] General: Workspace Name and Slug fields populated
- [ ] Scan Config: Lookback Window dropdown with 6 options
- [ ] RSS Feeds: RSS 2.0 and Atom URLs displayed with Copy buttons
- [ ] Danger Zone: Delete button with red styling

**Steps:**
1. Navigate to /my-workspace/settings, full-page screenshot
   Evidence: `e2e-evidence/web/07-settings-1440.png`

---

## Journey 8: Settings Save (Interactive)
**PASS Criteria:**
- [ ] Changing lookback window and clicking Save shows "Settings saved." confirmation
- [ ] Workspace name change persists after page reload

**Steps:**
1. Change lookback to "Last 90 days", click Save
2. Screenshot success message
   Evidence: `e2e-evidence/web/08-settings-saved.png`

---

## Journey 9: Responsive - Mobile (375px)
**PASS Criteria:**
- [ ] Sidebar hidden, bottom navigation bar visible with 5 icons
- [ ] Content fills full width, no horizontal overflow
- [ ] Settings sections stack vertically

**Steps:**
1. Resize to 375x812, screenshot dashboard
   Evidence: `e2e-evidence/web/09-mobile-dashboard.png`
2. Screenshot settings
   Evidence: `e2e-evidence/web/09-mobile-settings.png`

---

## Journey 10: Responsive - Tablet (768px)
**PASS Criteria:**
- [ ] Layout adapts (sidebar may collapse or remain)
- [ ] Content readable, no overflow

**Steps:**
1. Resize to 768x1024, screenshot dashboard
   Evidence: `e2e-evidence/web/10-tablet-dashboard.png`

---

## Journey 11: Responsive - Desktop (1440px)
**PASS Criteria:**
- [ ] Sidebar visible with full labels
- [ ] Content area properly spaced

**Steps:**
1. Resize to 1440x900, screenshot dashboard
   Evidence: `e2e-evidence/web/11-desktop-dashboard.png`
