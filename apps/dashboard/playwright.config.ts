import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for E2E tests.
 * Tests are located in tests/e2e/ and e2e/ directories.
 * tests/e2e/ covers critical user flows (onboarding, publishing),
 * e2e/ covers editor-specific flows (version history, content editing).
 */
export default defineConfig({
  testDir: "./",
  testMatch: ["**/e2e/**/*.spec.{ts,tsx}", "**/tests/e2e/**/*.spec.{ts,tsx}", "**/tests/a11y/**/*.spec.{ts,tsx}"],

  /* Maximum time one test can run */
  timeout: 30_000,

  /* Run tests in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI to detect and tolerate flaky tests */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter configuration — on CI emit a JSON report so flaky test
     detection tooling can parse retry outcomes across runs */
  reporter: process.env.CI
    ? [
        ["html", { outputFolder: "playwright-report", open: "never" }],
        ["json", { outputFile: "playwright-report/results.json" }],
        ["list"],
      ]
    : [
        ["html", { outputFolder: "playwright-report", open: "never" }],
        ["list"],
      ],

  /* Shared settings for all test projects */
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",

    /* Collect trace when retrying a failed test */
    trace: "on-first-retry",

    /* Capture screenshot on failure */
    screenshot: "only-on-failure",

    /* Record video on failure */
    video: "on-first-retry",
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      /* Exclude quarantined specs from the normal chromium run */
      testIgnore: ["**/quarantine/**"],
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      testIgnore: ["**/quarantine/**"],
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
      testIgnore: ["**/quarantine/**"],
    },
    /* Mobile viewports */
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
      testIgnore: ["**/quarantine/**"],
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 12"] },
      testIgnore: ["**/quarantine/**"],
    },
    /* Quarantine project: runs known-flaky E2E specs in isolation.
       Failures here do NOT block CI — run explicitly with:
         npx playwright test --project=quarantine */
    {
      name: "quarantine",
      use: { ...devices["Desktop Chrome"] },
      testMatch: "**/quarantine/**/*.spec.{ts,tsx}",
      /* Allow more retries for quarantined tests */
      retries: 3,
    },
  ],

  /* Output folder for test artifacts */
  outputDir: "test-results",

  /* Run local dev server before starting tests */
  webServer: {
    command: "bun run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NODE_ENV: "test",
    },
  },
});
