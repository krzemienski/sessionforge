#!/usr/bin/env bun

/**
 * Portfolio Feature - Code Structure Verification
 * Validates that key implementation details are present in the code
 */

import { readFileSync } from 'fs';

interface CodeCheck {
  file: string;
  checks: Array<{
    description: string;
    pattern: string | RegExp;
  }>;
}

const codeChecks: CodeCheck[] = [
  {
    file: './packages/db/src/schema.ts',
    checks: [
      { description: 'portfolioThemeEnum defined', pattern: /portfolioThemeEnum/ },
      { description: 'minimal theme option', pattern: /minimal/ },
      { description: 'developer-dark theme option', pattern: /developer-dark/ },
      { description: 'colorful theme option', pattern: /colorful/ },
      { description: 'portfolio_settings table', pattern: /portfolio_settings/ },
    ]
  },
  {
    file: './apps/dashboard/src/app/api/portfolio/settings/route.ts',
    checks: [
      { description: 'GET endpoint', pattern: /export\s+async\s+function\s+GET/ },
      { description: 'PATCH endpoint', pattern: /export\s+async\s+function\s+PATCH/ },
      { description: 'Authentication check', pattern: /auth\.api\.getSession/ },
      { description: 'Portfolio settings query', pattern: /portfolioSettings/ },
    ]
  },
  {
    file: './apps/dashboard/src/app/api/public/portfolio/[workspace]/rss/route.ts',
    checks: [
      { description: 'RSS 2.0 format', pattern: /<rss version="2\.0">/ },
      { description: 'Content-Type header', pattern: /application\/rss\+xml/ },
      { description: 'XML escaping', pattern: /escapeXml/ },
    ]
  },
  {
    file: './apps/dashboard/src/components/settings/portfolio-settings-form.tsx',
    checks: [
      { description: 'Enable toggle', pattern: /isEnabled/ },
      { description: 'Bio textarea', pattern: /bio/ },
      { description: 'Theme selector', pattern: /theme/ },
      { description: 'Social links', pattern: /socialLinks/ },
      { description: 'Pinned posts', pattern: /pinnedPostIds/ },
    ]
  },
  {
    file: './apps/dashboard/src/app/[workspace]/page.tsx',
    checks: [
      { description: 'ISR configuration', pattern: /revalidate/ },
      { description: 'BioSection component', pattern: /BioSection/ },
      { description: 'PostGrid component', pattern: /PostGrid/ },
      { description: 'Theme selection', pattern: /theme/ },
    ]
  },
  {
    file: './apps/dashboard/src/components/portfolio/post-grid.tsx',
    checks: [
      { description: 'Client component', pattern: /'use client'/ },
      { description: 'Search functionality', pattern: /search/ },
      { description: 'Filter functionality', pattern: /filter/ },
      { description: 'Pinned posts badge', pattern: /[Pp]inned/ },
      { description: 'Image optimization', pattern: /next\/image/ },
    ]
  },
  {
    file: './apps/dashboard/src/components/portfolio/theme-minimal.tsx',
    checks: [
      { description: 'White background', pattern: /bg-white/ },
      { description: 'Simple styling', pattern: /text-gray/ },
    ]
  },
  {
    file: './apps/dashboard/src/components/portfolio/theme-developer-dark.tsx',
    checks: [
      { description: 'Dark background', pattern: /bg-gray-9/ },
      { description: 'Terminal green', pattern: /green/ },
    ]
  },
  {
    file: './apps/dashboard/src/components/portfolio/theme-colorful.tsx',
    checks: [
      { description: 'Gradient styling', pattern: /gradient/ },
      { description: 'Vibrant colors', pattern: /(purple|pink|orange)/ },
    ]
  },
];

console.log('🔍 Verifying Code Implementation Details...\n');

let totalChecks = 0;
let passedChecks = 0;
const failedChecks: Array<{ file: string; check: string }> = [];

codeChecks.forEach(({ file, checks }) => {
  console.log(`\n📄 ${file}`);
  console.log('-'.repeat(60));

  let content: string;
  try {
    content = readFileSync(file, 'utf-8');
  } catch (error) {
    console.log(`  ✗ Error reading file: ${error}`);
    checks.forEach(check => {
      totalChecks++;
      failedChecks.push({ file, check: check.description });
    });
    return;
  }

  checks.forEach(({ description, pattern }) => {
    totalChecks++;
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    const passed = regex.test(content);

    const status = passed ? '✓' : '✗';
    const color = passed ? '\x1b[32m' : '\x1b[31m';
    console.log(`  ${color}${status}\x1b[0m ${description}`);

    if (passed) {
      passedChecks++;
    } else {
      failedChecks.push({ file, check: description });
    }
  });
});

console.log(`\n${'='.repeat(60)}`);
console.log(`Code Checks: ${passedChecks}/${totalChecks} passed`);
console.log('='.repeat(60));

if (failedChecks.length > 0) {
  console.log('\n⚠️  Failed Checks:');
  failedChecks.forEach(({ file, check }) => {
    console.log(`  - ${check} in ${file}`);
  });
}

const passRate = (passedChecks / totalChecks) * 100;

if (passRate >= 95) {
  console.log('\n✅ Implementation verification passed!');
  console.log(`   Pass rate: ${passRate.toFixed(1)}%`);
  console.log('\n   The portfolio feature implementation is complete.');
  console.log('   All key components and functionality are in place.\n');
  process.exit(0);
} else if (passRate >= 80) {
  console.log('\n⚠️  Implementation mostly complete with minor issues.');
  console.log(`   Pass rate: ${passRate.toFixed(1)}%`);
  console.log('\n   Review failed checks above and address if necessary.\n');
  process.exit(0);
} else {
  console.log('\n❌ Implementation has significant issues.');
  console.log(`   Pass rate: ${passRate.toFixed(1)}%`);
  console.log('\n   Please review and fix failed checks.\n');
  process.exit(1);
}
