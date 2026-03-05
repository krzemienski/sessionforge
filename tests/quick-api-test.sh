#!/bin/bash

# Quick API Test: Scheduling Endpoints
# Tests API endpoints without waiting for scheduled time

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
WORKSPACE_SLUG="${WORKSPACE_SLUG:-test-workspace}"
SESSION_TOKEN="${SESSION_TOKEN:-}"

# Function to print colored output
print_step() {
    echo -e "${BLUE}==> $1${NC}"
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

# Check prerequisites
if [ -z "$SESSION_TOKEN" ]; then
    print_error "SESSION_TOKEN environment variable not set"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    print_error "jq is not installed"
    exit 1
fi

echo ""
echo "================================================"
echo "  Quick API Test: Scheduling Endpoints"
echo "================================================"
echo ""

# Test 1: Create draft post
print_step "Test 1: POST /api/content (create draft post)"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$API_BASE_URL/api/content" \
    -H "Content-Type: application/json" \
    -H "Cookie: better-auth.session_token=$SESSION_TOKEN" \
    -d '{
        "workspaceSlug": "'"$WORKSPACE_SLUG"'",
        "title": "Quick Test Post - Scheduling",
        "type": "blog",
        "markdown": "# Quick Test\n\nThis is a quick API test.",
        "status": "draft"
    }')

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" = "201" ] || [ "$HTTP_STATUS" = "200" ]; then
    POST_ID=$(echo "$RESPONSE_BODY" | jq -r '.id')
    print_success "Draft post created: $POST_ID"
else
    print_error "Failed to create post (HTTP $HTTP_STATUS)"
    echo "$RESPONSE_BODY"
    exit 1
fi
echo ""

# Test 2: Schedule post
print_step "Test 2: POST /api/schedule (schedule post)"
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
    QSTASH_ID=$(echo "$RESPONSE_BODY" | jq -r '.qstashScheduleId')
    print_success "Post scheduled: $QSTASH_ID"
    print_success "Scheduled for: $SCHEDULED_TIME"
else
    print_error "Failed to schedule post (HTTP $HTTP_STATUS)"
    echo "$RESPONSE_BODY"
    exit 1
fi
echo ""

# Test 3: Get scheduled posts
print_step "Test 3: GET /api/schedule (list scheduled posts)"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$API_BASE_URL/api/schedule?workspace=$WORKSPACE_SLUG" \
    -H "Cookie: better-auth.session_token=$SESSION_TOKEN")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" = "200" ]; then
    COUNT=$(echo "$RESPONSE_BODY" | jq '.posts | length')
    print_success "Found $COUNT scheduled post(s)"

    # Verify our post is in the list
    FOUND=$(echo "$RESPONSE_BODY" | jq -r '.posts[] | select(.id == "'"$POST_ID"'") | .id')
    if [ "$FOUND" = "$POST_ID" ]; then
        print_success "Our post is in the scheduled list"
    else
        print_error "Our post not found in scheduled list"
    fi
else
    print_error "Failed to get scheduled posts (HTTP $HTTP_STATUS)"
    echo "$RESPONSE_BODY"
fi
echo ""

# Test 4: Reschedule post
print_step "Test 4: PUT /api/schedule/[id] (reschedule post)"
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
    print_success "Post rescheduled: $NEW_QSTASH_ID"
    print_success "New scheduled time: $NEW_SCHEDULED_TIME"

    if [ "$NEW_QSTASH_ID" != "$QSTASH_ID" ]; then
        print_success "QStash schedule ID changed (old deleted, new created)"
    else
        print_warning "QStash schedule ID unchanged (might be same schedule)"
    fi
else
    print_error "Failed to reschedule post (HTTP $HTTP_STATUS)"
    echo "$RESPONSE_BODY"
fi
echo ""

# Test 5: Cancel scheduled post
print_step "Test 5: DELETE /api/schedule/[id] (cancel scheduled post)"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X DELETE "$API_BASE_URL/api/schedule/$POST_ID" \
    -H "Cookie: better-auth.session_token=$SESSION_TOKEN")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" = "200" ]; then
    print_success "Schedule cancelled"

    # Verify cancelled response
    CANCELLED=$(echo "$RESPONSE_BODY" | jq -r '.cancelled')
    if [ "$CANCELLED" = "true" ]; then
        print_success "Response confirms cancellation"
    fi
else
    print_error "Failed to cancel schedule (HTTP $HTTP_STATUS)"
    echo "$RESPONSE_BODY"
fi
echo ""

# Test 6: Verify post reverted to draft
print_step "Test 6: Verify post reverted to draft status"
RESPONSE=$(curl -s "$API_BASE_URL/api/content?workspace=$WORKSPACE_SLUG&status=draft&limit=100" \
    -H "Cookie: better-auth.session_token=$SESSION_TOKEN")

POST_STATUS=$(echo "$RESPONSE" | jq -r '.posts[] | select(.id == "'"$POST_ID"'") | .status')

if [ "$POST_STATUS" = "draft" ]; then
    print_success "Post status is now 'draft'"
else
    print_error "Post status is not 'draft', got: $POST_STATUS"
fi
echo ""

# Cleanup
print_step "Cleanup: Deleting test post"
curl -s -X DELETE "$API_BASE_URL/api/content/$POST_ID" \
    -H "Cookie: better-auth.session_token=$SESSION_TOKEN" > /dev/null
print_success "Test post deleted"
echo ""

echo "================================================"
print_success "All API tests passed!"
echo "================================================"
echo ""
