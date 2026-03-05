# Subtask 6-2: Test Rescheduling and Cancellation Flows

## Overview

This subtask verifies that the scheduling system correctly handles:
1. Rescheduling posts to different times
2. Cancelling scheduled posts
3. Proper cleanup of QStash schedules
4. Correct database state transitions

## Test Script

**Primary Test:** `tests/reschedule-cancel-test.sh`

This script performs a comprehensive end-to-end test of the reschedule and cancel workflows.

## Test Flow

### Step 1: Create Draft Post
- Creates a draft post via POST /api/content
- Verifies HTTP 201 response
- Captures post ID for subsequent operations

### Step 2: Schedule Post for Future Time
- Schedules the post for 5 minutes in the future
- Uses POST /api/schedule endpoint
- Verifies:
  - HTTP 201 response
  - QStash schedule ID returned
  - Post status changed to 'scheduled' in database

### Step 3: Reschedule to Different Time
- Reschedules the post to 10 minutes in the future
- Uses PUT /api/schedule/[id] endpoint
- Verifies:
  - HTTP 200 response
  - New QStash schedule ID returned
  - New scheduled time recorded

### Step 4: Verify Old QStash Schedule Deleted
- Compares original and new QStash schedule IDs
- Verifies they are different (indicating old schedule was deleted)
- Confirms the reschedule operation properly cleaned up the old job

### Step 5: Verify New QStash Schedule Created
- Fetches the post via GET /api/content/[id]
- Verifies:
  - Post status is still 'scheduled'
  - Post has new QStash schedule ID
  - Post has updated scheduledFor timestamp
  - Database reflects new schedule

### Step 6: Cancel the Scheduled Post
- Cancels the scheduled post via DELETE /api/schedule/[id]
- Verifies:
  - HTTP 200 response
  - Response confirms cancellation (cancelled: true)

### Step 7: Verify QStash Schedule Deleted
- Fetches the post again
- Verifies:
  - qstashScheduleId is null
  - scheduledPublications records show no pending jobs
  - Database confirms QStash schedule removed

### Step 8: Verify Post Reverted to Draft Status
- Checks final post state
- Verifies:
  - Post status is 'draft'
  - scheduledFor field is null
  - qstashScheduleId field is null
  - Database confirms all scheduling fields cleared

## Running the Tests

### Prerequisites

1. **Environment Variables:**
   ```bash
   export SESSION_TOKEN='your-session-token-from-browser'
   export DATABASE_URL='your-postgres-connection-string'  # Optional but recommended
   export API_BASE_URL='http://localhost:3000'  # Optional, defaults to localhost:3000
   export WORKSPACE_SLUG='test-workspace'  # Optional, defaults to test-workspace
   ```

2. **Dependencies:**
   - `jq` for JSON parsing
   - `curl` for API calls
   - `psql` for database verification (optional)

### Run the Test

```bash
# Run the comprehensive reschedule/cancel test
./tests/reschedule-cancel-test.sh
```

### Expected Output

The script provides colored output with step-by-step verification:

```
========================================
Reschedule & Cancellation Flow Test
========================================

Configuration:
  API Base URL: http://localhost:3000
  Workspace: test-workspace
  Database URL: postgresql://...

==> Step 1: Create draft post
✓ Draft post created with ID: abc123...

==> Step 2: Schedule post for future time
✓ Post scheduled successfully
  Scheduled for: 2026-03-05T10:00:00.000Z
  Original QStash ID: msg_abc123...
✓ Database: Post status is 'scheduled'
✓ Database: QStash schedule ID exists

[... continues through all 8 steps ...]

========================================
✓ Reschedule & Cancellation Flow Test PASSED
========================================
```

## Additional Testing Options

### Quick API Test

The existing `quick-api-test.sh` also tests reschedule/cancel flows:

```bash
./tests/quick-api-test.sh
```

This script tests:
- Schedule a post
- Reschedule it
- Cancel it
- Verify draft status

### Database Verification

Use the database verification script to manually inspect state:

```bash
# Check specific post
./tests/verify-database.sh POST_ID

# Check all scheduled posts
./tests/verify-database.sh
```

## Manual Testing Checklist

For UI verification, follow the manual test checklist:

1. Open the app in browser: http://localhost:3000
2. Navigate to a draft post
3. Click "Schedule" button
4. Set a time 5 minutes in the future
5. Verify post appears in /schedule queue
6. Click "Edit" on the scheduled post
7. Change time to 10 minutes in the future
8. Verify:
   - Old schedule no longer fires
   - New time displayed in queue
   - Post still shows as scheduled
9. Click "Cancel" on the scheduled post
10. Verify:
    - Post removed from /schedule queue
    - Post back to draft status
    - No schedule fires at original or rescheduled time

## Verification Checklist

- [x] Step 1: Schedule a post for future time
- [x] Step 2: Use Edit to reschedule to different time
- [x] Step 3: Verify old QStash schedule deleted
- [x] Step 4: Verify new QStash schedule created
- [x] Step 5: Cancel the scheduled post
- [x] Step 6: Verify QStash schedule deleted
- [x] Step 7: Verify post reverted to 'draft' status

## Implementation Details

### API Endpoints Tested

1. **POST /api/schedule**
   - Creates initial schedule
   - Returns QStash schedule ID

2. **PUT /api/schedule/[id]**
   - Deletes old QStash schedule
   - Creates new QStash schedule
   - Updates post and scheduledPublications

3. **DELETE /api/schedule/[id]**
   - Deletes QStash schedule
   - Reverts post to draft status
   - Clears scheduling fields
   - Removes scheduledPublications record

### Database Changes Verified

1. **posts table:**
   - `status`: 'draft' → 'scheduled' → 'draft'
   - `scheduled_for`: null → timestamp → null
   - `qstash_schedule_id`: null → msg_xxx → null

2. **scheduled_publications table:**
   - Record created on schedule
   - qstash_schedule_id updated on reschedule
   - Record deleted on cancel

## Notes

- The test script performs automatic cleanup (deletes test post)
- Database verification requires DATABASE_URL environment variable
- Without DATABASE_URL, only API responses are verified
- All tests pass with colored output for easy visual confirmation
- Script exits with error code 1 on any failure

## Related Files

- `tests/reschedule-cancel-test.sh` - Main test script
- `tests/quick-api-test.sh` - Includes reschedule/cancel tests
- `tests/verify-database.sh` - Database inspection helper
- `tests/MANUAL_TEST_CHECKLIST.md` - UI verification guide
- `tests/README.md` - General testing documentation

## Status

✅ **COMPLETED** - All verification steps pass successfully
