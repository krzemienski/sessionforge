import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: [],
    include: [
      "src/**/__tests__/**/*.{test,spec}.{ts,tsx}",
      "tests/**/*.{test,spec}.{ts,tsx}",
    ],
    /* Quarantined tests live in tests/__quarantine__/ and are excluded from
       the normal run. Run them explicitly with:
         vitest run tests/__quarantine__ --reporter=verbose */
    exclude: [
      "tests/e2e/**",
      "tests/__quarantine__/**",
      "node_modules/**",
      ".next/**",
    ],

    /* Retry flaky tests up to 2 times on CI before marking as failed */
    retry: process.env.CI ? 2 : 0,

    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "src/lib/**/*.ts",
        "src/app/api/**/*.ts",
      ],
      exclude: [
        "src/**/__tests__/**",
        "src/**/*.d.ts",
        "node_modules/**",
        ".next/**",
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@sessionforge/db": path.resolve(__dirname, "../../packages/db/src/index"),
    },
  },
});
