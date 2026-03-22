/**
 * WCAG AA Accessibility Audit Suite
 *
 * Runs axe-core against the 10 most-trafficked pages to assert zero WCAG 2.1
 * Level AA violations. Uses @axe-core/playwright's AxeBuilder integration
 * with Playwright for automated accessibility testing in CI.
 *
 * Prerequisites:
 *   - A running dev/preview server with an authenticated workspace
 *   - Set TEST_WORKSPACE env var to the target workspace slug (default: "test-workspace")
 *
 * Pages tested:
 *   1. Dashboard          /{workspace}
 *   2. Content list        /{workspace}/content
 *   3. Content editor      /{workspace}/content/new
 *   4. Sessions            /{workspace}/sessions
 *   5. Insights            /{workspace}/insights
 *   6. Analytics           /{workspace}/analytics
 *   7. Settings            /{workspace}/settings
 *   8. Automation          /{workspace}/automation
 *   9. Writing coach       /{workspace}/writing-coach
 *  10. Calendar view       /{workspace}/content?view=calendar
 *
 * Each test navigates to the page, waits for the main content to settle, then
 * runs AxeBuilder with the "wcag2a" and "wcag2aa" tags. Any violation causes
 * the test to fail with a descriptive summary of the offending nodes.
 */

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Workspace slug used in all test URLs. Override via TEST_WORKSPACE env var. */
const WORKSPACE = process.env.TEST_WORKSPACE ?? "test-workspace";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format axe violations into a human-readable failure message. */
function formatViolations(violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]): string {
  return violations
    .map((v) => {
      const nodes = v.nodes
        .map((n) => `    - ${n.html}\n      ${n.failureSummary}`)
        .join("\n");
      return `[${v.id}] ${v.description} (${v.impact})\n  Help: ${v.helpUrl}\n${nodes}`;
    })
    .join("\n\n");
}

/**
 * Run an axe-core WCAG AA audit on a given page path.
 *
 * The function navigates to the URL, waits for the network to settle, then
 * analyses the full page against WCAG 2.0 A and 2.0 AA rule sets.
 */
async function auditPage(page: import("@playwright/test").Page, path: string) {
  await page.goto(path, { waitUntil: "networkidle" });

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations, formatViolations(results.violations)).toHaveLength(0);
}

// ---------------------------------------------------------------------------
// WCAG AA audit tests — one per high-traffic page
// ---------------------------------------------------------------------------

test.describe("WCAG AA Accessibility Audit", () => {
  test("dashboard page has no WCAG AA violations", async ({ page }) => {
    await auditPage(page, `/${WORKSPACE}`);
  });

  test("content list page has no WCAG AA violations", async ({ page }) => {
    await auditPage(page, `/${WORKSPACE}/content`);
  });

  test("content editor page has no WCAG AA violations", async ({ page }) => {
    await auditPage(page, `/${WORKSPACE}/content/new`);
  });

  test("sessions page has no WCAG AA violations", async ({ page }) => {
    await auditPage(page, `/${WORKSPACE}/sessions`);
  });

  test("insights page has no WCAG AA violations", async ({ page }) => {
    await auditPage(page, `/${WORKSPACE}/insights`);
  });

  test("analytics page has no WCAG AA violations", async ({ page }) => {
    await auditPage(page, `/${WORKSPACE}/analytics`);
  });

  test("settings page has no WCAG AA violations", async ({ page }) => {
    await auditPage(page, `/${WORKSPACE}/settings`);
  });

  test("automation page has no WCAG AA violations", async ({ page }) => {
    await auditPage(page, `/${WORKSPACE}/automation`);
  });

  test("writing coach page has no WCAG AA violations", async ({ page }) => {
    await auditPage(page, `/${WORKSPACE}/writing-coach`);
  });

  test("calendar view page has no WCAG AA violations", async ({ page }) => {
    await auditPage(page, `/${WORKSPACE}/content?view=calendar`);
  });
});
