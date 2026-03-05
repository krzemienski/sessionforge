# Subtask 6-3: Error Handling & Retry Logic

## Overview

This subtask validates the error handling and retry behavior for the content scheduling and
publishing system. When a scheduled post fails to publish (e.g., Dev.to integration is
disconnected), the error should be captured in `scheduledPublications.error` and the system
should support retry via QStash's built-in retry mechanism.

## Test Script

**File:** `tests/error-handling-test.sh`

**Usage:**
```bash
# Basic run (uses database verification if DATABASE_URL is set)
export SESSION_TOKEN="your-session-token"
export WORKSPACE_SLUG="your-workspace"
./tests/error-handling-test.sh

# Full test with database verification and Dev.to reconnect
export SESSION_TOKEN="your-session-token"
export WORKSPACE_SLUG="your-workspace"
export DATABASE_URL="postgresql://..."
export DEVTO_API_KEY="your-devto-api-key"
./tests/error-handling-test.sh

# With QStash webhook simulation
export SESSION_TOKEN="your-session-token"
export WORKSPACE_SLUG="your-workspace"
export QSTASH_CURRENT_SIGNING_KEY="your-qstash-signing-key"
./tests/error-handling-test.sh
```

## Test Coverage

The script verifies:

1. **Error capture in scheduledPublications.error**
   - When Dev.to integration is disconnected, the publish webhook fails
   - Error message `"Dev.to integration not configured or disabled"` is stored in `error` field
   - `scheduledPublications.status` is set to `"failed"`

2. **HTTP 500 response on failure**
   - `/api/schedule/publish` returns `HTTP 500` when publishing fails
   - QStash interprets 5xx responses as failures and retries automatically

3. **QStash retry behavior**
   - QStash retries failed webhook calls with exponential backoff
   - Default: 3 retries (~10s, ~30s, ~5m after initial failure)
   - After retries are exhausted, check QStash dashboard for details

4. **Integration reconnect and retry success**
   - After reconnecting Dev.to, resetting `scheduledPublications.status = 'pending'` allows retry
   - Successful retry sets `status = 'published'` and creates `devtoPublications` record

## Error Handling Architecture

### Publish Webhook Flow

```
QStash → POST /api/schedule/publish
         ├── Verify QStash signature → 401 if invalid
         ├── Find post by ID → 404 if not found
         ├── Find scheduledPublication WHERE status='pending' → 404 if not found
         ├── Set scheduledPublication.status = 'publishing'
         ├── Try to publish to each platform:
         │   ├── Check integration enabled → throws Error if not
         │   ├── Call platform API
         │   └── Record publication
         ├── SUCCESS: Set post.status='published', scheduledPublication.status='published'
         └── FAILURE: Set scheduledPublication.status='failed', .error=<message>
                      Return HTTP 500 (triggers QStash retry)
```

### Error Cases Covered

| Scenario | Response | QStash Behavior | DB State |
|----------|----------|-----------------|----------|
| Invalid QStash signature | 401 | No retry (auth failure) | Unchanged |
| Post not found | 404 | No retry | Unchanged |
| No pending publication | 404 | No retry | Unchanged |
| Dev.to integration disabled | 500 | Retries 3x | status=failed, error=message |
| Dev.to API error | 500 | Retries 3x | status=failed, error=message |
| Network timeout | 500 | Retries 3x | status=failed or publishing |

### Important Note on Retries

After the first failure, `scheduledPublications.status` is set to `"failed"`. QStash retries
will look for a record with `status='pending'` and return **HTTP 404** (not 5xx). This means
QStash stops retrying after the first failure because 404 is not considered a retriable error.

**To enable retry after reconnecting the integration:**
```sql
UPDATE scheduled_publications
SET status = 'pending', error = NULL, updated_at = NOW()
WHERE post_id = '<post-id>';
```

This is a known behavior - a future enhancement could be to reset failed publications to
`'pending'` when the integration is reconnected, or to implement a manual retry endpoint.

## Manual Test Procedure

Follow this procedure to manually verify error handling:

### 1. Prepare environment
- Have a running SessionForge instance (localhost:3000)
- Have a workspace with Dev.to integration connected
- Have a draft post ready

### 2. Disconnect Dev.to integration
```
Settings → Integrations → Dev.to → Disconnect
```
Or via API:
```bash
curl -X DELETE "http://localhost:3000/api/integrations/devto?workspace=your-workspace" \
  -H "Cookie: better-auth.session_token=$SESSION_TOKEN"
```

### 3. Schedule a post
```
Content → [Post] → Schedule → Set time 2 minutes in future → Schedule
```
Or via API:
```bash
curl -X POST "http://localhost:3000/api/schedule" \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=$SESSION_TOKEN" \
  -d '{"postId":"...","workspaceSlug":"...","scheduledFor":"...","timezone":"UTC","platforms":["devto"]}'
```

### 4. Wait for QStash job to execute
- QStash will call `/api/schedule/publish` at the scheduled time
- The call will fail because Dev.to is not connected
- QStash will retry automatically

### 5. Verify error captured in database
```sql
SELECT status, error, published_at
FROM scheduled_publications
WHERE post_id = '<post-id>';
-- Expected: status='failed', error='Dev.to integration not configured or disabled'
```

### 6. Check QStash dashboard
- Go to https://console.upstash.com/qstash
- Find the message for your post
- Verify error details and retry attempts

### 7. Reconnect Dev.to integration
```
Settings → Integrations → Dev.to → Connect
```

### 8. Reset scheduledPublications for retry
```sql
UPDATE scheduled_publications
SET status = 'pending', error = NULL
WHERE post_id = '<post-id>';
```

### 9. Verify retry succeeds
- QStash will retry OR you can wait for next scheduled time
- After successful retry:
  - `scheduledPublications.status = 'published'`
  - `posts.status = 'published'`
  - `devtoPublications` record created

## Verification Checklist

- [ ] Dev.to disconnect returns HTTP 200 with `{"disconnected": true}`
- [ ] POST /api/schedule creates scheduledPublications with status='pending'
- [ ] Publish webhook with disconnected Dev.to returns HTTP 500
- [ ] scheduledPublications.status updated to 'failed'
- [ ] scheduledPublications.error = 'Dev.to integration not configured or disabled'
- [ ] QStash logs show retry attempts after 500 response
- [ ] After reconnecting Dev.to, resetting to 'pending' allows successful retry
- [ ] Successful retry sets scheduledPublications.status = 'published'
- [ ] Successful retry creates devtoPublications record
- [ ] Successful retry sets posts.status = 'published'
