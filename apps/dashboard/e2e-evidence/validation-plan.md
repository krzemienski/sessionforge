# E2E Validation Plan
Generated: 2026-03-02T23:15
Platform: fullstack (Next.js 15 + Neon Postgres)

## Prerequisites
- [ ] Node/Bun installed
- [ ] Database accessible (Neon Postgres via DATABASE_URL)
- [ ] Port 3000 available
- [ ] .env.local configured
- [ ] Playwright browser available

## Journey 1: Health Check API
**PASS Criteria:**
- [ ] GET /api/healthcheck returns HTTP 200
- [ ] Response JSON contains `status: "ok"` and `db: true`
- [ ] Response includes `timestamp` field with valid ISO date

## Journey 2: Auth Pages Render
**PASS Criteria:**
- [ ] /login renders with email input, password input, submit button
- [ ] /signup renders with name input, email input, password input, submit button
- [ ] No console errors on either page

## Journey 3: Workspace API
**PASS Criteria:**
- [ ] GET /api/workspace returns HTTP 200 with JSON (or auth redirect)
- [ ] Workspace objects contain id, name, slug fields

## Journey 4: Dashboard Page
**PASS Criteria:**
- [ ] Dashboard at /[workspace] renders (not blank)
- [ ] Navigation sidebar visible with Sessions, Insights, Content, Automation, Settings links
- [ ] Main content area loads

## Journey 5: Sessions Page
**PASS Criteria:**
- [ ] Sessions page renders with list or empty state
- [ ] Page shows "Sessions" heading
- [ ] Scan button visible

## Journey 6: Insights Page
**PASS Criteria:**
- [ ] Insights page renders
- [ ] Score bars use /10 scale (not /5)
- [ ] Bar widths calculated as (score/10 * 100)%

## Journey 7: Content Page
**PASS Criteria:**
- [ ] Content page renders with post list or empty state
- [ ] Content cards show title, status, content type

## Journey 8: Automation Page
**PASS Criteria:**
- [ ] Automation page renders
- [ ] Trigger list or create UI accessible

## Journey 9: Settings Pages
**PASS Criteria:**
- [ ] /settings renders with workspace config form
- [ ] /settings/api-keys renders with key management UI
- [ ] /settings/integrations renders with dev.to section
- [ ] /settings/style renders with tone/audience settings

## Journey 10: API Endpoints
**PASS Criteria:**
- [ ] GET /api/sessions returns valid JSON
- [ ] GET /api/insights returns valid JSON
- [ ] GET /api/content returns valid JSON
- [ ] GET /api/automation/triggers returns valid JSON

## Journey 11: Responsive Design
**PASS Criteria:**
- [ ] Login page correct at 375px, 768px, 1440px
- [ ] Dashboard correct at all three viewports
- [ ] No horizontal overflow at mobile

## Execution Order
1. Build & start dev server
2. Journey 1 (healthcheck API)
3. Journey 3 + 10 (API endpoints)
4. Journey 2 (auth pages)
5. Journey 4-8 (feature pages)
6. Journey 9 (settings)
7. Journey 11 (responsive)
