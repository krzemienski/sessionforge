#!/bin/bash

# Verification Script for Smart Content Repurposing Engine
# This script checks that all components are properly integrated

set -e

echo "🔍 Smart Content Repurposing Engine - Implementation Verification"
echo "=================================================================="
echo ""

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track results
PASSED=0
FAILED=0
WARNINGS=0

check_pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((PASSED++))
}

check_fail() {
  echo -e "${RED}✗${NC} $1"
  ((FAILED++))
}

check_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
  ((WARNINGS++))
}

echo "1. Database Schema Checks"
echo "------------------------"

# Check parentPostId column in schema
if grep -q "parentPostId: text(\"parent_post_id\")" ../../packages/db/src/schema.ts; then
  check_pass "parentPostId column defined in schema"
else
  check_fail "parentPostId column NOT found in schema"
fi

echo ""
echo "2. MCP Tools Checks"
echo "-------------------"

# Check post-manager has parentPostId support
if grep -q "parentPostId?: string" src/lib/ai/tools/post-manager.ts && \
   grep -q "parentPostId: input.parentPostId" src/lib/ai/tools/post-manager.ts && \
   grep -q 'parentPostId: { type: "string" }' src/lib/ai/tools/post-manager.ts; then
  check_pass "post-manager MCP tool accepts parentPostId parameter"
else
  check_fail "post-manager MCP tool missing parentPostId support"
fi

# Check repurpose-writer sets parentPostId
if grep -q 'When calling create_post, set parentPostId to' src/lib/ai/agents/repurpose-writer.ts || \
   grep -q 'parentPostId' src/lib/ai/agents/repurpose-writer.ts; then
  check_pass "repurpose-writer instructs agent to set parentPostId"
else
  check_fail "repurpose-writer missing parentPostId instruction"
fi

echo ""
echo "3. API Endpoints Checks"
echo "-----------------------"

# Check repurpose API exists
if [ -f "src/app/api/agents/repurpose/route.ts" ]; then
  check_pass "Repurpose API endpoint exists"
else
  check_fail "Repurpose API endpoint missing"
fi

# Check batch repurpose API exists
if [ -f "src/app/api/content/[id]/batch-repurpose/route.ts" ]; then
  check_pass "Batch repurpose API endpoint exists"
else
  check_fail "Batch repurpose API endpoint missing"
fi

# Check repurposed-variants API exists
if [ -f "src/app/api/content/[id]/repurposed-variants/route.ts" ]; then
  check_pass "Repurposed-variants API endpoint exists"
else
  check_fail "Repurposed-variants API endpoint missing"
fi

echo ""
echo "4. Frontend Components Checks"
echo "-----------------------------"

# Check RepurposeButton component
if [ -f "src/components/content/repurpose-button.tsx" ]; then
  check_pass "RepurposeButton component exists"

  # Check it uses the hook
  if grep -q "useRepurpose" src/components/content/repurpose-button.tsx; then
    check_pass "RepurposeButton uses useRepurpose hook"
  else
    check_warn "RepurposeButton might not use useRepurpose hook"
  fi
else
  check_fail "RepurposeButton component missing"
fi

# Check BatchRepurposeDialog component
if [ -f "src/components/content/batch-repurpose-dialog.tsx" ]; then
  check_pass "BatchRepurposeDialog component exists"
else
  check_fail "BatchRepurposeDialog component missing"
fi

# Check RepurposeTracker component
if [ -f "src/components/content/repurpose-tracker.tsx" ]; then
  check_pass "RepurposeTracker component exists"
else
  check_fail "RepurposeTracker component missing"
fi

# Check useRepurpose hook
if [ -f "src/hooks/use-repurpose.ts" ]; then
  check_pass "useRepurpose hook exists"
else
  check_fail "useRepurpose hook missing"
fi

echo ""
echo "5. Integration Checks"
echo "--------------------"

# Check components are imported in post editor page
if grep -q "RepurposeButton" src/app/\(dashboard\)/\[workspace\]/content/\[postId\]/page.tsx && \
   grep -q "RepurposeTracker" src/app/\(dashboard\)/\[workspace\]/content/\[postId\]/page.tsx; then
  check_pass "Components imported in post editor page"
else
  check_fail "Components NOT imported in post editor page"
fi

# Check components are used in post editor page
if grep -q "<RepurposeButton" src/app/\(dashboard\)/\[workspace\]/content/\[postId\]/page.tsx && \
   grep -q "<RepurposeTracker" src/app/\(dashboard\)/\[workspace\]/content/\[postId\]/page.tsx; then
  check_pass "Components used in post editor page"
else
  check_fail "Components NOT used in post editor page"
fi

# Check content list view has indicators
if grep -q "GitBranch" src/components/content/content-list-view.tsx && \
   grep -q "CornerUpLeft" src/components/content/content-list-view.tsx && \
   grep -q "derivativeCount" src/components/content/content-list-view.tsx; then
  check_pass "Content list view has repurpose indicators"
else
  check_fail "Content list view missing repurpose indicators"
fi

echo ""
echo "6. Reverse Repurposing Support"
echo "------------------------------"

# Check blog-from-social prompt exists
if [ -f "src/lib/ai/prompts/repurpose/blog-from-social.ts" ]; then
  check_pass "Blog-from-social prompt exists"
else
  check_fail "Blog-from-social prompt missing"
fi

# Check repurpose-writer supports blog_post target
if grep -q "blog_post" src/lib/ai/agents/repurpose-writer.ts; then
  check_pass "Repurpose-writer supports blog_post target"
else
  check_fail "Repurpose-writer missing blog_post support"
fi

# Check API route has blog_post in VALID_TARGET_FORMATS
if grep -q "blog_post" src/app/api/agents/repurpose/route.ts; then
  check_pass "API route includes blog_post in valid formats"
else
  check_fail "API route missing blog_post in valid formats"
fi

echo ""
echo "=================================================================="
echo "Summary"
echo "=================================================================="
echo -e "${GREEN}Passed:${NC} $PASSED"
echo -e "${RED}Failed:${NC} $FAILED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All automated checks passed!${NC}"
  echo ""
  echo "Next Steps:"
  echo "1. Review E2E_VERIFICATION_GUIDE.md for manual testing steps"
  echo "2. Run the dev server: bun dev"
  echo "3. Perform manual E2E tests in browser"
  echo "4. Verify database relationships with SQL queries"
  exit 0
else
  echo -e "${RED}✗ Some checks failed. Please review and fix.${NC}"
  exit 1
fi
