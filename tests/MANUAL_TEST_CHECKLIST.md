# Manual E2E Test Checklist

## Content Scheduling & Publishing - End-to-End Verification

**Test Date:** _______________
**Tester:** _______________
**Environment:** _______________

---

## Prerequisites

- [ ] SessionForge running locally or on staging
- [ ] Logged in as workspace owner
- [ ] Dev.to integration configured and enabled
- [ ] QStash configured with valid credentials

---

## Test 1: Schedule Post → QStash Job Executes → Post Published

### Step 1: Create Draft Post via UI

- [ ] Navigate to `/{workspace}/content`
- [ ] Click "New Post" or existing draft
- [ ] Verify post has content (title + markdown)
- [ ] Verify post status is "draft"
- [ ] **Record Post ID:** _______________

### Step 2: Click Schedule, Set Time 2 Minutes in Future

- [ ] Click "Schedule" button on post detail page
- [ ] ScheduleModal opens successfully
- [ ] Select date: **Today**
- [ ] Select time: **Current time + 2 minutes**
- [ ] Select timezone: **America/New_York** (or your timezone)
- [ ] Select platforms: **Dev.to** (checked)
- [ ] Click "Schedule" button
- [ ] Modal closes
- [ ] Success message appears

### Step 3: Verify Post Status Changes to 'scheduled' in Database

**Using UI:**
- [ ] Post detail page shows status badge: "Scheduled"
- [ ] Scheduled time badge visible below title
- [ ] Navigate to `/{workspace}/schedule`
- [ ] Post appears in publish queue

**Using Database (optional):**
```sql
SELECT id, title, status, scheduled_for, timezone, qstash_schedule_id
FROM posts
WHERE id = 'POST_ID_FROM_STEP_1';
```

- [ ] Status is 'scheduled'
- [ ] scheduled_for matches selected time
- [ ] timezone is 'America/New_York'
- [ ] qstash_schedule_id is not null

### Step 4: Verify QStash Schedule Created

**Using UI:**
- [ ] Post in queue shows qstashScheduleId (visible in browser DevTools or response)

**Using QStash Dashboard:**
- [ ] Login to Upstash QStash dashboard
- [ ] Navigate to Messages or Schedules
- [ ] Find schedule with matching ID
- [ ] Verify webhook URL: `{your-domain}/api/schedule/publish`
- [ ] Verify payload contains postId

**Using API:**
```bash
curl "http://localhost:3000/api/schedule?workspace=test-workspace" \
  -H "Cookie: better-auth.session_token=YOUR_TOKEN" | jq
```

- [ ] Response includes post with qstashScheduleId
- [ ] **Record QStash ID:** _______________

### Step 5: Wait for Scheduled Time

- [ ] Note current time: _______________
- [ ] Note scheduled time: _______________
- [ ] Wait at least 2 minutes + 30 seconds buffer
- [ ] **Actual wait time:** _______________ minutes

### Step 6: Verify QStash Webhook Called /api/schedule/publish

**Check Server Logs:**
- [ ] View application logs
- [ ] Search for "POST /api/schedule/publish"
- [ ] Verify request received at scheduled time
- [ ] Verify QStash signature verified (no 401 error)
- [ ] **Log timestamp:** _______________

**Check QStash Dashboard:**
- [ ] View message/schedule details
- [ ] Status shows "delivered" or "completed"
- [ ] No retry attempts (or successful retry)

### Step 7: Verify Post Published to Dev.to

**Using UI:**
- [ ] Navigate to post detail page
- [ ] Post status is now "Published"
- [ ] Dev.to link visible and clickable
- [ ] Click Dev.to link
- [ ] Opens Dev.to article in new tab
- [ ] Article content matches post

**Using Dev.to Dashboard:**
- [ ] Login to Dev.to
- [ ] Navigate to your dashboard
- [ ] Find the published article
- [ ] Verify title matches
- [ ] Verify content matches
- [ ] Article is published (not draft)

### Step 8: Verify Post Status Updated to 'published'

**Using UI:**
- [ ] Post detail page shows "Published" status badge
- [ ] No longer shows in `/{workspace}/schedule` queue
- [ ] Navigate to `/{workspace}/content`
- [ ] Filter by status: Published
- [ ] Post appears in published list

**Using Database:**
```sql
SELECT id, title, status, published_at, updated_at
FROM posts
WHERE id = 'POST_ID_FROM_STEP_1';
```

- [ ] Status is 'published'
- [ ] published_at timestamp is set (might be null, that's okay)
- [ ] updated_at is recent

### Step 9: Verify scheduledPublications Record Created

**Using Database:**
```sql
SELECT id, post_id, platforms, scheduled_for, status, published_at, error, qstash_schedule_id
FROM scheduled_publications
WHERE post_id = 'POST_ID_FROM_STEP_1';
```

- [ ] Record exists
- [ ] post_id matches
- [ ] platforms = '["devto"]'
- [ ] status is 'published'
- [ ] published_at is set and recent
- [ ] error is null
- [ ] qstash_schedule_id matches Step 4

**Using Database:**
```sql
SELECT id, post_id, devto_article_id, devto_url, published_as_draft, synced_at
FROM devto_publications
WHERE post_id = 'POST_ID_FROM_STEP_1';
```

- [ ] Record exists
- [ ] devto_article_id is set
- [ ] devto_url is valid
- [ ] published_as_draft is false
- [ ] synced_at is recent

---

## Test 2: Calendar View Verification

### Step 10: Verify Calendar Shows Published Post

- [ ] Navigate to `/{workspace}/calendar`
- [ ] Calendar renders current month
- [ ] Month navigation buttons work (prev/next/today)
- [ ] Published post appears on correct date
- [ ] Post shows with green/success color indicator
- [ ] Click on post
- [ ] Navigates to post detail page

---

## Test Results

### Overall Status

- [ ] **PASS** - All steps completed successfully
- [ ] **FAIL** - One or more steps failed (see notes)
- [ ] **PARTIAL** - Some optional steps skipped

### Issues Found

1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

### Notes

_______________________________________________
_______________________________________________
_______________________________________________

### Performance Observations

- Time from schedule to publish: _______________ seconds
- Expected time: ~120 seconds
- QStash latency: _______________ seconds
- UI responsiveness: _______________

---

## Sign-off

**Tester Signature:** _______________
**Date:** _______________

**Approved for Production:**
- [ ] YES - All tests passed
- [ ] NO - Issues must be resolved first
- [ ] CONDITIONAL - Minor issues, can ship with known limitations

**Approver:** _______________
**Date:** _______________
