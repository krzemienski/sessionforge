#!/usr/bin/env bun

/**
 * Simple Portfolio Implementation Verification
 * Checks that all required files exist
 */

import { existsSync } from 'fs';

const requiredFiles = [
  // Database
  './packages/db/src/schema.ts',

  // API Endpoints
  './apps/dashboard/src/app/api/portfolio/settings/route.ts',
  './apps/dashboard/src/app/api/portfolio/pinned/route.ts',
  './apps/dashboard/src/app/api/public/portfolio/[workspace]/route.ts',
  './apps/dashboard/src/app/api/public/portfolio/[workspace]/rss/route.ts',

  // Settings UI
  './apps/dashboard/src/app/(dashboard)/[workspace]/settings/portfolio/page.tsx',
  './apps/dashboard/src/components/settings/portfolio-settings-form.tsx',

  // Public Portfolio
  './apps/dashboard/src/app/[workspace]/page.tsx',
  './apps/dashboard/src/app/[workspace]/layout.tsx',
  './apps/dashboard/src/components/portfolio/portfolio-layout.tsx',
  './apps/dashboard/src/components/portfolio/bio-section.tsx',
  './apps/dashboard/src/components/portfolio/post-grid.tsx',

  // Themes
  './apps/dashboard/src/components/portfolio/theme-minimal.tsx',
  './apps/dashboard/src/components/portfolio/theme-developer-dark.tsx',
  './apps/dashboard/src/components/portfolio/theme-colorful.tsx',
];

console.log('🔍 Verifying Portfolio Feature Implementation...\n');

let allExist = true;
let filesFound = 0;

requiredFiles.forEach(file => {
  const exists = existsSync(file);
  const status = exists ? '✓' : '✗';
  const color = exists ? '\x1b[32m' : '\x1b[31m';
  console.log(`${color}${status}\x1b[0m ${file}`);

  if (exists) filesFound++;
  else allExist = false;
});

console.log(`\n${'='.repeat(60)}`);
console.log(`Files Found: ${filesFound}/${requiredFiles.length}`);
console.log('='.repeat(60));

if (allExist) {
  console.log('\n✅ All required files exist!');
  console.log('\n📋 Next Steps:');
  console.log('   1. Review E2E-VERIFICATION.md for manual testing guide');
  console.log('   2. Start dev server: bun run dev');
  console.log('   3. Follow manual test flow in verification guide');
  console.log('   4. Run Lighthouse performance test');
  console.log('   5. Document results in E2E-VERIFICATION.md\n');
  process.exit(0);
} else {
  console.log('\n❌ Some required files are missing.');
  console.log('Please ensure all components are implemented before proceeding.\n');
  process.exit(1);
}
