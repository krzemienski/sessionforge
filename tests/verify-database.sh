#!/bin/bash

# Database Verification Script
# Helper script to check database state for scheduled posts

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

DATABASE_URL="${DATABASE_URL:-}"
POST_ID="${1:-}"

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

if [ -z "$DATABASE_URL" ]; then
    print_error "DATABASE_URL environment variable not set"
    echo ""
    echo "Set it like this:"
    echo "  export DATABASE_URL='postgresql://user:pass@host:5432/dbname'"
    exit 1
fi

if ! command -v psql &> /dev/null; then
    print_error "psql is not installed"
    echo ""
    echo "Install it:"
    echo "  macOS: brew install postgresql"
    echo "  Ubuntu: sudo apt-get install postgresql-client"
    exit 1
fi

echo ""
echo "================================================"
echo "  Database Verification for Scheduled Posts"
echo "================================================"
echo ""

if [ -n "$POST_ID" ]; then
    print_step "Checking specific post: $POST_ID"
    echo ""

    print_step "Post Details:"
    psql "$DATABASE_URL" -c "
        SELECT
            id,
            title,
            status,
            scheduled_for,
            timezone,
            qstash_schedule_id,
            created_at,
            updated_at
        FROM posts
        WHERE id = '$POST_ID';
    "
    echo ""

    print_step "Scheduled Publication Record:"
    psql "$DATABASE_URL" -c "
        SELECT
            id,
            post_id,
            platforms,
            scheduled_for,
            status,
            published_at,
            error,
            qstash_schedule_id,
            created_at,
            updated_at
        FROM scheduled_publications
        WHERE post_id = '$POST_ID';
    "
    echo ""

    print_step "Dev.to Publication Record:"
    psql "$DATABASE_URL" -c "
        SELECT
            id,
            post_id,
            devto_article_id,
            devto_url,
            published_as_draft,
            synced_at,
            created_at
        FROM devto_publications
        WHERE post_id = '$POST_ID';
    "
    echo ""
else
    print_step "All Scheduled Posts:"
    psql "$DATABASE_URL" -c "
        SELECT
            p.id,
            p.title,
            p.status,
            p.scheduled_for,
            p.timezone,
            p.qstash_schedule_id,
            sp.status AS publication_status,
            sp.platforms
        FROM posts p
        LEFT JOIN scheduled_publications sp ON p.id = sp.post_id
        WHERE p.status = 'scheduled'
        ORDER BY p.scheduled_for ASC;
    "
    echo ""

    print_step "Recent Scheduled Publications:"
    psql "$DATABASE_URL" -c "
        SELECT
            sp.id,
            sp.post_id,
            p.title,
            sp.platforms,
            sp.scheduled_for,
            sp.status,
            sp.published_at,
            sp.error
        FROM scheduled_publications sp
        JOIN posts p ON sp.post_id = p.id
        ORDER BY sp.created_at DESC
        LIMIT 10;
    "
    echo ""

    print_step "Statistics:"
    psql "$DATABASE_URL" -c "
        SELECT
            status,
            COUNT(*) as count
        FROM scheduled_publications
        GROUP BY status
        ORDER BY count DESC;
    "
    echo ""
fi

echo "================================================"
print_success "Database verification complete"
echo "================================================"
echo ""
echo "Usage:"
echo "  ./tests/verify-database.sh              # Show all scheduled posts"
echo "  ./tests/verify-database.sh <post-id>    # Show specific post details"
echo ""
