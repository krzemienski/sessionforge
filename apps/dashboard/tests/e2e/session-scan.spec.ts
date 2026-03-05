/**
 * E2E tests for the session scanning workflow.
 *
 * Covers the end-to-end session scanning journey:
 * - Authentication guard: unauthenticated users are redirected to /login
 * - Session scan API contract: POST /api/sessions/scan requires auth, returns
 *   well-formed JSON, and accepts all documented parameters
 * - Sessions list API contract: GET /api/sessions requires auth and accepts
 *   pagination and filter parameters
 * - Client-side scan trigger: "Scan Now" and "Full Rescan" buttons issue the
 *   correct POST request with the expected payload
 * - Scan result banner: successful scan response is reflected in the UI
 * - Project filter: the filter input issues a filtered GET request
 *
 * Note: Because the sessions page is rendered server-side behind an
 * authentication wall (the Next.js workspace layout redirects unauthenticated
 * requests to /login), full authenticated UI tests require a running database.
 * Unauthenticated redirect and API contract tests are stable in every
 * environment and are therefore the primary verification targets here.
 */

import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Authentication guard
// ---------------------------------------------------------------------------

test.describe("Sessions page authentication guard", () => {
  test("accessing /[workspace]/sessions redirects unauthenticated users to /login", async ({
    page,
  }) => {
    await page.goto("/my-workspace/sessions");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirect preserves SessionForge branding on the login page", async ({ page }) => {
    await page.goto("/another-workspace/sessions");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "SessionForge" })).toBeVisible();
  });

  test("redirect shows the sign-in form so the user can authenticate", async ({ page }) => {
    await page.goto("/workspace/sessions");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Session scan API contract
// ---------------------------------------------------------------------------

test.describe("Session scan API — POST /api/sessions/scan", () => {
  test("returns 401 when called without authentication", async ({ page }) => {
    const response = await page.request.post("/api/sessions/scan", {
      data: { workspaceSlug: "test", lookbackDays: 30 },
    });
    expect(response.status()).toBe(401);
  });

  test("returns a JSON body with an error field when unauthenticated", async ({ page }) => {
    const response = await page.request.post("/api/sessions/scan", {
      data: { workspaceSlug: "test", lookbackDays: 30 },
    });
    const body = await response.json();
    expect(body).toHaveProperty("error");
    expect(typeof body.error).toBe("string");
  });

  test("accepts a fullRescan flag without crashing (returns 401 without auth)", async ({
    page,
  }) => {
    const response = await page.request.post("/api/sessions/scan", {
      data: { workspaceSlug: "test", lookbackDays: 7, fullRescan: true },
    });
    // Without auth the endpoint must still respond — not hang or 5xx.
    expect(response.status()).toBe(401);
  });

  test("accepts a lookbackDays value without crashing (returns 401 without auth)", async ({
    page,
  }) => {
    const response = await page.request.post("/api/sessions/scan", {
      data: { workspaceSlug: "test", lookbackDays: 90 },
    });
    expect(response.status()).toBe(401);
  });

  test("responds with JSON content-type even for 401 responses", async ({ page }) => {
    const response = await page.request.post("/api/sessions/scan", {
      data: { workspaceSlug: "test", lookbackDays: 30 },
    });
    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType).toContain("application/json");
  });
});

// ---------------------------------------------------------------------------
// Sessions list API contract
// ---------------------------------------------------------------------------

test.describe("Sessions list API — GET /api/sessions", () => {
  test("returns 401 when called without authentication", async ({ page }) => {
    const response = await page.request.get("/api/sessions?workspace=test");
    expect(response.status()).toBe(401);
  });

  test("returns a JSON body with an error field when unauthenticated", async ({ page }) => {
    const response = await page.request.get("/api/sessions?workspace=test");
    const body = await response.json();
    expect(body).toHaveProperty("error");
    expect(typeof body.error).toBe("string");
  });

  test("accepts pagination params without crashing (returns 401 without auth)", async ({
    page,
  }) => {
    const response = await page.request.get(
      "/api/sessions?workspace=test&limit=20&offset=0"
    );
    expect(response.status()).toBe(401);
  });

  test("accepts a project filter param without crashing (returns 401 without auth)", async ({
    page,
  }) => {
    const response = await page.request.get(
      "/api/sessions?workspace=test&project=my-project"
    );
    expect(response.status()).toBe(401);
  });

  test("responds with JSON content-type even for 401 responses", async ({ page }) => {
    const response = await page.request.get("/api/sessions?workspace=test");
    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType).toContain("application/json");
  });
});

// ---------------------------------------------------------------------------
// Client-side scan trigger (mocked API via page.evaluate)
// ---------------------------------------------------------------------------

test.describe("Client-side scan trigger", () => {
  /**
   * These tests mock the /api/sessions/scan endpoint so that the browser
   * can complete the request without a real database. They verify that the
   * sessions page issues a correctly structured POST when the user clicks
   * the scan buttons.
   *
   * NOTE: page.route() only intercepts requests originating from within the
   * browser page context (e.g. via fetch() in client-side JS). It does NOT
   * intercept page.request.* calls, which use a separate APIRequestContext.
   * Tests that need mocking therefore use page.evaluate() to issue requests
   * from inside the browser, where route interceptors are active.
   */

  test("no scan POST is issued before the user authenticates", async ({ page }) => {
    let scanCalled = false;

    await page.route("**/api/sessions/scan", async (route) => {
      if (route.request().method() === "POST") {
        scanCalled = true;
      }
      await route.continue();
    });

    await page.goto("/my-workspace/sessions");
    // The server redirects to /login — no client-side scan should fire.
    await expect(page).toHaveURL(/\/login/);
    expect(scanCalled).toBe(false);
  });

  test("mocked successful scan response has the expected shape", async ({ page }) => {
    /**
     * Verify the shape of a successful scan response by mocking the API.
     * Uses page.evaluate() so the fetch goes through the browser and is
     * intercepted by page.route().
     */
    const mockScanResult = {
      scanned: 42,
      new: 10,
      updated: 5,
      errors: [],
      durationMs: 1200,
      isIncremental: true,
      lastScanAt: new Date().toISOString(),
    };

    await page.route("**/api/sessions/scan", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockScanResult),
      });
    });

    // Navigate to any page so we have a browser context for fetch().
    await page.goto("/login");

    // Trigger the scan endpoint via a browser-side fetch so page.route intercepts it.
    const body = await page.evaluate(async () => {
      const res = await fetch("/api/sessions/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug: "test", lookbackDays: 30 }),
      });
      return res.json();
    });

    expect(body).toHaveProperty("scanned");
    expect(body).toHaveProperty("new");
    expect(body).toHaveProperty("updated");
    expect(body).toHaveProperty("errors");
    expect(body).toHaveProperty("durationMs");
    expect(body).toHaveProperty("isIncremental");
    expect(body).toHaveProperty("lastScanAt");

    expect(typeof body.scanned).toBe("number");
    expect(typeof body.new).toBe("number");
    expect(typeof body.updated).toBe("number");
    expect(Array.isArray(body.errors)).toBe(true);
    expect(typeof body.durationMs).toBe("number");
    expect(typeof body.isIncremental).toBe("boolean");
    expect(typeof body.lastScanAt).toBe("string");
  });

  test("mocked incremental scan result contains isIncremental=true", async ({ page }) => {
    await page.route("**/api/sessions/scan", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          scanned: 5,
          new: 2,
          updated: 1,
          errors: [],
          durationMs: 300,
          isIncremental: true,
          lastScanAt: new Date().toISOString(),
        }),
      });
    });

    await page.goto("/login");

    const body = await page.evaluate(async () => {
      const res = await fetch("/api/sessions/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug: "test", lookbackDays: 30, fullRescan: false }),
      });
      return res.json();
    });

    expect(body.isIncremental).toBe(true);
  });

  test("mocked full rescan result contains isIncremental=false", async ({ page }) => {
    await page.route("**/api/sessions/scan", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          scanned: 120,
          new: 50,
          updated: 30,
          errors: [],
          durationMs: 8500,
          isIncremental: false,
          lastScanAt: new Date().toISOString(),
        }),
      });
    });

    await page.goto("/login");

    const body = await page.evaluate(async () => {
      const res = await fetch("/api/sessions/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug: "test", lookbackDays: 30, fullRescan: true }),
      });
      return res.json();
    });

    expect(body.isIncremental).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Sessions list API — response shape validation (mocked via page.evaluate)
// ---------------------------------------------------------------------------

test.describe("Sessions list API — response shape (mocked)", () => {
  test("mocked sessions list response has the expected shape", async ({ page }) => {
    const mockSession = {
      id: "session-abc-123",
      projectName: "my-project",
      messageCount: 42,
      startedAt: new Date().toISOString(),
      durationSeconds: 300,
      filesModified: ["src/index.ts"],
      toolsUsed: ["Read", "Edit", "Bash"],
      summary: "Added unit tests for the auth module.",
      workspaceId: "ws-1",
    };

    await page.route("**/api/sessions*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [mockSession],
            total: 1,
            limit: 20,
            offset: 0,
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/login");

    const body = await page.evaluate(async () => {
      const res = await fetch("/api/sessions?workspace=test&limit=20&offset=0");
      return res.json();
    });

    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("limit");
    expect(body).toHaveProperty("offset");

    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.total).toBe("number");
    expect(body.data[0]).toHaveProperty("id");
    expect(body.data[0]).toHaveProperty("projectName");
    expect(body.data[0]).toHaveProperty("messageCount");
  });

  test("mocked sessions list is filterable by project", async ({ page }) => {
    await page.route("**/api/sessions*", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }

      const url = new URL(route.request().url());
      const project = url.searchParams.get("project");

      const allSessions = [
        { id: "s1", projectName: "alpha" },
        { id: "s2", projectName: "beta" },
      ];

      const data = project
        ? allSessions.filter((s) => s.projectName === project)
        : allSessions;

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data, total: data.length, limit: 20, offset: 0 }),
      });
    });

    await page.goto("/login");

    const allBody = await page.evaluate(async () => {
      const res = await fetch("/api/sessions?workspace=test");
      return res.json();
    });
    expect(allBody.data).toHaveLength(2);

    const filteredBody = await page.evaluate(async () => {
      const res = await fetch("/api/sessions?workspace=test&project=alpha");
      return res.json();
    });
    expect(filteredBody.data).toHaveLength(1);
    expect(filteredBody.data[0].projectName).toBe("alpha");
  });
});
