# E2E Testing for Content Scheduling & Publishing

This directory contains end-to-end tests for the content scheduling and publishing feature.

## Overview

The E2E test verifies the complete scheduling workflow:
1. Create draft post via API
2. Schedule post for future time
3. Verify post status changes to 'scheduled'
4. Verify QStash schedule created
5. Wait for scheduled time (or simulate webhook)
6. Verify post published to Dev.to
7. Verify post status updated to 'published'
8. Verify scheduledPublications record created

## Prerequisites

### Required
- Running SessionForge instance (localhost:3000 or deployed)
- Valid session token (authenticated user)
- A workspace with slug matching `WORKSPACE_SLUG`
- `jq` command-line JSON processor
- Dev.to integration configured and enabled

### Optional
- `psql` for database verification
- QStash keys for webhook signature verification (production testing)

## Setup

### 1. Install Dependencies

```bash
# macOS
brew install jq
brew install postgresql  # Optional, for database verification
```

### 2. Get Session Token

Login to your SessionForge instance, then extract the session token from your browser:

**Chrome/Firefox DevTools:**
1. Open Developer Tools (F12)
2. Go to Application → Cookies
3. Find `better-auth.session_token`
4. Copy the value

**Alternative - Using curl:**
```bash
# Login via API (if you have username/password auth)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com","password":"your-password"}'
```

### 3. Set Environment Variables

```bash
export SESSION_TOKEN="your-session-token-here"
export WORKSPACE_SLUG="test-workspace"  # Your workspace slug
export API_BASE_URL="http://localhost:3000"  # Optional, defaults to localhost:3000
```

For production QStash verification:
```bash
export QSTASH_CURRENT_SIGNING_KEY="your-qstash-key"
export QSTASH_NEXT_SIGNING_KEY="your-qstash-next-key"
```

## Running the Test

### Automated E2E Test

```bash
# Make script executable
chmod +x tests/e2e-scheduling.sh

# Run the test
./tests/e2e-scheduling.sh
```

The script will guide you through two testing modes:
1. **Wait mode**: Schedules post for 2 minutes, waits, and verifies automatic execution
2. **Immediate mode**: Simulates QStash webhook immediately for faster testing

### Manual UI Testing

Follow these steps to verify the UI components:

#### 1. Create Draft Post via UI
- Navigate to `/{workspace}/content`
- Click "New Post"
- Enter title and content
- Save as draft

#### 2. Schedule Post
- Open the draft post
- Click "Schedule" button
- Set date/time 2 minutes in future
- Select timezone (e.g., America/New_York)
- Select platforms (Dev.to)
- Click "Schedule"

#### 3. Verify Publish Queue
- Navigate to `/{workspace}/schedule`
- Verify post appears in queue
- Verify scheduled time and timezone displayed correctly
- Verify Edit and Cancel buttons are present

#### 4. Verify Calendar View
- Navigate to `/{workspace}/calendar`
- Verify calendar renders current month
- Verify scheduled post appears on correct date (blue/accent color)
- Click on the post, verify navigation to detail view

#### 5. Wait for Scheduled Time
- Wait 2+ minutes
- Check QStash logs for webhook execution

#### 6. Verify Publication
- Navigate to post detail page
- Verify status changed to "published"
- Verify Dev.to link appears
- Navigate to `/{workspace}/calendar`
- Verify post now shows as published (green color)

## Verification Checklist

### API Endpoints
- [ ] POST /api/schedule - Schedule a post
- [ ] GET /api/schedule - List scheduled posts
- [ ] PUT /api/schedule/[id] - Reschedule a post
- [ ] DELETE /api/schedule/[id] - Cancel scheduled post
- [ ] POST /api/schedule/publish - QStash webhook handler

### Database State
- [ ] Post status changes to 'scheduled'
- [ ] Post has scheduledFor timestamp
- [ ] Post has timezone
- [ ] Post has qstashScheduleId
- [ ] scheduledPublications record created with status 'pending'
- [ ] After publish: post status = 'published'
- [ ] After publish: scheduledPublications status = 'published'
- [ ] After publish: devtoPublications record created

### QStash Integration
- [ ] QStash schedule created (check qstashScheduleId)
- [ ] Webhook executes at scheduled time
- [ ] Webhook signature verified
- [ ] Retry logic works on failure

### UI Components
- [ ] ScheduleModal opens and closes
- [ ] Date/time picker works
- [ ] Timezone selector has all options
- [ ] Platform selector (Dev.to) works
- [ ] PublishQueue shows all scheduled posts
- [ ] Posts ordered chronologically
- [ ] Edit button opens ScheduleModal with current values
- [ ] Cancel button removes from queue
- [ ] CalendarView renders current month
- [ ] Scheduled posts appear on correct dates
- [ ] Published posts appear on correct dates
- [ ] Month navigation works

### Error Handling
- [ ] Cannot schedule past time
- [ ] Cannot schedule already-scheduled post
- [ ] Cannot schedule without platform selected
- [ ] QStash webhook rejects invalid signatures
- [ ] Publishing errors recorded in scheduledPublications.error
- [ ] User sees error messages on failures

## Troubleshooting

### "Unauthorized" Error
- Verify SESSION_TOKEN is set correctly
- Token may have expired - login again and get a fresh token

### "Workspace not found" Error
- Verify WORKSPACE_SLUG matches your workspace
- Ensure you're the owner of the workspace

### QStash Webhook 401 Unauthorized
- This is expected in local testing without real QStash keys
- To test with real QStash, set QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY
- Or wait for the scheduled time to let real QStash execute the webhook

### Post Not Publishing
- Verify Dev.to integration is enabled
- Check Dev.to API key is valid
- Check QStash dashboard for job execution logs
- Check database scheduledPublications.error for error messages

### Database Verification
To manually verify database state:

```bash
# Connect to your database
psql $DATABASE_URL

# Check post status
SELECT id, title, status, scheduled_for, timezone, qstash_schedule_id
FROM posts
WHERE id = 'your-post-id';

# Check scheduled publication
SELECT id, post_id, platforms, scheduled_for, status, published_at, error
FROM scheduled_publications
WHERE post_id = 'your-post-id';

# Check Dev.to publication
SELECT id, post_id, devto_article_id, devto_url, synced_at
FROM devto_publications
WHERE post_id = 'your-post-id';
```

## Next Steps

After verifying the E2E test passes:

1. **Test Rescheduling Flow** (subtask-6-2)
   - Schedule a post
   - Use Edit to reschedule
   - Verify old QStash schedule deleted
   - Verify new schedule created
   - Cancel the post
   - Verify reverted to draft

2. **Test Error Handling** (subtask-6-3)
   - Disable Dev.to integration
   - Schedule a post
   - Wait for execution
   - Verify error captured
   - Re-enable integration
   - Verify retry succeeds

3. **Performance Testing**
   - Schedule multiple posts
   - Verify queue performance
   - Verify calendar performance with many posts

4. **Multi-Platform Testing** (when other platforms added)
   - Schedule to multiple platforms
   - Verify all platforms publish correctly
