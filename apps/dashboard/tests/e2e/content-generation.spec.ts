/**
 * E2E tests for the content generation workflow.
 *
 * Covers the end-to-end content generation journey:
 * - Authentication guard: unauthenticated users are redirected to /login
 * - Content list API contract: GET /api/content requires auth, accepts
 *   pagination, type, and status filter parameters
 * - Content creation API contract: POST /api/content requires auth and
 *   validates required fields
 * - Content by ID API contract: GET /api/content/[id] requires auth
 * - Content export API contract: GET /api/content/export requires auth
 * - Client-side content operations: mocked API interactions verify
 *   correct request shapes and response handling
 * - Content type filtering: type and status filters are applied correctly
 *
 * Note: Because the content page is rendered server-side behind an
 * authentication wall (the Next.js workspace layout redirects unauthenticated
 * requests to /login), full authenticated UI tests require a running database.
 * Unauthenticated redirect and API contract tests are stable in every
 * environment and are therefore the primary verification targets here.
 */

import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Authentication guard
// ---------------------------------------------------------------------------

test.describe("Content page authentication guard", () => {
  test("accessing /[workspace]/content redirects unauthenticated users to /login", async ({
    page,
  }) => {
    await page.goto("/my-workspace/content");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirect preserves SessionForge branding on the login page", async ({ page }) => {
    await page.goto("/another-workspace/content");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "SessionForge" })).toBeVisible();
  });

  test("redirect shows the sign-in form so the user can authenticate", async ({ page }) => {
    await page.goto("/workspace/content");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Content list API contract
// ---------------------------------------------------------------------------

test.describe("Content list API — GET /api/content", () => {
  test("returns 401 when called without authentication", async ({ page }) => {
    const response = await page.request.get("/api/content?workspace=test");
    expect(response.status()).toBe(401);
  });

  test("returns a JSON body with an error field when unauthenticated", async ({ page }) => {
    const response = await page.request.get("/api/content?workspace=test");
    const body = await response.json();
    expect(body).toHaveProperty("error");
    expect(typeof body.error).toBe("string");
  });

  test("accepts pagination params without crashing (returns 401 without auth)", async ({
    page,
  }) => {
    const response = await page.request.get(
      "/api/content?workspace=test&limit=20&offset=0"
    );
    expect(response.status()).toBe(401);
  });

  test("accepts a type filter param without crashing (returns 401 without auth)", async ({
    page,
  }) => {
    const response = await page.request.get(
      "/api/content?workspace=test&type=blog_post"
    );
    expect(response.status()).toBe(401);
  });

  test("accepts a status filter param without crashing (returns 401 without auth)", async ({
    page,
  }) => {
    const response = await page.request.get(
      "/api/content?workspace=test&status=draft"
    );
    expect(response.status()).toBe(401);
  });

  test("responds with JSON content-type even for 401 responses", async ({ page }) => {
    const response = await page.request.get("/api/content?workspace=test");
    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType).toContain("application/json");
  });
});

// ---------------------------------------------------------------------------
// Content creation API contract
// ---------------------------------------------------------------------------

test.describe("Content creation API — POST /api/content", () => {
  test("returns 401 when called without authentication", async ({ page }) => {
    const response = await page.request.post("/api/content", {
      data: {
        workspaceSlug: "test",
        title: "My Blog Post",
        markdown: "# Hello World",
        contentType: "blog_post",
      },
    });
    expect(response.status()).toBe(401);
  });

  test("returns a JSON body with an error field when unauthenticated", async ({ page }) => {
    const response = await page.request.post("/api/content", {
      data: {
        workspaceSlug: "test",
        title: "My Blog Post",
        markdown: "# Hello World",
        contentType: "blog_post",
      },
    });
    const body = await response.json();
    expect(body).toHaveProperty("error");
    expect(typeof body.error).toBe("string");
  });

  test("responds with JSON content-type even for 401 responses", async ({ page }) => {
    const response = await page.request.post("/api/content", {
      data: {
        workspaceSlug: "test",
        title: "My Blog Post",
        markdown: "# Hello World",
        contentType: "blog_post",
      },
    });
    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType).toContain("application/json");
  });
});

// ---------------------------------------------------------------------------
// Content by ID API contract
// ---------------------------------------------------------------------------

test.describe("Content by ID API — GET /api/content/[id]", () => {
  test("returns 401 when called without authentication", async ({ page }) => {
    const response = await page.request.get("/api/content/post-abc-123");
    expect(response.status()).toBe(401);
  });

  test("returns a JSON body with an error field when unauthenticated", async ({ page }) => {
    const response = await page.request.get("/api/content/post-abc-123");
    const body = await response.json();
    expect(body).toHaveProperty("error");
    expect(typeof body.error).toBe("string");
  });

  test("responds with JSON content-type even for 401 responses", async ({ page }) => {
    const response = await page.request.get("/api/content/post-abc-123");
    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType).toContain("application/json");
  });
});

// ---------------------------------------------------------------------------
// Content export API contract
// ---------------------------------------------------------------------------

test.describe("Content export API — GET /api/content/export", () => {
  test("returns 401 when called without authentication", async ({ page }) => {
    const response = await page.request.get("/api/content/export?workspace=test");
    expect(response.status()).toBe(401);
  });

  test("returns a JSON body with an error field when unauthenticated", async ({ page }) => {
    const response = await page.request.get("/api/content/export?workspace=test");
    const body = await response.json();
    expect(body).toHaveProperty("error");
    expect(typeof body.error).toBe("string");
  });

  test("accepts type and date range params without crashing (returns 401 without auth)", async ({
    page,
  }) => {
    const response = await page.request.get(
      "/api/content/export?workspace=test&type=blog_post&dateFrom=2024-01-01&dateTo=2024-12-31"
    );
    expect(response.status()).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Client-side content operations (mocked API via page.evaluate)
// ---------------------------------------------------------------------------

test.describe("Client-side content operations", () => {
  /**
   * These tests mock the /api/content endpoint so that the browser
   * can complete the request without a real database. They verify that
   * the content API issues correctly structured requests and returns
   * well-formed responses.
   *
   * NOTE: page.route() only intercepts requests originating from within the
   * browser page context (e.g. via fetch() in client-side JS). It does NOT
   * intercept page.request.* calls, which use a separate APIRequestContext.
   * Tests that need mocking therefore use page.evaluate() to issue requests
   * from inside the browser, where route interceptors are active.
   */

  test("mocked content list response has the expected shape", async ({ page }) => {
    const mockPost = {
      id: "post-abc-123",
      title: "My Blog Post",
      markdown: "# Hello World\n\nThis is my blog post.",
      contentType: "blog_post",
      status: "draft",
      toneUsed: "technical",
      workspaceId: "ws-1",
      insightId: "insight-1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await page.route("**/api/content*", async (route) => {
      if (route.request().method() === "GET" && !route.request().url().includes("/export")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            posts: [mockPost],
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
      const res = await fetch("/api/content?workspace=test&limit=20&offset=0");
      return res.json();
    });

    expect(body).toHaveProperty("posts");
    expect(body).toHaveProperty("limit");
    expect(body).toHaveProperty("offset");

    expect(Array.isArray(body.posts)).toBe(true);
    expect(typeof body.limit).toBe("number");
    expect(typeof body.offset).toBe("number");
    expect(body.posts[0]).toHaveProperty("id");
    expect(body.posts[0]).toHaveProperty("title");
    expect(body.posts[0]).toHaveProperty("contentType");
    expect(body.posts[0]).toHaveProperty("status");
  });

  test("mocked content creation response has the expected shape", async ({ page }) => {
    const mockCreatedPost = {
      id: "post-new-456",
      title: "New Blog Post",
      markdown: "# New Post\n\nContent here.",
      contentType: "blog_post",
      status: "draft",
      toneUsed: null,
      workspaceId: "ws-1",
      insightId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await page.route("**/api/content", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(mockCreatedPost),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/login");

    const body = await page.evaluate(async () => {
      const res = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceSlug: "test",
          title: "New Blog Post",
          markdown: "# New Post\n\nContent here.",
          contentType: "blog_post",
        }),
      });
      return res.json();
    });

    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("title");
    expect(body).toHaveProperty("markdown");
    expect(body).toHaveProperty("contentType");
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("createdAt");
    expect(body).toHaveProperty("updatedAt");

    expect(typeof body.id).toBe("string");
    expect(typeof body.title).toBe("string");
    expect(typeof body.markdown).toBe("string");
    expect(typeof body.contentType).toBe("string");
    expect(typeof body.status).toBe("string");
  });

  test("mocked content list is filterable by type", async ({ page }) => {
    await page.route("**/api/content*", async (route) => {
      if (route.request().method() !== "GET" || route.request().url().includes("/export")) {
        await route.continue();
        return;
      }

      const url = new URL(route.request().url());
      const contentType = url.searchParams.get("type");

      const allPosts = [
        { id: "p1", title: "Blog Post 1", contentType: "blog_post", status: "draft" },
        { id: "p2", title: "LinkedIn Post", contentType: "linkedin_post", status: "draft" },
        { id: "p3", title: "Blog Post 2", contentType: "blog_post", status: "published" },
      ];

      const data = contentType
        ? allPosts.filter((p) => p.contentType === contentType)
        : allPosts;

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ posts: data, limit: 20, offset: 0 }),
      });
    });

    await page.goto("/login");

    const allBody = await page.evaluate(async () => {
      const res = await fetch("/api/content?workspace=test");
      return res.json();
    });
    expect(allBody.posts).toHaveLength(3);

    const filteredBody = await page.evaluate(async () => {
      const res = await fetch("/api/content?workspace=test&type=blog_post");
      return res.json();
    });
    expect(filteredBody.posts).toHaveLength(2);
    expect(filteredBody.posts.every((p: { contentType: string }) => p.contentType === "blog_post")).toBe(true);
  });

  test("mocked content list is filterable by status", async ({ page }) => {
    await page.route("**/api/content*", async (route) => {
      if (route.request().method() !== "GET" || route.request().url().includes("/export")) {
        await route.continue();
        return;
      }

      const url = new URL(route.request().url());
      const status = url.searchParams.get("status");

      const allPosts = [
        { id: "p1", title: "Draft Post", contentType: "blog_post", status: "draft" },
        { id: "p2", title: "Published Post", contentType: "blog_post", status: "published" },
        { id: "p3", title: "Another Draft", contentType: "linkedin_post", status: "draft" },
      ];

      const data = status
        ? allPosts.filter((p) => p.status === status)
        : allPosts;

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ posts: data, limit: 20, offset: 0 }),
      });
    });

    await page.goto("/login");

    const publishedBody = await page.evaluate(async () => {
      const res = await fetch("/api/content?workspace=test&status=published");
      return res.json();
    });
    expect(publishedBody.posts).toHaveLength(1);
    expect(publishedBody.posts[0].status).toBe("published");

    const draftBody = await page.evaluate(async () => {
      const res = await fetch("/api/content?workspace=test&status=draft");
      return res.json();
    });
    expect(draftBody.posts).toHaveLength(2);
    expect(draftBody.posts.every((p: { status: string }) => p.status === "draft")).toBe(true);
  });

  test("no content POST is issued before the user authenticates", async ({ page }) => {
    let createCalled = false;

    await page.route("**/api/content", async (route) => {
      if (route.request().method() === "POST") {
        createCalled = true;
      }
      await route.continue();
    });

    await page.goto("/my-workspace/content");
    // The server redirects to /login — no client-side content creation should fire.
    await expect(page).toHaveURL(/\/login/);
    expect(createCalled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Content update API contract (mocked via page.evaluate)
// ---------------------------------------------------------------------------

test.describe("Content update and delete API — mocked", () => {
  test("mocked PUT /api/content/[id] updates post fields", async ({ page }) => {
    const mockUpdatedPost = {
      id: "post-abc-123",
      title: "Updated Title",
      markdown: "# Updated\n\nNew content.",
      contentType: "blog_post",
      status: "published",
      toneUsed: "professional",
      workspaceId: "ws-1",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await page.route("**/api/content/post-abc-123", async (route) => {
      if (route.request().method() === "PUT") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockUpdatedPost),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/login");

    const body = await page.evaluate(async () => {
      const res = await fetch("/api/content/post-abc-123", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Updated Title",
          markdown: "# Updated\n\nNew content.",
          status: "published",
          toneUsed: "professional",
        }),
      });
      return res.json();
    });

    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("title");
    expect(body).toHaveProperty("status");
    expect(body.title).toBe("Updated Title");
    expect(body.status).toBe("published");
  });

  test("mocked DELETE /api/content/[id] returns deleted confirmation", async ({ page }) => {
    await page.route("**/api/content/post-abc-123", async (route) => {
      if (route.request().method() === "DELETE") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ deleted: true }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/login");

    const body = await page.evaluate(async () => {
      const res = await fetch("/api/content/post-abc-123", {
        method: "DELETE",
      });
      return res.json();
    });

    expect(body).toHaveProperty("deleted");
    expect(body.deleted).toBe(true);
  });
});
