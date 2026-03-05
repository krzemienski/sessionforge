# SessionForge Dashboard - Complete Interaction Map

**Date:** March 5, 2026  
**Scope:** All list/detail pages in the dashboard  
**Total Pages Analyzed:** 12 pages + detail views

---

## 1. WORKSPACE HOME: `[workspace]/page.tsx`

### Stats Display
- **Scan Now Button** → `scan.mutate(30)` → `/api/workspace/{workspace}/scan` (POST)
- Shows: Sessions count, Insights count, Drafts count, Last Scan time
- Streak badge (when > 0 days)

### Empty State Actions (when no sessions)
- **Scan Sessions Button** → Same as above
- **View setup guide link** → `/onboarding`

### One-Time Scan Success Alert
- Shows scanned count, new/updated session counts

---

## 2. CONTENT LIST: `[workspace]/content/page.tsx`

### Header
- **Export Button** (Download icon) → Toggles export form

### Export Modal (when open)
**Filters:**
- Type dropdown: All Types, Blog Post, Twitter Thread, LinkedIn Post, Changelog, Newsletter, Dev.to Post, Custom
- Status dropdown: All Statuses, Idea, Draft, In Review, Published, Archived
- From date input
- To date input
- Large export warning (50+ files)

**Actions:**
- **Download ZIP Button** → `handleExport()` → POST `/api/content/export` with filters
- **Cancel Button** → Closes modal

### View Tabs
Three mutually exclusive buttons:
- **Calendar** (CalendarDays icon)
- **Pipeline** (LayoutGrid icon)
- **List** (List icon)
- Default: Calendar if automation triggers exist, else List

### List View (when tab = "list")
**Status Filter Buttons (horizontal tabs):**
- All, Ideas, Drafts, In Review, Published, Archived
- Updates `statusFilter` state → refetches with `status` param

**Content Cards (per item):**
- Status badge (colored, capitalized)
- Content Type badge
- SEO Score badge (if available, color-coded by score: 70+ green, 40-69 yellow, <40 red)
- Time ago text
- Export Dropdown (per item)
- Click anywhere on card → `/[workspace]/content/{postId}`
- Title (clickable)
- First 150 chars of markdown preview
- Word count (if available)

**Empty State:**
- FileText icon
- "No content yet. Generate content from insights or create manually."

**API Calls:**
- `useContent(workspace, { limit: 50, status })` → GET `/api/content`
- `useContentStreak(workspace)` → GET `/api/content/streak`
- `useQuery` for triggers → GET `/api/automation/triggers?workspace={workspace}`

### Calendar View
- Delegates to `<CalendarView workspace={workspace} />`

### Pipeline View
- Delegates to `<PipelineView workspace={workspace} onNavigateToPost={(postId) => router.push(...)} />`

---

## 3. NEW CONTENT: `[workspace]/content/new/page.tsx`

### Header
- **Back Button** (ChevronLeft icon) → `router.back()`
- Title: "New Content"
- Subtitle: "Generate evidence-based content from your sessions and sources"

### Form Section (when `!isGenerating`)

**Topic Field** (required)
- Textarea, 3 rows
- Placeholder: "What do you want to write about? Be specific…"
- Triggers debounced arc suggestions at 1500ms when length >= 10 chars
- API: POST `/api/content/suggest-arcs` → Returns `{ arcs: ArcOption[] }`

**Your Perspective Field** (optional)
- Textarea, 4 rows
- Placeholder: "e.g. I've been using drizzle-orm for 6 months…"

**External URLs Field** (optional, max 10)
- Dynamic list of URL inputs
- **Add URL Button** (Plus icon) when < 10 URLs
- **Remove Button** (X icon) per URL when > 1

**GitHub Repositories Field** (optional, max 5)
- Dynamic list of GitHub URL inputs
- Same add/remove pattern

**Narrative Arc Selection** (appears when arcs.length > 0)
- Grid of arc cards (2 columns)
- Each card: icon + name + description
- Click to toggle selection (highlight with accent border)
- Loading spinner while fetching arcs

**Generate Button**
- **Generate Evidence-Based Content** → Disabled when topic is empty
- API: POST `/api/agents/evidence` → Server-sent events stream
- Events: `status`, `text`, `tool_result`, `complete`, `error`
- On success: redirects to `/{workspace}/content/{postId}`

### Progress View (when `isGenerating`)

**Header:**
- "Generating Content"
- **Cancel Button** → `handleCancel()` (aborts fetch)

**Step Indicators (4 total):**
1. Processing sources (ingesting phase)
2. Mining session evidence (mining phase)
3. Assembling research (assembling/arc_selection phase)
4. Writing content (writing phase)

**Per-Step Display:**
- Numbered circle: shows step number or ✓ if done
- Status label
- Active step shows message + spinner
- Assembling phase shows: URL count, repo count, brief status, cross-reference count

**Live Preview Section**
- Shows accumulated text chunks from stream

**Completion Alert:**
- "Content generated — redirecting to editor…"

**Error Alert:**
- Shows error message
- "Try again" button → resets state

---

## 4. SESSIONS LIST: `[workspace]/sessions/page.tsx`

### Header
- **Last Scan timestamp** (if available)

### Top Action Bar
- **Filters Button** (SlidersHorizontal icon)
  - Badge shows active filter count (red dot)
  - Toggles filter panel
  - States: active (accent bg) / inactive
- **Full Rescan Button** (RotateCcw icon)
  - Calls `handleScan(true)`
  - POST `/api/workspace/{workspace}/scan` with `fullRescan: true`
  - Disabled during scan
- **Scan Now Button** (Zap icon)
  - Calls `handleScan(false)` for incremental
  - Uses streaming scan for real-time progress

### Streaming Scan Progress (when scanning)
- "Scanning {total} files…" or "Scanning file {current} of {total}"
- Progress bar with percentage
- Current project path display
- **Cancel Button** → `streamingScan.cancel()`

### Scan Result Alerts
- Incremental/Full rescan completion: new, updated, scanned counts, duration
- Scan errors: "Scan error: {message}"

### Upload Zone
- Drag & drop zone or click to select `.jsonl` files
- Shows upload progress with stats
- Success results display: sessionId, status (success/error), error message

### Filters Panel (when `showFilters`)
- **Close Button** (X icon)
- **Clear all button** (if filters active)

**Filter Fields:**
- Date From (date input)
- Date To (date input)
- Project (text search)
- Min Messages (number input)
- Max Messages (number input)
- Summary dropdown: All Sessions / Has Summary / No Summary

**Behavior:** Changing any filter resets offset to 0

### Multi-Select Toolbar (when items selected)
- Shows: "X selected of Y total"
- **Select All Button**
- **Clear Selection Button**
- **Extract Insights Button** (Sparkles icon)
  - Calls `extractInsightsBatch.mutateAsync(selectedIds)`
  - POST `/api/batch/extract-insights`
  - Opens JobProgressModal with jobId
  - Clears selection after

### Sessions List
**Per Session Card:**
- Checkbox (with shift-click range support)
- Status: left accent border
- Project name (bold)
- Time ago (right side)
- Message count · files modified · tools used (first 4) · duration
- Summary text (if available, truncated)
- Click to navigate → `/{workspace}/sessions/{sessionId}`
- When selected: ring highlight + bg accent/30

**Empty State:**
- ScrollText icon
- "No sessions found"
- "Scan your Claude projects to import sessions…"
- **Scan Now Button** + link to setup guide

### Pagination
- **Prev Button** (disabled when offset = 0)
- **Next Button** (always enabled)
- Shows when `sessionList.length >= limit` (20 items)

**API Calls:**
- `useSessions(workspace, { limit: 20, offset, ...filters })` → GET `/api/sessions`
- `useScanSessions(workspace)` → POST `/api/workspace/{workspace}/scan`
- `useStreamingScan(workspace)` → Streaming GET with event source
- `useUploadSessions()` → POST `/api/sessions/upload`
- `useExtractInsightsBatch(workspace)` → POST `/api/batch/extract-insights`

---

## 5. SESSION DETAIL: `[workspace]/sessions/[sessionId]/page.tsx`

### Header
- **Back to Sessions Button** (ArrowLeft icon) → `router.push(/{workspace}/sessions)`

### Session Info Card
- **Title:** Project name (h1)
- Metadata: message count, files modified, duration, cost (USD)
- **Extract Insights Button** (Lightbulb icon)
  - Calls `extract.mutate([sessionId])`
  - POST `/api/sessions/{sessionId}/extract-insights`
  - Shows loading state
- **Cancel Button** (if extracting)

### Agent Output Panel (when hasActivity)
- Header: "Agent Output" + pulsing dot (if extracting)
- **Close Button** (X icon, if not extracting)
- Scrollable content area (max-h-80)
- Status messages (●), tool use (→), results (←), text, completion (✓), errors (✗)
- Colored by type (accent, yellow, muted, green, red)

### Tools Used Section
- Tags for each tool (gray bg)
- Only shows if tools present

### Transcript Viewer Component
- Delegates to `<TranscriptViewer sessionId={sessionId} workspace={workspace} />`

**API Calls:**
- `useSession(sessionId)` → GET `/api/sessions/{sessionId}`
- `useExtractInsights(workspace)` → Streaming POST with event handling

---

## 6. INSIGHTS LIST: `[workspace]/insights/page.tsx`

### Header
- **Filters Button** (SlidersHorizontal icon)
  - Badge shows active filter count
  - Toggles filter panel

### Filters Panel (when open)
**Category Buttons (6 options):**
- Novel Problem-Solving (purple)
- Tool Pattern Discovery (blue)
- Before/After Transform (green)
- Failure + Recovery (red)
- Architecture Decision (yellow)
- Performance Optimization (cyan)
- Toggle selection

**Min Score Slider:**
- Range 0-65
- Label shows current value

**Date Range:**
- From (date input)
- To (date input)

**Session ID:**
- Text search input

**Actions:**
- **Clear all button** (if filters active)
- **Close button** (X icon)

### Multi-Select Toolbar (when items selected)
- Shows: "X selected of Y total"
- **Select All** / **Clear Selection**
- **Generate Content Button** (Sparkles icon)
  - Calls `generateContentBatch.mutateAsync({ insightIds })`
  - POST `/api/batch/generate-content`
  - Opens JobProgressModal with jobId

### Insights List
**Per Insight Card:**
- Checkbox with shift-click range support
- Category badge (colored, e.g., "Novel")
- Composite score badge (accent bg, "X/65" format)
- Title (h3)
- Description (2-line clamp)
- 6 dimension bars (novelty, tool pattern, transformation, failure recovery, reproducibility, scale)
- When selected: ring highlight + bg accent/30
- Click card → `/{workspace}/insights/{insightId}`

**Empty State:**
- Lightbulb icon
- "No insights yet"
- "Extract insights from your sessions…"
- **View Sessions Button** → `/{workspace}/sessions`
- Link to setup guide

**API Calls:**
- `useInsights(workspace, { limit: 50, ...filters })` → GET `/api/insights`
- `useGenerateContentBatch(workspace)` → POST `/api/batch/generate-content`

---

## 7. INSIGHT DETAIL: `[workspace]/insights/[insightId]/page.tsx`

### Header
- **Back to Insights Button** (ArrowLeft icon) → `router.push(/{workspace}/insights)`

### Insight Info
- Title (h1)
- Composite score badge ("X/65", accent bg)
- Category label (capitalized, replaces _ with space)

### Description Section
- White-space-preserving text display

### Dimension Scores
- 6-row table showing each dimension:
  - Label + weight (3x, 2x, 1x)
  - Score (/5)
  - Progress bar

### Code Snippets Section (if available)
- Multiple code blocks
- Each with context header (if available)
- `<pre><code>` with monospace font

### Template Selector
- Delegates to `<TemplateSelector workspace={workspace} contentType="blog_post" ... />`
- Allows selecting a template for generation

### Generate Content Section
**Format Checkboxes (5 options):**
- Blog Post
- Twitter Thread
- LinkedIn Post
- Newsletter
- Changelog
- Each shows status badge: Not generated / Generating… / Done / Error
- Completed formats show "View" link (ExternalLink icon)

**Generate Button:**
- **Generate Selected** 
- Disabled when no selection or already generating
- Calls `generateFormats(Array.from(selectedFormats))`
- POST with `insightId` and `formats`

**API Calls:**
- `useInsight(insightId)` → GET `/api/insights/{insightId}`
- `useGenerateFormats(workspace, insightId, templateId)` → Handles streaming generation

---

## 8. SERIES LIST: `[workspace]/series/page.tsx`

### Header
- **Create Series Button** (Plus icon)
  - Opens modal
  - Fixed inset overlay (black/50 bg)

### Create Series Modal
**Fields:**
- Title (required, text input, autofocus)
- Description (optional, textarea 3 rows)
- Slug (required, text input) - auto-generated from title
- "Make this series public" checkbox

**Actions:**
- **Create Series Button** (Plus icon, Loader2 on pending)
- **Cancel Button**
- Disabled when: !title || !slug || pending

**Behavior:** Auto-generates slug from title on first edit (lowercase, replace non-alphanumeric with -)

### Series List
**Per Series Card:**
- Title (h3)
- "Public" badge (info/10 bg, if isPublic)
- Description (2-line clamp, if available)
- Book icon + post count + "Updated X time ago"
- **Delete Button** (Trash2 icon, with confirmation)
- Click card → `/{workspace}/series/{seriesId}`

**Empty State:**
- BookOpen icon
- "No series yet"
- "Create your first series to organize related content…"
- **Create Series Button**

**API Calls:**
- `useSeries(workspace, { limit: 50 })` → GET `/api/series`
- `useCreateSeries()` → POST `/api/series`
- `useDeleteSeries()` → DELETE `/api/series/{id}`

---

## 9. SERIES DETAIL: `[workspace]/series/[seriesId]/page.tsx`

### Header
- **Back to Series Button** (ArrowLeft icon)
- **Save Button** (Save icon) → `handleSave()`
  - PUT `/api/series/{seriesId}` with updated fields
  - Shows "Saving…" state

### Series Info Form
**Fields:**
- Title (text input)
- Description (textarea 3 rows)
- Slug (text input)
- "Make this series public" checkbox

### Posts in Series Section
- **Posts count header:** "Posts in Series (X)"
- Drag instruction: "Drag to reorder"

**Per Post (draggable):**
- Drag handle (GripVertical icon)
- Part number badge (e.g., "1", "2")
- Title (clickable → `/{workspace}/content/{postId}`)
- Content type + "Updated X time ago"
- **Remove Button** (X icon, with confirmation)
- Drag events: onDragStart, onDragOver, onDragEnd
- Opacity-50 while dragging
- Hover border highlight

**Empty State:**
- FileText icon
- "No posts in this series yet"
- "Add posts from the content page"

**API Calls:**
- `useSingleSeries(seriesId)` → GET `/api/series/{seriesId}`
- `useUpdateSeries()` → PUT `/api/series/{seriesId}`
- `useReorderSeriesPosts()` → PUT `/api/series/{seriesId}/reorder`
- `useRemovePostFromSeries()` → DELETE `/api/series/{seriesId}/posts/{postId}`

---

## 10. COLLECTIONS LIST: `[workspace]/collections/page.tsx`

### Header
- **Create Collection Button** (Plus icon)
  - Opens modal (identical structure to Series Create)

### Create Collection Modal
**Fields:** Title, Description, Slug, "Make this collection public" checkbox  
Same behavior as Series

### Collections List
**Per Collection Card:** 
- Same structure as Series (title, public badge, description, folder icon + count, updated time, delete button)
- Click → `/{workspace}/collections/{collectionId}`

**Empty State:** Folder icon, "No collections yet", "Create your first collection to group related content together"

**API Calls:**
- `useCollections(workspace, { limit: 50 })` → GET `/api/collections`
- `useCreateCollection()` → POST `/api/collections`
- `useDeleteCollection()` → DELETE `/api/collections/{id}`

---

## 11. COLLECTION DETAIL: `[workspace]/collections/[collectionId]/page.tsx`

### Structure
Identical to Series Detail (form + draggable posts list)

**API Calls:**
- `useSingleCollection(collectionId)` → GET `/api/collections/{collectionId}`
- `useUpdateCollection()` → PUT `/api/collections/{collectionId}`
- `useReorderCollectionPosts()` → PUT `/api/collections/{collectionId}/reorder`
- `useRemovePostFromCollection()` → DELETE `/api/collections/{collectionId}/posts/{postId}`

---

## 12. CALENDAR: `[workspace]/calendar/page.tsx`

### Header
- Title: "Content Calendar"
- Subtitle: "View your scheduled and published posts on a calendar"

### Content
- Delegates entirely to `<CalendarView workspace={workspace} />`

---

## 13. SCHEDULE (PUBLISH QUEUE): `[workspace]/schedule/page.tsx`

### Header
- Title: "Publish Queue"
- Subtitle: "Manage your scheduled posts"

### Content
- `<PublishQueue workspace={workspace} />`
- `<RecentActivity items={recentActivity} />`

**API Calls:**
- `useScheduledPosts(workspace)` → GET `/api/schedule/posts`

---

## 14. ANALYTICS: `[workspace]/analytics/page.tsx`

### Header
- Title: "Social Analytics"
- **Timeframe Buttons** (3 options):
  - 7 days
  - 30 days
  - 90 days
  - Active state: accent bg / Inactive: secondary bg + border

### Overall Metrics (when data loaded)
**5 Metric Tiles:**
- Impressions (Eye icon)
- Likes (Heart icon)
- Shares (Share2 icon)
- Comments (MessageCircle icon)
- Clicks (MousePointerClick icon)
- Each shows: label, value (number with locale formatting)

### By Platform Section
**Per Platform Row:**
- Platform icon (Twitter: sky-400, LinkedIn: blue-500)
- Platform name + label
- 5-column grid: Impressions, Likes, Shares, Comments, Clicks
- Each shows icon + label + value

### Trend Chart
- Delegates to `<TrendChart posts={data.posts} timeframe={timeframe} />`

### Empty State (no platforms)
- BarChart2 icon
- "No analytics data yet"
- Link to "Settings → Integrations" to connect Twitter/LinkedIn

**API Calls:**
- Query: GET `/api/analytics/social?workspace={workspace}&timeframe={timeframe}`

---

## 15. AUTOMATION: `[workspace]/automation/page.tsx`

### Header
- **New Trigger Button** (Plus icon) → Toggles form

### Create Trigger Form (when open)
**Fields:**
- Name (text input, placeholder "Weekly Blog")
- Trigger Type dropdown: Manual, Scheduled, File Watch
- Content Type dropdown: Blog Post, Twitter Thread, Changelog, Social Analytics Sync
- Cron presets (for Social Analytics Sync): Hourly / Daily buttons
- Cron expression (text input, monospace, appears for Scheduled)
- Debounce window (for File Watch): number input

**Actions:**
- **Save Button** → POST `/api/automation/triggers` with fields
- **Cancel Button**

### Triggers & Runs List
**Per Trigger Section:**
1. **Trigger Card:**
   - Name (h3)
   - Type · Content Type · Lookback Window
   - Cron expression (if scheduled)
   - Next run time (calculated from cron)
   - Scheduled badge (if qstashScheduleId)
   - File watch status (watching/paused/error with icons)
   - Last file event timestamp (if file watch)
   - Last run time + status
   - **Run Now Button** (Play icon)
     - Shows error message on failure (409 = already running)
   - **Toggle Button** (custom switch)
   - **Delete Button** (Trash2 icon)

2. **Recent Runs Sublist:**
   - Shows runs for this trigger only
   - Per run: status badge (colored, animated pulse if active), timestamp, duration, "View post" link (if postId), error message (if failed)

**Empty State:**
- Zap icon
- "No automation triggers yet"

**API Calls:**
- `useQuery` → GET `/api/automation/triggers?workspace={workspace}`
- `useQuery` → GET `/api/automation/runs?workspace={workspace}` (auto-refetch 3s if active runs)
- POST `/api/automation/triggers` (create)
- DELETE `/api/automation/triggers/{id}` (delete)
- PUT `/api/automation/triggers/{id}` (toggle enabled)
- POST `/api/automation/execute` (run trigger)

---

## 16. RECOMMENDATIONS: `[workspace]/recommendations/page.tsx`

### Header
- Title: "Recommendations"
- **Generate New Button** (RefreshCw icon, animated spin)
  - Calls `generateRecommendations.mutateAsync()`
  - POST `/api/recommendations/generate`

### Weekly Digest Section (if topThree.length > 0)
- Trophy icon
- "Weekly Digest" + "Top X recommendation(s)"
- Delegates to `<RecommendationCard recommendation={rec} onRate={handleRate} />`

### All Recommendations Section
- List of all recommendations
- Same RecommendationCard component

**Empty State:**
- Sparkles icon
- "No recommendations yet"
- "Generate your first batch to get started"

**API Calls:**
- `useRecommendations(workspace, { limit: 50 })` → GET `/api/recommendations`
- `useGenerateRecommendations(workspace)` → POST `/api/recommendations/generate`
- `useRateRecommendation(workspace)` → POST `/api/recommendations/{id}/rate`

---

## Summary of API Endpoints Used

### GET Endpoints
- `/api/workspace/{workspace}` - workspace metadata
- `/api/workspace/{workspace}/scan` - check last scan time
- `/api/content` - content list
- `/api/content/streak` - current streak
- `/api/automation/triggers` - triggers list
- `/api/sessions` - sessions list (paginated, filterable)
- `/api/sessions/{sessionId}` - session detail
- `/api/insights` - insights list (filterable)
- `/api/insights/{insightId}` - insight detail
- `/api/series` - series list
- `/api/series/{seriesId}` - series detail
- `/api/collections` - collections list
- `/api/collections/{collectionId}` - collection detail
- `/api/schedule/posts` - scheduled posts + recent activity
- `/api/analytics/social` - analytics data
- `/api/automation/runs` - automation run history
- `/api/recommendations` - recommendations list

### POST Endpoints
- `/api/workspace/{workspace}/scan` - trigger scan (full/incremental)
- `/api/content/suggest-arcs` - suggest narrative arcs
- `/api/agents/evidence` - generate evidence-based content (streaming)
- `/api/content/export` - export content as zip
- `/api/sessions/upload` - upload session files
- `/api/batch/extract-insights` - batch extract insights from sessions
- `/api/batch/generate-content` - batch generate formats from insights
- `/api/sessions/{sessionId}/extract-insights` - extract from single session (streaming)
- `/api/series` - create series
- `/api/collections` - create collection
- `/api/automation/triggers` - create automation trigger
- `/api/automation/execute` - execute trigger immediately
- `/api/recommendations/generate` - generate recommendations
- `/api/recommendations/{id}/rate` - rate a recommendation

### PUT Endpoints
- `/api/series/{seriesId}` - update series metadata
- `/api/series/{seriesId}/reorder` - reorder posts in series
- `/api/collections/{collectionId}` - update collection metadata
- `/api/collections/{collectionId}/reorder` - reorder posts in collection
- `/api/automation/triggers/{id}` - toggle trigger enabled/disabled

### DELETE Endpoints
- `/api/series/{id}` - delete series
- `/api/collections/{id}` - delete collection
- `/api/series/{seriesId}/posts/{postId}` - remove post from series
- `/api/collections/{collectionId}/posts/{postId}` - remove post from collection
- `/api/automation/triggers/{id}` - delete automation trigger

---

## Key Interaction Patterns

### Multi-Select Pattern
Used in: Sessions, Insights
- Checkbox per item with shift-click range support
- Toolbar shows "X of Y selected"
- Batch operation button (Extract Insights / Generate Content)
- Clears selection after operation

### Modal Pattern
Used for: Creating Series, Collections
- Fixed overlay (black/50)
- Auto-generate slug from title
- Title required, others optional
- Confirmation on delete

### Draggable Reorder
Used in: Series detail, Collection detail
- Drag handle indicator
- Visual feedback: opacity-50 while dragging
- onDragStart/onDragOver/onDragEnd handlers
- Position number badges

### Filter Panel
Used in: Sessions, Insights
- Collapsible panel with badge showing active count
- Clear All button when filters active
- Date ranges, text search, select dropdowns, sliders
- Offset reset on filter change

### Pagination
Used in: Sessions list
- Prev/Next buttons
- Offset-based (limit = 20 items)
- Prev disabled at offset 0

### Streaming Events
Used in: New Content, Extract Insights
- Server-sent events (SSE)
- Event types: status, text, tool_use, tool_result, complete, error
- Real-time UI updates

### Status Badges
- Colored by status (success/green, pending/yellow, error/red, info/blue)
- Animated pulse for active states
- Icon + label combinations

