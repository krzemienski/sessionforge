import {
  test,
  expect,
  goToLogin,
  fillLoginForm,
  submitLoginForm,
  TEST_USER,
} from "./fixtures";

const MOCK_POSTS = [
  {
    id: "post-abc123",
    title: "How I Built Authentication in 30 Minutes",
    markdown:
      "# Introduction\n\nThis is a blog post about building authentication quickly using modern tools.",
    status: "draft",
    contentType: "blog_post",
    wordCount: 450,
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "post-def456",
    title: "API Rate Limiting: Lessons Learned",
    markdown:
      "# The Problem\n\nRate limiting is crucial for production APIs. Here is what I learned.",
    status: "published",
    contentType: "twitter_thread",
    wordCount: 200,
    updatedAt: new Date(Date.now() - 172800000).toISOString(),
  },
];

const MOCK_INSIGHT = {
  id: "insight-xyz789",
  title: "Efficient Auth Pattern with Better-Auth",
  description:
    "Discovered a pattern for setting up authentication in under 30 minutes using better-auth with Drizzle ORM.",
  category: "tool_pattern_discovery",
  compositeScore: 52,
  noveltyScore: 4,
  toolPatternScore: 5,
  transformationScore: 3,
  failureRecoveryScore: 2,
  reproducibilityScore: 4,
  scaleScore: 3,
  codeSnippets: [],
};

/**
 * Authenticate with the test user and return the workspace slug extracted
 * from the post-login redirect URL.
 */
async function loginAndGetWorkspace(page: any): Promise<string> {
  await goToLogin(page);
  await fillLoginForm(page, TEST_USER.email, TEST_USER.password);
  await submitLoginForm(page);
  await page.waitForURL(
    (url: URL) => !url.pathname.includes("/login"),
    { timeout: 15000 }
  );
  const pathname = new URL(page.url()).pathname;
  return pathname.split("/").filter(Boolean)[0] || "default";
}

test.describe("Content list page", () => {
  test("displays Content heading", async ({ page }) => {
    await page.route(
      (url: URL) => url.pathname === "/api/content",
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ posts: MOCK_POSTS, total: 2 }),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/content`);

    await expect(
      page.getByRole("heading", { name: "Content" })
    ).toBeVisible();
  });

  test("shows status filter tabs: All, Drafts, Published, Archived", async ({
    page,
  }) => {
    await page.route(
      (url: URL) => url.pathname === "/api/content",
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ posts: MOCK_POSTS, total: 2 }),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/content`);

    await expect(page.getByRole("button", { name: "All" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Drafts" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Published" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Archived" })
    ).toBeVisible();
  });

  test("renders content list items with titles", async ({ page }) => {
    await page.route(
      (url: URL) => url.pathname === "/api/content",
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ posts: MOCK_POSTS, total: 2 }),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/content`);

    await expect(
      page.getByText("How I Built Authentication in 30 Minutes")
    ).toBeVisible();
    await expect(
      page.getByText("API Rate Limiting: Lessons Learned")
    ).toBeVisible();
  });

  test("shows content type labels on list items", async ({ page }) => {
    await page.route(
      (url: URL) => url.pathname === "/api/content",
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ posts: MOCK_POSTS, total: 2 }),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/content`);

    await expect(page.getByText("Blog Post")).toBeVisible();
    await expect(page.getByText("Twitter Thread")).toBeVisible();
  });

  test("shows empty state when no content exists", async ({ page }) => {
    await page.route(
      (url: URL) => url.pathname === "/api/content",
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ posts: [], total: 0 }),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/content`);

    await expect(page.getByText(/no content yet/i)).toBeVisible();
  });

  test("clicking status tab filters content by status", async ({ page }) => {
    let lastRequestUrl = "";

    await page.route(
      (url: URL) => url.pathname === "/api/content",
      async (route: any) => {
        lastRequestUrl = route.request().url();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ posts: [], total: 0 }),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/content`);

    await page.getByRole("button", { name: "Drafts" }).click();

    // Wait for the filtered request
    await page.waitForResponse(
      (resp: any) =>
        resp.url().includes("/api/content") &&
        resp.url().includes("status=draft"),
      { timeout: 5000 }
    );

    expect(lastRequestUrl).toContain("status=draft");
  });

  test("clicking a content item navigates to editor", async ({ page }) => {
    await page.route(
      (url: URL) => url.pathname === "/api/content",
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ posts: MOCK_POSTS, total: 2 }),
        });
      }
    );

    await page.route(
      (url: URL) => url.pathname === "/api/content/post-abc123",
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_POSTS[0]),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/content`);

    await page
      .getByText("How I Built Authentication in 30 Minutes")
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/${workspace}/content/post-abc123`)
    );
  });
});

test.describe("Content generation from insight", () => {
  test("insight detail page shows Generate Blog Post button", async ({
    page,
  }) => {
    await page.route(
      (url: URL) => url.pathname === `/api/insights/${MOCK_INSIGHT.id}`,
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_INSIGHT),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/insights/${MOCK_INSIGHT.id}`);

    await expect(
      page.getByRole("button", { name: /generate blog post/i })
    ).toBeVisible();
  });

  test("insight detail page shows Generate Twitter Thread button", async ({
    page,
  }) => {
    await page.route(
      (url: URL) => url.pathname === `/api/insights/${MOCK_INSIGHT.id}`,
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_INSIGHT),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/insights/${MOCK_INSIGHT.id}`);

    await expect(
      page.getByRole("button", { name: /generate twitter thread/i })
    ).toBeVisible();
  });

  test("clicking Generate Blog Post fires POST to /api/agents/blog", async ({
    page,
  }) => {
    let blogApiCalled = false;

    await page.route(
      (url: URL) => url.pathname === `/api/insights/${MOCK_INSIGHT.id}`,
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_INSIGHT),
        });
      }
    );

    await page.route(
      (url: URL) => url.pathname === "/api/agents/blog",
      async (route: any) => {
        blogApiCalled = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ postId: "new-post-123" }),
        });
      }
    );

    await page.route(
      (url: URL) => url.pathname === "/api/content",
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ posts: [], total: 0 }),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/insights/${MOCK_INSIGHT.id}`);

    await page.getByRole("button", { name: /generate blog post/i }).click();

    // Navigation to /content happens immediately (fire-and-forget pattern)
    await expect(page).toHaveURL(
      new RegExp(`/${workspace}/content`),
      { timeout: 5000 }
    );

    // Give the async API call time to complete
    await page.waitForTimeout(500);
    expect(blogApiCalled).toBe(true);
  });

  test("clicking Generate Twitter Thread fires POST to /api/agents/social", async ({
    page,
  }) => {
    let socialApiCalled = false;

    await page.route(
      (url: URL) => url.pathname === `/api/insights/${MOCK_INSIGHT.id}`,
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_INSIGHT),
        });
      }
    );

    await page.route(
      (url: URL) => url.pathname === "/api/agents/social",
      async (route: any) => {
        socialApiCalled = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ postId: "new-post-456" }),
        });
      }
    );

    await page.route(
      (url: URL) => url.pathname === "/api/content",
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ posts: [], total: 0 }),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/insights/${MOCK_INSIGHT.id}`);

    await page
      .getByRole("button", { name: /generate twitter thread/i })
      .click();

    // Navigation to /content happens immediately (fire-and-forget pattern)
    await expect(page).toHaveURL(
      new RegExp(`/${workspace}/content`),
      { timeout: 5000 }
    );

    // Give the async API call time to complete
    await page.waitForTimeout(500);
    expect(socialApiCalled).toBe(true);
  });

  test("insight detail shows insight title as heading", async ({ page }) => {
    await page.route(
      (url: URL) => url.pathname === `/api/insights/${MOCK_INSIGHT.id}`,
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_INSIGHT),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/insights/${MOCK_INSIGHT.id}`);

    await expect(
      page.getByRole("heading", {
        name: "Efficient Auth Pattern with Better-Auth",
      })
    ).toBeVisible();
  });

  test("insight detail shows Dimension Scores section", async ({ page }) => {
    await page.route(
      (url: URL) => url.pathname === `/api/insights/${MOCK_INSIGHT.id}`,
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_INSIGHT),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/insights/${MOCK_INSIGHT.id}`);

    await expect(
      page.getByRole("heading", { name: /dimension scores/i })
    ).toBeVisible();
  });

  test("insight detail back button navigates to insights list", async ({
    page,
  }) => {
    await page.route(
      (url: URL) => url.pathname === `/api/insights/${MOCK_INSIGHT.id}`,
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_INSIGHT),
        });
      }
    );

    await page.route(
      (url: URL) => url.pathname === "/api/insights",
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ insights: [], total: 0 }),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/insights/${MOCK_INSIGHT.id}`);

    await page.getByRole("button", { name: /insights/i }).click();
    await expect(page).toHaveURL(
      new RegExp(`/${workspace}/insights$`)
    );
  });
});
