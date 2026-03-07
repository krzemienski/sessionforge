# Phase 01 — Content Page: Series & Collections Merge

**Priority:** HIGH
**Status:** NOT STARTED
**Effort:** Medium (3-4 hours)

---

## Context

Series and Collections pages were deleted from the sidebar and filesystem, but their API routes still exist:
- `src/app/api/series/route.ts` — GET (list with post counts), POST (create)
- `src/app/api/collections/route.ts` — GET (list), POST (create)

The Content page (`src/app/(dashboard)/[workspace]/content/page.tsx`, 334 lines) currently has Calendar/Pipeline/List views with status filters. Series and Collections need to become accessible from this page.

## Implementation

### Step 1: Add Series Tab/Filter to Content Page

**File:** `src/app/(dashboard)/[workspace]/content/page.tsx`

- Add a "Series" filter dropdown or sidebar section on the Content page
- Fetch series list from `GET /api/series`
- When a series is selected, filter content list to show only posts in that series
- Add "Manage Series" button that opens a dialog/modal for CRUD:
  - List existing series with edit/delete actions
  - "New Series" form: title, slug, description, coverImage, isPublic
  - Uses existing `POST /api/series` and series-specific API routes

### Step 2: Add Collections Tab/Filter to Content Page

**File:** `src/app/(dashboard)/[workspace]/content/page.tsx`

- Add a "Collections" filter dropdown or sidebar section alongside Series
- Fetch collections from `GET /api/collections`
- When a collection is selected, filter content to show only posts in that collection
- Add "Manage Collections" button for CRUD modal:
  - List existing collections with edit/delete
  - "New Collection" form using existing `POST /api/collections`

### Step 3: URL Redirects

- `/[workspace]/series` → `/[workspace]/content?filter=series`
- `/[workspace]/collections` → `/[workspace]/content?filter=collections`

Create redirect pages or use Next.js middleware.

## Files to Modify

- `src/app/(dashboard)/[workspace]/content/page.tsx` — Add Series/Collections filters + CRUD modals

## Files to Create

- `src/app/(dashboard)/[workspace]/series/page.tsx` — Redirect to `/content?filter=series`
- `src/app/(dashboard)/[workspace]/collections/page.tsx` — Redirect to `/content?filter=collections`

## Validation Gate

Before proceeding to Phase 02:

- [ ] Navigate to Content page via Playwright
- [ ] Series filter is visible and functional (screenshot)
- [ ] Collections filter is visible and functional (screenshot)
- [ ] "Manage Series" dialog opens and shows CRUD form (screenshot)
- [ ] "Manage Collections" dialog opens and shows CRUD form (screenshot)
- [ ] `/series` URL redirects to Content page (navigate and verify)
- [ ] `/collections` URL redirects to Content page (navigate and verify)
- [ ] `bun run build` passes with zero errors
- [ ] No console errors on Content page

## Success Criteria

- [ ] Series accessible from Content page (filter + management)
- [ ] Collections accessible from Content page (filter + management)
- [ ] Old URLs redirect properly
- [ ] No functionality lost from original Series/Collections pages
- [ ] Production build passes
