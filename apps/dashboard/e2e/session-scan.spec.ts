import {
  test,
  expect,
  goToLogin,
  fillLoginForm,
  submitLoginForm,
  TEST_USER,
} from "./fixtures";

const MOCK_SESSIONS = [
  {
    id: "session-abc123",
    projectName: "my-project",
    messageCount: 42,
    filesModified: ["src/app.ts", "src/utils.ts"],
    toolsUsed: ["Write", "Edit", "Bash"],
    durationSeconds: 3600,
    startedAt: new Date(Date.now() - 3600000).toISOString(),
    summary: "Implemented authentication flow with better-auth",
  },
  {
    id: "session-def456",
    projectName: "api-service",
    messageCount: 15,
    filesModified: [],
    toolsUsed: ["Read", "Bash"],
    durationSeconds: 600,
    startedAt: new Date(Date.now() - 7200000).toISOString(),
    summary: "Fixed API rate limiting bug",
  },
];

const MOCK_MESSAGES = [
  {
    role: "human",
    content: "Help me implement authentication",
    timestamp: new Date().toISOString(),
  },
  {
    role: "assistant",
    content: "I'll help you set up authentication using better-auth.",
    timestamp: new Date().toISOString(),
  },
];

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

test.describe("Sessions list page", () => {
  test("displays Sessions heading and Scan Now button", async ({ page }) => {
    await page.route(
      (url: URL) => url.pathname === "/api/sessions",
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ sessions: MOCK_SESSIONS, total: 2 }),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/sessions`);

    await expect(page.getByRole("heading", { name: "Sessions" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /scan now/i })
    ).toBeVisible();
  });

  test("renders session list items with project names", async ({ page }) => {
    await page.route(
      (url: URL) => url.pathname === "/api/sessions",
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ sessions: MOCK_SESSIONS, total: 2 }),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/sessions`);

    await expect(page.getByText("my-project")).toBeVisible();
    await expect(page.getByText("api-service")).toBeVisible();
  });

  test("shows project filter input field", async ({ page }) => {
    await page.route(
      (url: URL) => url.pathname === "/api/sessions",
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ sessions: MOCK_SESSIONS, total: 2 }),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/sessions`);

    await expect(
      page.getByPlaceholder(/filter by project/i)
    ).toBeVisible();
  });

  test("shows empty state when no sessions exist", async ({ page }) => {
    await page.route(
      (url: URL) => url.pathname === "/api/sessions",
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ sessions: [], total: 0 }),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/sessions`);

    await expect(page.getByText(/no sessions found/i)).toBeVisible();
  });

  test("Scan Now button triggers POST to /api/sessions/scan", async ({
    page,
  }) => {
    let scanCalled = false;

    await page.route(
      (url: URL) => url.pathname === "/api/sessions",
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ sessions: [], total: 0 }),
        });
      }
    );

    await page.route(
      (url: URL) => url.pathname === "/api/sessions/scan",
      async (route: any) => {
        scanCalled = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ imported: 3 }),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/sessions`);

    await page.getByRole("button", { name: /scan now/i }).click();
    await page.waitForResponse(
      (resp: any) => resp.url().includes("/api/sessions/scan"),
      { timeout: 10000 }
    );

    expect(scanCalled).toBe(true);
  });

  test("Scan Now button shows Scanning… while pending", async ({ page }) => {
    await page.route(
      (url: URL) => url.pathname === "/api/sessions",
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ sessions: [], total: 0 }),
        });
      }
    );

    await page.route(
      (url: URL) => url.pathname === "/api/sessions/scan",
      async (route: any) => {
        // Delay to allow the loading state to be rendered
        await new Promise((resolve) => setTimeout(resolve, 800));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ imported: 0 }),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/sessions`);

    await page.getByRole("button", { name: /scan now/i }).click();
    await expect(
      page.getByRole("button", { name: /scanning/i })
    ).toBeVisible();
  });

  test("clicking a session item navigates to session detail page", async ({
    page,
  }) => {
    await page.route(
      (url: URL) => url.pathname === "/api/sessions",
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ sessions: MOCK_SESSIONS, total: 2 }),
        });
      }
    );

    await page.route(
      (url: URL) => url.pathname === "/api/sessions/session-abc123",
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_SESSIONS[0]),
        });
      }
    );

    await page.route(
      (url: URL) =>
        url.pathname === "/api/sessions/session-abc123/messages",
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ messages: MOCK_MESSAGES }),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/sessions`);

    await page.getByText("my-project").first().click();
    await expect(page).toHaveURL(
      new RegExp(`/${workspace}/sessions/session-abc123`)
    );
  });

  test("displays session summary text in list item", async ({ page }) => {
    await page.route(
      (url: URL) => url.pathname === "/api/sessions",
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ sessions: MOCK_SESSIONS, total: 2 }),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/sessions`);

    await expect(
      page.getByText("Implemented authentication flow with better-auth")
    ).toBeVisible();
  });
});

test.describe("Session detail page", () => {
  test("shows session project name as heading", async ({ page }) => {
    await page.route(
      (url: URL) => url.pathname === "/api/sessions/session-abc123",
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_SESSIONS[0]),
        });
      }
    );

    await page.route(
      (url: URL) =>
        url.pathname === "/api/sessions/session-abc123/messages",
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ messages: MOCK_MESSAGES }),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/sessions/session-abc123`);

    await expect(
      page.getByRole("heading", { name: "my-project" })
    ).toBeVisible();
  });

  test("shows conversation messages from the session", async ({ page }) => {
    await page.route(
      (url: URL) => url.pathname === "/api/sessions/session-abc123",
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_SESSIONS[0]),
        });
      }
    );

    await page.route(
      (url: URL) =>
        url.pathname === "/api/sessions/session-abc123/messages",
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ messages: MOCK_MESSAGES }),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/sessions/session-abc123`);

    await expect(
      page.getByText("Help me implement authentication")
    ).toBeVisible();
    await expect(
      page.getByText(/I'll help you set up authentication/)
    ).toBeVisible();
  });

  test("shows Extract Insights button on session detail", async ({ page }) => {
    await page.route(
      (url: URL) => url.pathname === "/api/sessions/session-abc123",
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_SESSIONS[0]),
        });
      }
    );

    await page.route(
      (url: URL) =>
        url.pathname === "/api/sessions/session-abc123/messages",
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ messages: [] }),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/sessions/session-abc123`);

    await expect(
      page.getByRole("button", { name: /extract insights/i })
    ).toBeVisible();
  });

  test("back button navigates to sessions list", async ({ page }) => {
    await page.route(
      (url: URL) => url.pathname === "/api/sessions/session-abc123",
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_SESSIONS[0]),
        });
      }
    );

    await page.route(
      (url: URL) =>
        url.pathname === "/api/sessions/session-abc123/messages",
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ messages: [] }),
        });
      }
    );

    await page.route(
      (url: URL) => url.pathname === "/api/sessions",
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ sessions: [], total: 0 }),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/sessions/session-abc123`);

    await page.getByRole("button", { name: /sessions/i }).click();
    await expect(page).toHaveURL(
      new RegExp(`/${workspace}/sessions$`)
    );
  });

  test("displays tool tags for tools used in session", async ({ page }) => {
    await page.route(
      (url: URL) => url.pathname === "/api/sessions/session-abc123",
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_SESSIONS[0]),
        });
      }
    );

    await page.route(
      (url: URL) =>
        url.pathname === "/api/sessions/session-abc123/messages",
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ messages: [] }),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/sessions/session-abc123`);

    await expect(page.getByText("Write")).toBeVisible();
    await expect(page.getByText("Edit")).toBeVisible();
    await expect(page.getByText("Bash")).toBeVisible();
  });
});
