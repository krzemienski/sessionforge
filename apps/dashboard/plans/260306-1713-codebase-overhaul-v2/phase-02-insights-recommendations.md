# Phase 02 — Insights Page: Recommendations Merge

**Priority:** HIGH
**Status:** NOT STARTED
**Effort:** Small (1-2 hours)

---

## Context

The Recommendations page was deleted from the sidebar and filesystem. The API route still exists:
- `src/app/api/content/recommendations/route.ts` (129 lines) — GET (list with priority/status filtering), PATCH (accept/dismiss with feedback)

The Insights page (`src/app/(dashboard)/[workspace]/insights/page.tsx`, 342 lines) currently shows insights with category filters, score slider, multi-select, and a flow banner. Recommendations need to appear as a section on this page.

## Implementation

### Step 1: Add "Suggested Topics" Section to Insights Page

**File:** `src/app/(dashboard)/[workspace]/insights/page.tsx`

- Add a "Suggested Topics" card/section at the top of the Insights page (above the insights list)
- Fetch recommendations from `GET /api/content/recommendations`
- Show each recommendation with:
  - Topic title and description
  - Priority badge (high/medium/low)
  - "Accept" button → PATCH with status=accepted
  - "Dismiss" button → PATCH with status=dismissed
- When accepted, navigate to content creation with topic pre-filled
- Show empty state: "No suggested topics. Extract more insights to generate recommendations."

### Step 2: URL Redirect

- `/[workspace]/recommendations` → `/[workspace]/insights`

Create a redirect page file.

## Files to Modify

- `src/app/(dashboard)/[workspace]/insights/page.tsx` — Add Suggested Topics section

## Files to Create

- `src/app/(dashboard)/[workspace]/recommendations/page.tsx` — Redirect to `/insights`

## Validation Gate

Before proceeding to Phase 03:

- [ ] Navigate to Insights page via Playwright
- [ ] "Suggested Topics" section is visible at top of page (screenshot)
- [ ] If recommendations exist: topic cards render with Accept/Dismiss buttons (screenshot)
- [ ] If no recommendations: empty state message is shown (screenshot)
- [ ] Accept button calls PATCH and updates UI
- [ ] `/recommendations` URL redirects to Insights page (navigate and verify)
- [ ] Existing insights list still works below the Suggested Topics section
- [ ] Flow banner ("X insights available. Generate Content") still present
- [ ] `bun run build` passes with zero errors
- [ ] No console errors on Insights page

## Success Criteria

- [ ] Recommendations accessible from Insights page
- [ ] Accept/Dismiss functionality works
- [ ] Old URL redirects properly
- [ ] No functionality lost from original Recommendations page
- [ ] Production build passes
