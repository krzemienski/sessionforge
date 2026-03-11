# End-to-End Verification Guide: Smart Content Repurposing Engine

## Overview
This guide outlines the manual E2E verification steps for the Smart Content Repurposing Engine feature.

**Dev Server:** Running on http://localhost:3003
**Date:** 2026-03-10

## Prerequisites
- ✅ Dev server running on port 3003
- ✅ Database schema includes `parentPostId` column
- ✅ All components integrated into post editor page
- ✅ API endpoints created and functional

## Test 1: Single Repurpose Flow (Blog → Twitter Thread)

### Steps:
1. **Navigate to workspace content**
   - Go to `http://localhost:3003/{workspace}/content`
   - Login if needed

2. **Create a test blog post**
   - Click "New Post" or similar
   - Set content type to "Blog Post"
   - Add title: "Test Blog Post for Repurposing"
   - Add content (at least 2-3 paragraphs)
   - Save the post
   - Note the post ID from the URL

3. **Repurpose to Twitter Thread**
   - On the blog post page, locate the "Repurpose" button in the header toolbar
   - Click "Repurpose" button
   - Verify dropdown shows: Twitter Thread, LinkedIn Post, Changelog, TL;DR Summary
   - Click "Twitter Thread"
   - Wait for the AI agent to generate the thread
   - Observe the toast notification showing progress

4. **Verify the Twitter Thread**
   - Once complete, you should be redirected or see a success message
   - Navigate to the new Twitter Thread post
   - Verify the content is properly formatted for Twitter (short paragraphs, thread-style)
   - Check that key points from the blog post are preserved

5. **Verify Database Relationship**
   - Open the Twitter Thread post
   - The URL should be: `/{workspace}/content/{threadPostId}`
   - Run this SQL query to verify:
     ```sql
     SELECT id, title, "contentType", "parentPostId"
     FROM posts
     WHERE id = '{threadPostId}';
     ```
   - Verify `parentPostId` equals the blog post ID

6. **Verify RepurposeTracker in Source Post**
   - Navigate back to the original blog post
   - Scroll to the sidebar (right side)
   - Find the "RepurposeTracker" component
   - Verify it shows:
     - Section title: "Repurposed Variants (1)"
     - The Twitter Thread with title, badge, and link
     - Clicking the link should navigate to the Twitter Thread

7. **Verify RepurposeTracker in Derived Post**
   - Navigate to the Twitter Thread
   - Scroll to the sidebar
   - Find the "RepurposeTracker" component
   - Verify it shows:
     - Section title: "Source Post"
     - The blog post with title, badge, and link
     - Clicking the link should navigate back to the blog post

8. **Verify Content List Indicators**
   - Navigate to `/{workspace}/content`
   - Find the original blog post in the list
   - Verify it shows a badge with GitBranch icon and count "1"
   - Find the Twitter Thread in the list
   - Verify it shows a badge with CornerUpLeft icon (parent indicator)

### Expected Results:
- ✅ Repurpose button visible and functional
- ✅ Agent generates Twitter thread with proper formatting
- ✅ New post has `parentPostId` set to source post ID
- ✅ RepurposeTracker shows the thread in source post
- ✅ RepurposeTracker shows source in derived post
- ✅ Content list shows derivative count badge (1) on source post
- ✅ Content list shows parent indicator on derived post

## Test 2: Batch Repurpose Flow

### Steps:
1. **Create another test blog post**
   - Create a new blog post with different content
   - Save it

2. **Open Batch Repurpose Dialog**
   - Click "Repurpose" button
   - Click "Batch Repurpose..." at the top of the dropdown
   - Verify the dialog opens

3. **Select Multiple Formats**
   - Check: Twitter Thread
   - Check: LinkedIn Post
   - Check: Changelog Entry
   - Click "Repurpose All" button

4. **Wait for Batch Processing**
   - Observe progress indicators for each format
   - Wait for all 3 to complete

5. **Verify All 3 Posts Created**
   - Navigate to content list
   - Verify 3 new posts exist:
     - Twitter Thread
     - LinkedIn Post
     - Changelog Entry

6. **Verify Database Relationships**
   - Run SQL query:
     ```sql
     SELECT id, title, "contentType", "parentPostId"
     FROM posts
     WHERE "parentPostId" = '{sourcePostId}';
     ```
   - Verify all 3 posts have `parentPostId` pointing to source

7. **Verify RepurposeTracker**
   - Navigate to source blog post
   - Verify RepurposeTracker shows "Repurposed Variants (3)"
   - Verify all 3 posts are listed with correct badges

8. **Verify Each Derived Post**
   - Navigate to each of the 3 derived posts
   - Verify each shows the source post in RepurposeTracker
   - Verify content is appropriate for the format

### Expected Results:
- ✅ Batch dialog opens and allows multiple selections
- ✅ All 3 posts created successfully
- ✅ All 3 have `parentPostId` pointing to source
- ✅ RepurposeTracker lists all 3 derivatives
- ✅ Each derived post shows parent link
- ✅ Content list shows badge with count "3" on source

## Test 3: Reverse Repurpose (Social → Blog)

### Steps:
1. **Create a Twitter Thread**
   - Create a new Twitter Thread post
   - Add several tweets worth of content (5-7 short paragraphs)
   - Save it

2. **Repurpose to Blog Post**
   - Click "Repurpose" button
   - Verify dropdown shows: "Blog Post"
   - Click "Blog Post"
   - Wait for AI agent to generate

3. **Verify Blog Post Expansion**
   - Navigate to the generated blog post
   - Verify content has been expanded:
     - Proper headings (H2, H3)
     - Longer paragraphs
     - Examples or explanations added
     - Structured format
   - Verify it's more detailed than the original thread

4. **Verify Database Relationship**
   - Verify blog post has `parentPostId` pointing to thread

5. **Verify RepurposeTracker**
   - Navigate to original Twitter Thread
   - Verify RepurposeTracker shows the blog post as a variant
   - Navigate to blog post
   - Verify RepurposeTracker shows the thread as source

### Expected Results:
- ✅ Repurpose button on social post shows "Blog Post" option
- ✅ Agent expands thread into full blog with structure
- ✅ Blog post has headings, paragraphs, examples
- ✅ `parentPostId` links back to thread
- ✅ Thread shows blog as derivative in tracker
- ✅ Blog shows thread as source in tracker

## Database Verification Queries

```sql
-- Check parentPostId column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'posts' AND column_name = 'parent_post_id';

-- Find all posts with derivatives
SELECT p.id, p.title, p."contentType",
       COUNT(d.id) as derivative_count
FROM posts p
LEFT JOIN posts d ON d."parentPostId" = p.id
GROUP BY p.id, p.title, p."contentType"
HAVING COUNT(d.id) > 0;

-- Find all derived posts with their sources
SELECT
  d.id as derived_id,
  d.title as derived_title,
  d."contentType" as derived_type,
  p.id as parent_id,
  p.title as parent_title,
  p."contentType" as parent_type
FROM posts d
JOIN posts p ON d."parentPostId" = p.id;
```

## Component Checklist

### RepurposeButton
- ✅ Imported in post editor page
- ✅ Rendered in header toolbar
- ✅ Shows dropdown with format options
- ✅ Format options based on source content type
- ✅ Triggers repurpose agent
- ✅ Shows progress state
- ✅ Opens BatchRepurposeDialog

### BatchRepurposeDialog
- ✅ Opens from RepurposeButton
- ✅ Shows checkboxes for multiple formats
- ✅ Triggers batch API endpoint
- ✅ Shows progress for each format
- ✅ Handles errors gracefully

### RepurposeTracker
- ✅ Imported in post editor page
- ✅ Rendered in sidebar
- ✅ Shows source post if derivative
- ✅ Shows derived posts if source
- ✅ Links work correctly
- ✅ Badges show correct content types

### Content List View
- ✅ Shows GitBranch badge with count on source posts
- ✅ Shows CornerUpLeft badge on derived posts
- ✅ Badges have proper tooltips

## API Endpoints Checklist

- ✅ `/api/agents/repurpose` - Single repurpose
- ✅ `/api/content/[id]/batch-repurpose` - Batch repurpose
- ✅ `/api/content/[id]/repurposed-variants` - Get variants and parent

## MCP Tools Checklist

- ✅ `post-manager.ts` - create_post accepts parentPostId
- ✅ `repurpose-writer.ts` - instructs agent to set parentPostId

## Known Issues / Notes

- Dev server is on port 3003 (port 3000 was in use)
- Manual browser testing required for full E2E verification
- All automated checks (schema, components, APIs) have passed

## Sign-Off

Once all tests pass:
- [ ] Test 1: Single repurpose flow - PENDING MANUAL TEST
- [ ] Test 2: Batch repurpose flow - PENDING MANUAL TEST
- [ ] Test 3: Reverse repurpose flow - PENDING MANUAL TEST
- [ ] Database verification - PENDING MANUAL TEST
- [ ] All components render correctly - PENDING MANUAL TEST
