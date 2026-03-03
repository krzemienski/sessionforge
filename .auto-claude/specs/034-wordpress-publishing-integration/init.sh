#!/bin/bash
set -e

echo "=== SessionForge: WordPress Publishing Integration Setup ==="
echo ""

# Verify we're in the right directory
if [ ! -f "package.json" ]; then
  echo "ERROR: Must run from the repo root (package.json not found)"
  exit 1
fi

# Check for required environment variables
echo "Checking environment variables..."
if [ ! -f "apps/dashboard/.env.local" ] && [ ! -f ".env.local" ]; then
  echo "WARNING: No .env.local found. Make sure DATABASE_URL and BETTER_AUTH_SECRET are set."
fi

# Check BETTER_AUTH_SECRET is set (needed for WordPress password encryption)
if [ -z "$BETTER_AUTH_SECRET" ]; then
  echo "WARNING: BETTER_AUTH_SECRET not set in environment."
  echo "  This is required for encrypting WordPress application passwords."
  echo "  Check apps/dashboard/.env.local"
fi

# Install dependencies (idempotent)
echo ""
echo "Installing dependencies..."
bun install

# Verify packages/db builds
echo ""
echo "Building packages/db..."
cd packages/db && bun run build 2>/dev/null || echo "(no build script in packages/db, skipping)"
cd ../..

# Verify apps/dashboard type-checks
echo ""
echo "Checking TypeScript..."
cd apps/dashboard && bunx tsc --noEmit 2>&1 | head -20 || echo "(type errors may exist before schema changes)"
cd ../..

echo ""
echo "=== Setup complete ==="
echo ""
echo "Implementation phases:"
echo "  Phase 1: DB Schema changes (packages/db/src/schema.ts)"
echo "           Run: bun run db:generate && bun run db:push"
echo "  Phase 2: WordPress client lib (apps/dashboard/src/lib/wordpress/)"
echo "  Phase 3: API routes (apps/dashboard/src/app/api/...)"
echo "  Phase 4: Settings UI (apps/dashboard/src/app/(dashboard)/[workspace]/settings/wordpress/)"
echo "  Phase 5: Publish UI (components + hooks)"
echo ""
echo "Key files to check:"
echo "  - packages/db/src/schema.ts (add wordpressConnections table + posts columns)"
echo "  - apps/dashboard/src/components/content/export-dropdown.tsx (add WP publish option)"
echo "  - apps/dashboard/src/hooks/use-content.ts (add WP hooks)"
echo ""
