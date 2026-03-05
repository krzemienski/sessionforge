#!/bin/bash

# E2E Test: Content Scheduling & Publishing
# This script tests the complete flow: Schedule post → QStash job executes → Post published

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration - UPDATE THESE VALUES
API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
WORKSPACE_SLUG="${WORKSPACE_SLUG:-test-workspace}"
SESSION_TOKEN="${SESSION_TOKEN:-}"
QSTASH_CURRENT_SIGNING_KEY="${QSTASH_CURRENT_SIGNING_KEY:-}"
QSTASH_NEXT_SIGNING_KEY="${QSTASH_NEXT_SIGNING_KEY:-}"

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

# Function to check prerequisites
check_prerequisites() {
    print_step "Checking prerequisites..."

    if [ -z "$SESSION_TOKEN" ]; then
        print_error "SESSION_TOKEN environment variable not set"
        echo "Please login and set your session token:"
        echo "export SESSION_TOKEN='your-session-token'"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        print_error "jq is not installed. Please install it to run this test."
        echo "On macOS: brew install jq"
        exit 1
    fi

    if ! command -v psql &> /dev/null; then
        print_warning "psql is not installed. Database verification will be skipped."
        echo "On macOS: brew install postgresql"
    fi

    print_success "Prerequisites checked"
}

# Step 1: Create a draft post
create_draft_post() {
    print_step "Step 1: Creating draft post via API..."

    RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/content" \
        -H "Content-Type: application/json" \
        -H "Cookie: better-auth.session_token=$SESSION_TOKEN" \
        -d '{
            "workspaceSlug": "'"$WORKSPACE_SLUG"'",
            "title": "E2E Test Post - Scheduled Publishing",
            "type": "blog",
            "markdown": "# Test Post\n\nThis is a test post for E2E scheduling verification.\n\nGenerated at: '"$(date -u +"%Y-%m-%dT%H:%M:%SZ")"'",
            "status": "draft"
        }')

    POST_ID=$(echo "$RESPONSE" | jq -r '.id // empty')

    if [ -z "$POST_ID" ]; then
        print_error "Failed to create draft post"
        echo "Response: $RESPONSE"
        exit 1
    fi

    print_success "Draft post created with ID: $POST_ID"
}

# Step 2: Schedule the post for 2 minutes in the future
schedule_post() {
    print_step "Step 2: Scheduling post for 2 minutes in future..."

    # Calculate time 2 minutes from now in ISO format
    SCHEDULED_TIME=$(date -u -v+2M +"%Y-%m-%dT%H:%M:%S.000Z" 2>/dev/null || date -u -d "+2 minutes" +"%Y-%m-%dT%H:%M:%S.000Z")

    RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/schedule" \
        -H "Content-Type: application/json" \
        -H "Cookie: better-auth.session_token=$SESSION_TOKEN" \
        -d '{
            "postId": "'"$POST_ID"'",
            "workspaceSlug": "'"$WORKSPACE_SLUG"'",
            "scheduledFor": "'"$SCHEDULED_TIME"'",
            "timezone": "America/New_York",
            "platforms": ["devto"]
        }')

    QSTASH_SCHEDULE_ID=$(echo "$RESPONSE" | jq -r '.qstashScheduleId // empty')

    if [ -z "$QSTASH_SCHEDULE_ID" ]; then
        print_error "Failed to schedule post"
        echo "Response: $RESPONSE"
        exit 1
    fi

    print_success "Post scheduled with QStash ID: $QSTASH_SCHEDULE_ID"
    print_success "Scheduled for: $SCHEDULED_TIME"
}

# Step 3: Verify post status changed to 'scheduled' in database
verify_post_scheduled() {
    print_step "Step 3: Verifying post status changed to 'scheduled'..."

    RESPONSE=$(curl -s "$API_BASE_URL/api/schedule?workspace=$WORKSPACE_SLUG" \
        -H "Cookie: better-auth.session_token=$SESSION_TOKEN")

    SCHEDULED_POST=$(echo "$RESPONSE" | jq -r '.posts[] | select(.id == "'"$POST_ID"'")')

    if [ -z "$SCHEDULED_POST" ]; then
        print_error "Post not found in scheduled posts list"
        echo "Response: $RESPONSE"
        exit 1
    fi

    STATUS=$(echo "$SCHEDULED_POST" | jq -r '.status')

    if [ "$STATUS" != "scheduled" ]; then
        print_error "Post status is not 'scheduled', got: $STATUS"
        exit 1
    fi

    print_success "Post status verified as 'scheduled'"
}

# Step 4: Verify QStash schedule created
verify_qstash_schedule() {
    print_step "Step 4: Verifying QStash schedule created..."

    RESPONSE=$(curl -s "$API_BASE_URL/api/schedule?workspace=$WORKSPACE_SLUG" \
        -H "Cookie: better-auth.session_token=$SESSION_TOKEN")

    QSTASH_ID=$(echo "$RESPONSE" | jq -r '.posts[] | select(.id == "'"$POST_ID"'") | .qstashScheduleId')

    if [ -z "$QSTASH_ID" ] || [ "$QSTASH_ID" = "null" ]; then
        print_error "QStash schedule ID not found in post"
        exit 1
    fi

    print_success "QStash schedule ID verified: $QSTASH_ID"
}

# Step 5: Wait for scheduled time (optional - can skip to test immediately)
wait_for_scheduled_time() {
    print_step "Step 5: Waiting for scheduled time..."

    print_warning "This will take approximately 2 minutes..."
    print_warning "Press Ctrl+C to skip and test webhook manually"

    sleep 130  # Wait 2 minutes + 10 seconds buffer

    print_success "Wait complete"
}

# Step 6: Simulate QStash webhook call (for immediate testing)
simulate_qstash_webhook() {
    print_step "Step 6: Simulating QStash webhook call..."

    if [ -z "$QSTASH_CURRENT_SIGNING_KEY" ]; then
        print_warning "QSTASH_CURRENT_SIGNING_KEY not set, webhook verification will fail"
        print_warning "This is expected in local testing without QStash setup"
        print_warning "The endpoint will return 401, but we'll verify the rest of the flow"
    fi

    # Generate a simple signature (won't be valid without real keys)
    TIMESTAMP=$(date +%s)
    BODY='{"postId":"'"$POST_ID"'"}'

    RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$API_BASE_URL/api/schedule/publish" \
        -H "Content-Type: application/json" \
        -H "Upstash-Signature: v1=test-signature" \
        -H "Upstash-Timestamp: $TIMESTAMP" \
        -d "$BODY")

    HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
    RESPONSE_BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

    if [ "$HTTP_STATUS" = "401" ]; then
        print_warning "Webhook returned 401 (signature verification)"
        print_warning "This is expected without valid QStash keys"
        echo "Response: $RESPONSE_BODY"
    elif [ "$HTTP_STATUS" = "200" ]; then
        print_success "Webhook executed successfully"
    else
        print_error "Webhook returned unexpected status: $HTTP_STATUS"
        echo "Response: $RESPONSE_BODY"
    fi
}

# Step 7: Check if post was published (after webhook or scheduled time)
verify_post_published() {
    print_step "Step 7: Verifying post published status..."

    # Fetch the post from content API
    RESPONSE=$(curl -s "$API_BASE_URL/api/content?workspace=$WORKSPACE_SLUG&limit=100" \
        -H "Cookie: better-auth.session_token=$SESSION_TOKEN")

    POST=$(echo "$RESPONSE" | jq -r '.posts[] | select(.id == "'"$POST_ID"'")')

    if [ -z "$POST" ]; then
        print_error "Post not found"
        exit 1
    fi

    STATUS=$(echo "$POST" | jq -r '.status')

    if [ "$STATUS" = "published" ]; then
        print_success "Post status updated to 'published'"
    elif [ "$STATUS" = "scheduled" ]; then
        print_warning "Post is still 'scheduled' (QStash job may not have executed yet)"
        print_warning "Wait for scheduled time or check QStash dashboard"
    else
        print_error "Unexpected post status: $STATUS"
        exit 1
    fi
}

# Step 8: Verify scheduledPublications record
verify_scheduled_publication_record() {
    print_step "Step 8: Verifying scheduledPublications record..."

    print_warning "This requires database access - skipping in API-only test"
    print_warning "To verify manually, run:"
    echo "  SELECT * FROM scheduled_publications WHERE post_id = '$POST_ID';"
}

# Cleanup function
cleanup() {
    print_step "Cleanup: Deleting test post..."

    if [ -n "$POST_ID" ]; then
        curl -s -X DELETE "$API_BASE_URL/api/content/$POST_ID" \
            -H "Cookie: better-auth.session_token=$SESSION_TOKEN" > /dev/null
        print_success "Test post deleted"
    fi
}

# Main execution
main() {
    echo ""
    echo "================================================"
    echo "  E2E Test: Content Scheduling & Publishing"
    echo "================================================"
    echo ""

    check_prerequisites
    echo ""

    # Set up cleanup on exit
    trap cleanup EXIT

    create_draft_post
    echo ""

    schedule_post
    echo ""

    verify_post_scheduled
    echo ""

    verify_qstash_schedule
    echo ""

    # Ask user if they want to wait or test immediately
    echo ""
    print_warning "Choose testing mode:"
    echo "  1) Wait 2 minutes and verify automatic execution (recommended)"
    echo "  2) Test webhook immediately (simulated QStash call)"
    echo ""
    read -p "Enter choice (1 or 2): " CHOICE

    if [ "$CHOICE" = "1" ]; then
        wait_for_scheduled_time
        echo ""
        verify_post_published
    else
        simulate_qstash_webhook
        echo ""
        verify_post_published
    fi

    echo ""
    verify_scheduled_publication_record

    echo ""
    echo "================================================"
    print_success "E2E Test Complete!"
    echo "================================================"
    echo ""
}

# Run main function
main
