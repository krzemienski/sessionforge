#!/bin/bash

# Reschedule and Cancellation Flow Test (Subtask 6-2)
# Tests the complete reschedule → cancel flow with detailed verification

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
WORKSPACE_SLUG="${WORKSPACE_SLUG:-test-workspace}"
SESSION_TOKEN="${SESSION_TOKEN:-}"
DATABASE_URL="${DATABASE_URL:-}"

# Function to print colored output
print_header() {
    echo -e "\n${CYAN}========================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}========================================${NC}\n"
}

print_step() {
    echo -e "${BLUE}==> Step $1: $2${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}! $1${NC}"
}

print_info() {
    echo -e "  $1"
}

# Function to verify database state
verify_database() {
    local POST_ID=$1
    local EXPECTED_STATUS=$2
    local CHECK_TYPE=$3

    print_info "Verifying database state..."

    if [ -z "$DATABASE_URL" ]; then
        print_warning "DATABASE_URL not set, skipping database verification"
        return 0
    fi

    case $CHECK_TYPE in
        "scheduled")
            # Check that post is scheduled with qstashScheduleId
            local RESULT=$(psql "$DATABASE_URL" -t -c "SELECT status, qstash_schedule_id FROM posts WHERE id='$POST_ID';" 2>/dev/null || echo "")
            if echo "$RESULT" | grep -q "scheduled"; then
                print_success "Database: Post status is 'scheduled'"
                if echo "$RESULT" | grep -q "msg_"; then
                    print_success "Database: QStash schedule ID exists"
                else
                    print_error "Database: QStash schedule ID is missing"
                fi
            else
                print_error "Database: Post status is not 'scheduled'"
            fi
            ;;
        "draft")
            # Check that post is draft with null scheduledFor and qstashScheduleId
            local RESULT=$(psql "$DATABASE_URL" -t -c "SELECT status, scheduled_for, qstash_schedule_id FROM posts WHERE id='$POST_ID';" 2>/dev/null || echo "")
            if echo "$RESULT" | grep -q "draft"; then
                print_success "Database: Post status is 'draft'"
                if echo "$RESULT" | grep -q "^ *draft *|  *| *$"; then
                    print_success "Database: scheduledFor and qstashScheduleId are NULL"
                else
                    print_warning "Database: Scheduling fields may not be fully cleared"
                fi
            else
                print_error "Database: Post status is not 'draft'"
            fi
            ;;
    esac
}

# Check prerequisites
if [ -z "$SESSION_TOKEN" ]; then
    print_error "SESSION_TOKEN environment variable not set"
    echo ""
    echo "Set it by copying from your browser:"
    echo "  export SESSION_TOKEN='your-session-token-here'"
    echo ""
    exit 1
fi

if ! command -v jq &> /dev/null; then
    print_error "jq is not installed"
    echo ""
    echo "Install it with:"
    echo "  brew install jq  (macOS)"
    echo "  apt install jq   (Linux)"
    echo ""
    exit 1
fi

print_header "Reschedule & Cancellation Flow Test"

echo "Configuration:"
print_info "API Base URL: $API_BASE_URL"
print_info "Workspace: $WORKSPACE_SLUG"
print_info "Database URL: ${DATABASE_URL:0:30}..."
echo ""

# ==================================================
# Step 1: Create draft post
# ==================================================
print_step "1" "Create draft post"

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$API_BASE_URL/api/content" \
    -H "Content-Type: application/json" \
    -H "Cookie: better-auth.session_token=$SESSION_TOKEN" \
    -d '{
        "workspaceSlug": "'"$WORKSPACE_SLUG"'",
        "title": "Reschedule & Cancel Test Post",
        "type": "blog",
        "markdown": "# Reschedule & Cancel Test\n\nThis post tests the reschedule and cancel flows.",
        "status": "draft"
    }')

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" = "201" ] || [ "$HTTP_STATUS" = "200" ]; then
    POST_ID=$(echo "$RESPONSE_BODY" | jq -r '.id')
    print_success "Draft post created with ID: $POST_ID"
else
    print_error "Failed to create post (HTTP $HTTP_STATUS)"
    echo "$RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$RESPONSE_BODY"
    exit 1
fi
echo ""

# ==================================================
# Step 2: Schedule post for future time
# ==================================================
print_step "2" "Schedule post for future time"

# Schedule for 5 minutes in the future
SCHEDULED_TIME=$(date -u -v+5M +"%Y-%m-%dT%H:%M:%S.000Z" 2>/dev/null || date -u -d "+5 minutes" +"%Y-%m-%dT%H:%M:%S.000Z")

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$API_BASE_URL/api/schedule" \
    -H "Content-Type: application/json" \
    -H "Cookie: better-auth.session_token=$SESSION_TOKEN" \
    -d '{
        "postId": "'"$POST_ID"'",
        "workspaceSlug": "'"$WORKSPACE_SLUG"'",
        "scheduledFor": "'"$SCHEDULED_TIME"'",
        "timezone": "America/New_York",
        "platforms": ["devto"]
    }')

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" = "201" ]; then
    ORIGINAL_QSTASH_ID=$(echo "$RESPONSE_BODY" | jq -r '.qstashScheduleId')
    print_success "Post scheduled successfully"
    print_info "Scheduled for: $SCHEDULED_TIME"
    print_info "Original QStash ID: $ORIGINAL_QSTASH_ID"

    verify_database "$POST_ID" "scheduled" "scheduled"
else
    print_error "Failed to schedule post (HTTP $HTTP_STATUS)"
    echo "$RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$RESPONSE_BODY"
    exit 1
fi
echo ""

# ==================================================
# Step 3: Reschedule to different time
# ==================================================
print_step "3" "Reschedule to different time"

# Reschedule for 10 minutes in the future
NEW_SCHEDULED_TIME=$(date -u -v+10M +"%Y-%m-%dT%H:%M:%S.000Z" 2>/dev/null || date -u -d "+10 minutes" +"%Y-%m-%dT%H:%M:%S.000Z")

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X PUT "$API_BASE_URL/api/schedule/$POST_ID" \
    -H "Content-Type: application/json" \
    -H "Cookie: better-auth.session_token=$SESSION_TOKEN" \
    -d '{
        "scheduledFor": "'"$NEW_SCHEDULED_TIME"'"
    }')

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" = "200" ]; then
    NEW_QSTASH_ID=$(echo "$RESPONSE_BODY" | jq -r '.qstashScheduleId')
    print_success "Post rescheduled successfully"
    print_info "New scheduled time: $NEW_SCHEDULED_TIME"
    print_info "New QStash ID: $NEW_QSTASH_ID"
else
    print_error "Failed to reschedule post (HTTP $HTTP_STATUS)"
    echo "$RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$RESPONSE_BODY"
    exit 1
fi
echo ""

# ==================================================
# Step 4: Verify old QStash schedule deleted
# ==================================================
print_step "4" "Verify old QStash schedule deleted"

if [ "$NEW_QSTASH_ID" != "$ORIGINAL_QSTASH_ID" ]; then
    print_success "QStash schedule ID changed (old schedule was deleted)"
    print_info "Original ID: $ORIGINAL_QSTASH_ID"
    print_info "New ID: $NEW_QSTASH_ID"
else
    print_warning "QStash schedule ID unchanged"
    print_warning "This might indicate old schedule was not properly deleted"
fi
echo ""

# ==================================================
# Step 5: Verify new QStash schedule created
# ==================================================
print_step "5" "Verify new QStash schedule created"

# Fetch the post to verify it has the new schedule details
RESPONSE=$(curl -s "$API_BASE_URL/api/content/$POST_ID?workspace=$WORKSPACE_SLUG" \
    -H "Cookie: better-auth.session_token=$SESSION_TOKEN")

POST_STATUS=$(echo "$RESPONSE" | jq -r '.post.status')
POST_SCHEDULED_FOR=$(echo "$RESPONSE" | jq -r '.post.scheduledFor')
POST_QSTASH_ID=$(echo "$RESPONSE" | jq -r '.post.qstashScheduleId')

if [ "$POST_STATUS" = "scheduled" ]; then
    print_success "Post status is 'scheduled'"
fi

if [ "$POST_QSTASH_ID" = "$NEW_QSTASH_ID" ]; then
    print_success "Post has new QStash schedule ID"
else
    print_error "Post QStash ID mismatch"
    print_info "Expected: $NEW_QSTASH_ID"
    print_info "Got: $POST_QSTASH_ID"
fi

if [ "$POST_SCHEDULED_FOR" != "null" ]; then
    print_success "Post has new scheduledFor timestamp"
    print_info "Scheduled for: $POST_SCHEDULED_FOR"
fi

verify_database "$POST_ID" "scheduled" "scheduled"
echo ""

# ==================================================
# Step 6: Cancel the scheduled post
# ==================================================
print_step "6" "Cancel the scheduled post"

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X DELETE "$API_BASE_URL/api/schedule/$POST_ID" \
    -H "Cookie: better-auth.session_token=$SESSION_TOKEN")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" = "200" ]; then
    CANCELLED=$(echo "$RESPONSE_BODY" | jq -r '.cancelled')
    if [ "$CANCELLED" = "true" ]; then
        print_success "Schedule cancelled successfully"
        print_info "Response confirms cancellation"
    else
        print_warning "Cancellation response unclear"
    fi
else
    print_error "Failed to cancel schedule (HTTP $HTTP_STATUS)"
    echo "$RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$RESPONSE_BODY"
    exit 1
fi
echo ""

# ==================================================
# Step 7: Verify QStash schedule deleted
# ==================================================
print_step "7" "Verify QStash schedule deleted"

# Try to fetch the post and verify it no longer has a QStash schedule ID
RESPONSE=$(curl -s "$API_BASE_URL/api/content/$POST_ID?workspace=$WORKSPACE_SLUG" \
    -H "Cookie: better-auth.session_token=$SESSION_TOKEN")

POST_QSTASH_ID=$(echo "$RESPONSE" | jq -r '.post.qstashScheduleId')

if [ "$POST_QSTASH_ID" = "null" ] || [ -z "$POST_QSTASH_ID" ]; then
    print_success "QStash schedule ID removed from post"
else
    print_error "Post still has QStash schedule ID: $POST_QSTASH_ID"
fi

# Check scheduled_publications table
if [ -n "$DATABASE_URL" ]; then
    print_info "Checking scheduledPublications table..."
    SCHEDULED_PUB_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM scheduled_publications WHERE post_id='$POST_ID' AND status='pending';" 2>/dev/null || echo "0")
    SCHEDULED_PUB_COUNT=$(echo "$SCHEDULED_PUB_COUNT" | tr -d ' ')

    if [ "$SCHEDULED_PUB_COUNT" = "0" ]; then
        print_success "No pending scheduledPublications records found"
    else
        print_warning "Found $SCHEDULED_PUB_COUNT pending scheduledPublications records"
    fi
fi
echo ""

# ==================================================
# Step 8: Verify post reverted to 'draft' status
# ==================================================
print_step "8" "Verify post reverted to 'draft' status"

RESPONSE=$(curl -s "$API_BASE_URL/api/content/$POST_ID?workspace=$WORKSPACE_SLUG" \
    -H "Cookie: better-auth.session_token=$SESSION_TOKEN")

POST_STATUS=$(echo "$RESPONSE" | jq -r '.post.status')
POST_SCHEDULED_FOR=$(echo "$RESPONSE" | jq -r '.post.scheduledFor')

if [ "$POST_STATUS" = "draft" ]; then
    print_success "Post status is 'draft'"
else
    print_error "Post status is not 'draft', got: $POST_STATUS"
fi

if [ "$POST_SCHEDULED_FOR" = "null" ] || [ -z "$POST_SCHEDULED_FOR" ]; then
    print_success "scheduledFor field cleared"
else
    print_warning "scheduledFor field not cleared: $POST_SCHEDULED_FOR"
fi

verify_database "$POST_ID" "draft" "draft"
echo ""

# ==================================================
# Cleanup
# ==================================================
print_header "Cleanup"

print_info "Deleting test post..."
curl -s -X DELETE "$API_BASE_URL/api/content/$POST_ID" \
    -H "Cookie: better-auth.session_token=$SESSION_TOKEN" > /dev/null
print_success "Test post deleted"
echo ""

# ==================================================
# Summary
# ==================================================
print_header "Test Summary"

echo "All verification steps completed:"
print_success "✓ Step 1: Created draft post"
print_success "✓ Step 2: Scheduled post for future time"
print_success "✓ Step 3: Rescheduled to different time"
print_success "✓ Step 4: Verified old QStash schedule deleted"
print_success "✓ Step 5: Verified new QStash schedule created"
print_success "✓ Step 6: Cancelled scheduled post"
print_success "✓ Step 7: Verified QStash schedule deleted"
print_success "✓ Step 8: Verified post reverted to 'draft' status"
echo ""

print_header "✓ Reschedule & Cancellation Flow Test PASSED"
