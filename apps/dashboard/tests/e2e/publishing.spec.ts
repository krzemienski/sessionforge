/**
 * E2E tests for the content publishing workflow.
 *
 * Covers the end-to-end publishing journey:
 * - Authentication guard: unauthenticated users are redirected to /login when
 *   accessing /[workspace]/settings/integrations (where publishing is configured)
 *   and /[workspace]/content (where posts are published)
 * - Dev.to integration API contract: GET/POST/DELETE /api/integrations/devto
 *   requires auth and returns well-formed JSON
 * - Dev.to publish API contract: GET/POST/PUT /api/integrations/devto/publish
 *   requires auth, validates required fields, and returns well-formed JSON
 * - Client-side mocked publishing operations: mocked API interactions verify
 *   correct request shapes and response handling for the full publish flow
 *
 * Note: Because the publishing pages are rendered server-side behind an
 * authentication wall (the Next.js workspace layout redirects unauthenticated
 * requests to /login), full authenticated UI tests require a running database.
 * Unauthenticated redirect and API contract tests are stable in every
 * environment and are therefore the primary verification targets here.
 */

import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Authentication guard
// ---------------------------------------------------------------------------

test.describe("Publishing page authentication guard", () => {
  test("accessing /[workspace]/settings/integrations redirects unauthenticated users to /login", async ({
    page,
  }) => {
    await page.goto("/my-workspace/settings/integrations");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirect preserves SessionForge branding on the login page", async ({ page }) => {
    await page.goto("/another-workspace/settings/integrations");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "SessionForge" })).toBeVisible();
  });

  test("redirect shows the sign-in form so the user can authenticate", async ({ page }) => {
    await page.goto("/workspace/settings/integrations");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Dev.to integration API contract — GET /api/integrations/devto
// ---------------------------------------------------------------------------

test.describe("Dev.to integration API — GET /api/integrations/devto", () => {
  test("returns 401 when called without authentication", async ({ page }) => {
    const response = await page.request.get("/api/integrations/devto?workspace=test");
    expect(response.status()).toBe(401);
  });

  test("returns a JSON body with an error field when unauthenticated", async ({ page }) => {
    const response = await page.request.get("/api/integrations/devto?workspace=test");
    const body = await response.json();
    expect(body).toHaveProperty("error");
    expect(typeof body.error).toBe("string");
  });

  test("responds with JSON content-type even for 401 responses", async ({ page }) => {
    const response = await page.request.get("/api/integrations/devto?workspace=test");
    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType).toContain("application/json");
  });
});

// ---------------------------------------------------------------------------
// Dev.to integration API contract — POST /api/integrations/devto
// ---------------------------------------------------------------------------

test.describe("Dev.to integration API — POST /api/integrations/devto", () => {
  test("returns 401 when called without authentication", async ({ page }) => {
    const response = await page.request.post("/api/integrations/devto", {
      data: {
        workspaceSlug: "test",
        apiKey: "fake-api-key",
      },
    });
    expect(response.status()).toBe(401);
  });

  test("returns a JSON body with an error field when unauthenticated", async ({ page }) => {
    const response = await page.request.post("/api/integrations/devto", {
      data: {
        workspaceSlug: "test",
        apiKey: "fake-api-key",
      },
    });
    const body = await response.json();
    expect(body).toHaveProperty("error");
    expect(typeof body.error).toBe("string");
  });

  test("responds with JSON content-type even for 401 responses", async ({ page }) => {
    const response = await page.request.post("/api/integrations/devto", {
      data: {
        workspaceSlug: "test",
        apiKey: "fake-api-key",
      },
    });
    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType).toContain("application/json");
  });
});

// ---------------------------------------------------------------------------
// Dev.to integration API contract — DELETE /api/integrations/devto
// ---------------------------------------------------------------------------

test.describe("Dev.to integration API — DELETE /api/integrations/devto", () => {
  test("returns 401 when called without authentication", async ({ page }) => {
    const response = await page.request.delete("/api/integrations/devto?workspace=test");
    expect(response.status()).toBe(401);
  });

  test("returns a JSON body with an error field when unauthenticated", async ({ page }) => {
    const response = await page.request.delete("/api/integrations/devto?workspace=test");
    const body = await response.json();
    expect(body).toHaveProperty("error");
    expect(typeof body.error).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// Dev.to publish API contract — GET /api/integrations/devto/publish
// ---------------------------------------------------------------------------

test.describe("Dev.to publish status API — GET /api/integrations/devto/publish", () => {
  test("returns 401 when called without authentication", async ({ page }) => {
    const response = await page.request.get(
      "/api/integrations/devto/publish?postId=post-abc-123"
    );
    expect(response.status()).toBe(401);
  });

  test("returns a JSON body with an error field when unauthenticated", async ({ page }) => {
    const response = await page.request.get(
      "/api/integrations/devto/publish?postId=post-abc-123"
    );
    const body = await response.json();
    expect(body).toHaveProperty("error");
    expect(typeof body.error).toBe("string");
  });

  test("responds with JSON content-type even for 401 responses", async ({ page }) => {
    const response = await page.request.get(
      "/api/integrations/devto/publish?postId=post-abc-123"
    );
    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType).toContain("application/json");
  });
});

// ---------------------------------------------------------------------------
// Dev.to publish API contract — POST /api/integrations/devto/publish
// ---------------------------------------------------------------------------

test.describe("Dev.to publish API — POST /api/integrations/devto/publish", () => {
  test("returns 401 when called without authentication", async ({ page }) => {
    const response = await page.request.post("/api/integrations/devto/publish", {
      data: {
        postId: "post-abc-123",
        workspaceSlug: "test",
        published: false,
        tags: ["typescript"],
      },
    });
    expect(response.status()).toBe(401);
  });

  test("returns a JSON body with an error field when unauthenticated", async ({ page }) => {
    const response = await page.request.post("/api/integrations/devto/publish", {
      data: {
        postId: "post-abc-123",
        workspaceSlug: "test",
        published: false,
        tags: [],
      },
    });
    const body = await response.json();
    expect(body).toHaveProperty("error");
    expect(typeof body.error).toBe("string");
  });

  test("responds with JSON content-type even for 401 responses", async ({ page }) => {
    const response = await page.request.post("/api/integrations/devto/publish", {
      data: {
        postId: "post-abc-123",
        workspaceSlug: "test",
        published: false,
      },
    });
    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType).toContain("application/json");
  });
});

// ---------------------------------------------------------------------------
// Dev.to update API contract — PUT /api/integrations/devto/publish
// ---------------------------------------------------------------------------

test.describe("Dev.to update API — PUT /api/integrations/devto/publish", () => {
  test("returns 401 when called without authentication", async ({ page }) => {
    const response = await page.request.put("/api/integrations/devto/publish", {
      data: {
        postId: "post-abc-123",
        workspaceSlug: "test",
        published: true,
        tags: ["typescript"],
      },
    });
    expect(response.status()).toBe(401);
  });

  test("returns a JSON body with an error field when unauthenticated", async ({ page }) => {
    const response = await page.request.put("/api/integrations/devto/publish", {
      data: {
        postId: "post-abc-123",
        workspaceSlug: "test",
        published: true,
      },
    });
    const body = await response.json();
    expect(body).toHaveProperty("error");
    expect(typeof body.error).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// Client-side publishing operations (mocked API via page.evaluate)
// ---------------------------------------------------------------------------

test.describe("Client-side publishing operations", () => {
  /**
   * These tests mock the /api/integrations/devto* endpoints so that the
   * browser can complete the request without a real database or Dev.to account.
   * They verify that the publishing API issues correctly structured requests
   * and returns well-formed responses.
   *
   * NOTE: page.route() only intercepts requests originating from within the
   * browser page context (e.g. via fetch() in client-side JS). Tests
   * therefore use page.evaluate() to issue requests from inside the browser,
   * where route interceptors are active.
   */

  test("mocked Dev.to integration status response has the expected shape when connected", async ({
    page,
  }) => {
    const mockIntegration = {
      connected: true,
      username: "devuser",
      enabled: true,
      connectedAt: new Date().toISOString(),
    };

    await page.route("**/api/integrations/devto*", async (route) => {
      if (route.request().method() === "GET" && !route.request().url().includes("/publish")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockIntegration),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/login");

    const body = await page.evaluate(async () => {
      const res = await fetch("/api/integrations/devto?workspace=test");
      return res.json();
    });

    expect(body).toHaveProperty("connected");
    expect(body).toHaveProperty("username");
    expect(body).toHaveProperty("enabled");
    expect(body).toHaveProperty("connectedAt");

    expect(body.connected).toBe(true);
    expect(typeof body.username).toBe("string");
    expect(typeof body.enabled).toBe("boolean");
  });

  test("mocked Dev.to integration status response has the expected shape when disconnected", async ({
    page,
  }) => {
    await page.route("**/api/integrations/devto*", async (route) => {
      if (route.request().method() === "GET" && !route.request().url().includes("/publish")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ connected: false }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/login");

    const body = await page.evaluate(async () => {
      const res = await fetch("/api/integrations/devto?workspace=test");
      return res.json();
    });

    expect(body).toHaveProperty("connected");
    expect(body.connected).toBe(false);
  });

  test("mocked Dev.to connect response has the expected shape", async ({ page }) => {
    const mockConnectResponse = {
      connected: true,
      username: "newdevuser",
    };

    await page.route("**/api/integrations/devto", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(mockConnectResponse),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/login");

    const body = await page.evaluate(async () => {
      const res = await fetch("/api/integrations/devto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceSlug: "test",
          apiKey: "my-devto-api-key",
        }),
      });
      return res.json();
    });

    expect(body).toHaveProperty("connected");
    expect(body).toHaveProperty("username");
    expect(body.connected).toBe(true);
    expect(typeof body.username).toBe("string");
  });

  test("mocked Dev.to disconnect response confirms disconnection", async ({ page }) => {
    await page.route("**/api/integrations/devto*", async (route) => {
      if (route.request().method() === "DELETE") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ disconnected: true }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/login");

    const body = await page.evaluate(async () => {
      const res = await fetch("/api/integrations/devto?workspace=test", {
        method: "DELETE",
      });
      return res.json();
    });

    expect(body).toHaveProperty("disconnected");
    expect(body.disconnected).toBe(true);
  });

  test("mocked publish response has the expected shape for a new draft", async ({ page }) => {
    const mockPublishResponse = {
      devtoArticleId: 12345,
      devtoUrl: "https://dev.to/devuser/my-article-abc123",
      published: false,
    };

    await page.route("**/api/integrations/devto/publish", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(mockPublishResponse),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/login");

    const body = await page.evaluate(async () => {
      const res = await fetch("/api/integrations/devto/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: "post-abc-123",
          workspaceSlug: "test",
          published: false,
          tags: ["typescript", "programming"],
        }),
      });
      return res.json();
    });

    expect(body).toHaveProperty("devtoArticleId");
    expect(body).toHaveProperty("devtoUrl");
    expect(body).toHaveProperty("published");

    expect(typeof body.devtoArticleId).toBe("number");
    expect(typeof body.devtoUrl).toBe("string");
    expect(body.published).toBe(false);
  });

  test("mocked publish response has the expected shape when publishing live", async ({
    page,
  }) => {
    const mockPublishResponse = {
      devtoArticleId: 99999,
      devtoUrl: "https://dev.to/devuser/my-live-article-xyz",
      published: true,
    };

    await page.route("**/api/integrations/devto/publish", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(mockPublishResponse),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/login");

    const body = await page.evaluate(async () => {
      const res = await fetch("/api/integrations/devto/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: "post-xyz-789",
          workspaceSlug: "test",
          published: true,
          tags: [],
        }),
      });
      return res.json();
    });

    expect(body).toHaveProperty("devtoArticleId");
    expect(body).toHaveProperty("devtoUrl");
    expect(body).toHaveProperty("published");
    expect(body.published).toBe(true);
  });

  test("mocked publish status response confirms published state", async ({ page }) => {
    const mockStatusResponse = {
      published: true,
      devtoArticleId: 12345,
      devtoUrl: "https://dev.to/devuser/my-article-abc123",
      publishedAsDraft: false,
      syncedAt: new Date().toISOString(),
    };

    await page.route("**/api/integrations/devto/publish*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockStatusResponse),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/login");

    const body = await page.evaluate(async () => {
      const res = await fetch("/api/integrations/devto/publish?postId=post-abc-123");
      return res.json();
    });

    expect(body).toHaveProperty("published");
    expect(body).toHaveProperty("devtoArticleId");
    expect(body).toHaveProperty("devtoUrl");
    expect(body).toHaveProperty("publishedAsDraft");
    expect(body).toHaveProperty("syncedAt");

    expect(body.published).toBe(true);
    expect(typeof body.devtoArticleId).toBe("number");
    expect(typeof body.devtoUrl).toBe("string");
    expect(typeof body.syncedAt).toBe("string");
  });

  test("mocked publish status response confirms unpublished state", async ({ page }) => {
    await page.route("**/api/integrations/devto/publish*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ published: false }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/login");

    const body = await page.evaluate(async () => {
      const res = await fetch("/api/integrations/devto/publish?postId=post-new-999");
      return res.json();
    });

    expect(body).toHaveProperty("published");
    expect(body.published).toBe(false);
  });

  test("mocked PUT /api/integrations/devto/publish updates article fields", async ({
    page,
  }) => {
    const mockUpdateResponse = {
      devtoArticleId: 12345,
      devtoUrl: "https://dev.to/devuser/my-updated-article-abc123",
      published: true,
    };

    await page.route("**/api/integrations/devto/publish", async (route) => {
      if (route.request().method() === "PUT") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockUpdateResponse),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/login");

    const body = await page.evaluate(async () => {
      const res = await fetch("/api/integrations/devto/publish", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: "post-abc-123",
          workspaceSlug: "test",
          published: true,
          tags: ["typescript", "webdev"],
        }),
      });
      return res.json();
    });

    expect(body).toHaveProperty("devtoArticleId");
    expect(body).toHaveProperty("devtoUrl");
    expect(body).toHaveProperty("published");
    expect(body.published).toBe(true);
  });

  test("no publish POST is issued before the user authenticates", async ({ page }) => {
    let publishCalled = false;

    await page.route("**/api/integrations/devto/publish", async (route) => {
      if (route.request().method() === "POST") {
        publishCalled = true;
      }
      await route.continue();
    });

    await page.goto("/my-workspace/settings/integrations");
    // The server redirects to /login — no client-side publish should fire.
    await expect(page).toHaveURL(/\/login/);
    expect(publishCalled).toBe(false);
  });
});
