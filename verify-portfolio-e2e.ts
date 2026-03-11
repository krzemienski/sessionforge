#!/usr/bin/env bun

/**
 * End-to-End Portfolio Verification Script
 *
 * This script verifies that all portfolio feature components are properly implemented.
 * It checks:
 * 1. Database schema exists
 * 2. API endpoints are implemented
 * 3. UI components exist
 * 4. Public pages are set up
 * 5. Themes are implemented
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface VerificationResult {
  category: string;
  checks: Array<{
    name: string;
    passed: boolean;
    message: string;
  }>;
}

const results: VerificationResult[] = [];

// Helper to check if file exists and contains required content
function checkFileExists(path: string, requiredContent?: string[]): boolean {
  if (!existsSync(path)) {
    return false;
  }

  if (requiredContent && requiredContent.length > 0) {
    const content = readFileSync(path, 'utf-8');
    return requiredContent.every(str => content.includes(str));
  }

  return true;
}

// 1. Database Schema Verification
console.log('🔍 Verifying Database Schema...\n');
const dbResults: VerificationResult = {
  category: 'Database Schema',
  checks: []
};

const schemaPath = './packages/db/src/schema.ts';
const schemaChecks = [
  {
    name: 'portfolioThemeEnum exists',
    content: ['portfolioThemeEnum', 'minimal', 'developer-dark', 'colorful']
  },
  {
    name: 'portfolio_settings table exists',
    content: ['portfolio_settings', 'isEnabled', 'bio', 'theme', 'socialLinks', 'pinnedPostIds']
  }
];

schemaChecks.forEach(check => {
  const passed = checkFileExists(schemaPath, check.content);
  dbResults.checks.push({
    name: check.name,
    passed,
    message: passed ? '✓ Found' : '✗ Missing or incomplete'
  });
});

results.push(dbResults);

// 2. API Endpoints Verification
console.log('🔍 Verifying API Endpoints...\n');
const apiResults: VerificationResult = {
  category: 'API Endpoints',
  checks: []
};

const apiEndpoints = [
  {
    name: 'Portfolio Settings API (GET/PATCH)',
    path: './apps/dashboard/src/app/api/portfolio/settings/route.ts',
    content: ['GET', 'PATCH', 'portfolio_settings']
  },
  {
    name: 'Pinned Posts API (POST/DELETE)',
    path: './apps/dashboard/src/app/api/portfolio/pinned/route.ts',
    content: ['POST', 'DELETE', 'pinnedPostIds']
  },
  {
    name: 'Public Portfolio API',
    path: './apps/dashboard/src/app/api/public/portfolio/[workspace]/route.ts',
    content: ['GET', 'portfolio_settings', 'published']
  },
  {
    name: 'RSS Feed API',
    path: './apps/dashboard/src/app/api/public/portfolio/[workspace]/rss/route.ts',
    content: ['GET', 'application/rss+xml', '<rss version="2.0">']
  }
];

apiEndpoints.forEach(endpoint => {
  const passed = checkFileExists(endpoint.path, endpoint.content);
  apiResults.checks.push({
    name: endpoint.name,
    passed,
    message: passed ? '✓ Implemented' : '✗ Missing or incomplete'
  });
});

results.push(apiResults);

// 3. Settings UI Verification
console.log('🔍 Verifying Settings UI...\n');
const settingsResults: VerificationResult = {
  category: 'Settings UI',
  checks: []
};

const settingsComponents = [
  {
    name: 'Portfolio Settings Page',
    path: './apps/dashboard/src/app/(dashboard)/[workspace]/settings/portfolio/page.tsx',
    content: ['PortfolioSettingsForm', 'portfolio/settings']
  },
  {
    name: 'Portfolio Settings Form',
    path: './apps/dashboard/src/components/settings/portfolio-settings-form.tsx',
    content: ['isEnabled', 'bio', 'theme', 'socialLinks', 'pinnedPostIds']
  }
];

settingsComponents.forEach(component => {
  const passed = checkFileExists(component.path, component.content);
  settingsResults.checks.push({
    name: component.name,
    passed,
    message: passed ? '✓ Implemented' : '✗ Missing or incomplete'
  });
});

results.push(settingsResults);

// 4. Public Portfolio Page Verification
console.log('🔍 Verifying Public Portfolio Page...\n');
const publicResults: VerificationResult = {
  category: 'Public Portfolio Page',
  checks: []
};

const publicComponents = [
  {
    name: 'Portfolio Page Route',
    path: './apps/dashboard/src/app/[workspace]/page.tsx',
    content: ['portfolio', 'BioSection', 'PostGrid']
  },
  {
    name: 'Portfolio Layout',
    path: './apps/dashboard/src/components/portfolio/portfolio-layout.tsx',
    content: ['workspaceName', 'showRss', 'showPoweredBy']
  },
  {
    name: 'Bio Section Component',
    path: './apps/dashboard/src/components/portfolio/bio-section.tsx',
    content: ['avatarUrl', 'bio', 'socialLinks']
  },
  {
    name: 'Post Grid Component',
    path: './apps/dashboard/src/components/portfolio/post-grid.tsx',
    content: ['pinnedPostIds', 'search', 'filter']
  }
];

publicComponents.forEach(component => {
  const passed = checkFileExists(component.path, component.content);
  publicResults.checks.push({
    name: component.name,
    passed,
    message: passed ? '✓ Implemented' : '✗ Missing or incomplete'
  });
});

results.push(publicResults);

// 5. Theme Components Verification
console.log('🔍 Verifying Theme Components...\n');
const themeResults: VerificationResult = {
  category: 'Portfolio Themes',
  checks: []
};

const themes = [
  {
    name: 'Minimal Theme',
    path: './apps/dashboard/src/components/portfolio/theme-minimal.tsx',
    content: ['bg-white', 'text-gray']
  },
  {
    name: 'Developer Dark Theme',
    path: './apps/dashboard/src/components/portfolio/theme-developer-dark.tsx',
    content: ['bg-gray-950', 'text-green']
  },
  {
    name: 'Colorful Theme',
    path: './apps/dashboard/src/components/portfolio/theme-colorful.tsx',
    content: ['gradient', 'purple', 'pink']
  }
];

themes.forEach(theme => {
  const passed = checkFileExists(theme.path, theme.content);
  themeResults.checks.push({
    name: theme.name,
    passed,
    message: passed ? '✓ Implemented' : '✗ Missing or incomplete'
  });
});

results.push(themeResults);

// 6. Performance Optimizations Verification
console.log('🔍 Verifying Performance Optimizations...\n');
const perfResults: VerificationResult = {
  category: 'Performance Optimizations',
  checks: []
};

const perfChecks = [
  {
    name: 'ISR Enabled',
    path: './apps/dashboard/src/app/[workspace]/page.tsx',
    content: ['revalidate']
  },
  {
    name: 'Image Optimization (Bio)',
    path: './apps/dashboard/src/components/portfolio/bio-section.tsx',
    content: ['next/image', 'Image']
  },
  {
    name: 'Image Optimization (Posts)',
    path: './apps/dashboard/src/components/portfolio/post-grid.tsx',
    content: ['Image', 'next/image']
  }
];

perfChecks.forEach(check => {
  const passed = checkFileExists(check.path, check.content);
  perfResults.checks.push({
    name: check.name,
    passed,
    message: passed ? '✓ Implemented' : '✗ Missing or incomplete'
  });
});

results.push(perfResults);

// Print Results
console.log('\n' + '='.repeat(60));
console.log('PORTFOLIO E2E VERIFICATION RESULTS');
console.log('='.repeat(60) + '\n');

let totalPassed = 0;
let totalChecks = 0;

results.forEach(result => {
  console.log(`\n📦 ${result.category}`);
  console.log('-'.repeat(60));

  result.checks.forEach(check => {
    console.log(`  ${check.message} ${check.name}`);
    if (check.passed) totalPassed++;
    totalChecks++;
  });
});

console.log('\n' + '='.repeat(60));
console.log(`SUMMARY: ${totalPassed}/${totalChecks} checks passed`);
console.log('='.repeat(60) + '\n');

if (totalPassed === totalChecks) {
  console.log('✅ All verification checks passed!');
  console.log('\nNext Steps for Manual E2E Testing:');
  console.log('1. Start dev server: bun run dev');
  console.log('2. Create test workspace in database');
  console.log('3. Navigate to http://localhost:3000/[workspace]/settings/portfolio');
  console.log('4. Enable portfolio and configure settings');
  console.log('5. Visit http://localhost:3000/[workspace] to view public portfolio');
  console.log('6. Test RSS feed at http://localhost:3000/[workspace]/rss');
  console.log('7. Run Lighthouse test for performance verification\n');
  process.exit(0);
} else {
  console.log('❌ Some verification checks failed.');
  console.log('Please review the implementation before proceeding.\n');
  process.exit(1);
}
