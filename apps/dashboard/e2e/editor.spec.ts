import {
  test,
  expect,
  goToLogin,
  fillLoginForm,
  submitLoginForm,
  TEST_USER,
} from "./fixtures";

const MOCK_POST = {
  id: "post-abc123",
  title: "How I Built Authentication in 30 Minutes",
  markdown:
    "# Introduction\n\nThis is a blog post about building authentication quickly using modern tools and best practices.",
  status: "draft",
  contentType: "blog_post",
  wordCount: 25,
  updatedAt: new Date(Date.now() - 86400000).toISOString(),
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

test.describe("Content editor page", () => {
  test("renders title input field populated from post data", async ({
    page,
  }) => {
    await page.route(
      (url: URL) => url.pathname === `/api/content/${MOCK_POST.id}`,
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_POST),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/content/${MOCK_POST.id}`);

    const titleInput = page.locator(
      'input[placeholder="Post title..."]'
    );
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toHaveValue(MOCK_POST.title);
  });

  test("title input is editable", async ({ page }) => {
    await page.route(
      (url: URL) => url.pathname === `/api/content/${MOCK_POST.id}`,
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_POST),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/content/${MOCK_POST.id}`);

    const titleInput = page.locator('input[placeholder="Post title..."]');
    await titleInput.clear();
    await titleInput.fill("My Updated Blog Title");
    await expect(titleInput).toHaveValue("My Updated Blog Title");
  });

  test("status selector shows current status", async ({ page }) => {
    await page.route(
      (url: URL) => url.pathname === `/api/content/${MOCK_POST.id}`,
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_POST),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/content/${MOCK_POST.id}`);

    const statusSelect = page.locator("select");
    await expect(statusSelect).toBeVisible();
    await expect(statusSelect).toHaveValue("draft");
  });

  test("status selector has Draft, Published, and Archived options", async ({
    page,
  }) => {
    await page.route(
      (url: URL) => url.pathname === `/api/content/${MOCK_POST.id}`,
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_POST),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/content/${MOCK_POST.id}`);

    const statusSelect = page.locator("select");
    await expect(statusSelect.locator("option[value='draft']")).toBeAttached();
    await expect(
      statusSelect.locator("option[value='published']")
    ).toBeAttached();
    await expect(
      statusSelect.locator("option[value='archived']")
    ).toBeAttached();
  });

  test("changing status selector updates its value", async ({ page }) => {
    await page.route(
      (url: URL) => url.pathname === `/api/content/${MOCK_POST.id}`,
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_POST),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/content/${MOCK_POST.id}`);

    const statusSelect = page.locator("select");
    await statusSelect.selectOption("published");
    await expect(statusSelect).toHaveValue("published");
  });

  test("Save button is visible", async ({ page }) => {
    await page.route(
      (url: URL) => url.pathname === `/api/content/${MOCK_POST.id}`,
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_POST),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/content/${MOCK_POST.id}`);

    await expect(page.getByRole("button", { name: /save/i })).toBeVisible();
  });

  test("Save button triggers PUT to /api/content/:id", async ({ page }) => {
    let saveCalled = false;
    let savedBody: any = null;

    await page.route(
      (url: URL) => url.pathname === `/api/content/${MOCK_POST.id}`,
      async (route: any) => {
        if (route.request().method() === "PUT") {
          saveCalled = true;
          savedBody = JSON.parse(route.request().postData() || "{}");
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ ...MOCK_POST, ...savedBody }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(MOCK_POST),
          });
        }
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/content/${MOCK_POST.id}`);

    await page.getByRole("button", { name: /save/i }).click();

    await page.waitForResponse(
      (resp: any) =>
        resp.url().includes(`/api/content/${MOCK_POST.id}`) &&
        resp.request().method() === "PUT",
      { timeout: 5000 }
    );

    expect(saveCalled).toBe(true);
  });

  test("Save button shows Saving… while request is in flight", async ({
    page,
  }) => {
    await page.route(
      (url: URL) => url.pathname === `/api/content/${MOCK_POST.id}`,
      async (route: any) => {
        if (route.request().method() === "PUT") {
          // Delay to catch loading state
          await new Promise((resolve) => setTimeout(resolve, 800));
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(MOCK_POST),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(MOCK_POST),
          });
        }
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/content/${MOCK_POST.id}`);

    await page.getByRole("button", { name: /save/i }).click();
    await expect(
      page.getByRole("button", { name: /saving/i })
    ).toBeVisible();
  });

  test("displays word count at bottom of editor", async ({ page }) => {
    await page.route(
      (url: URL) => url.pathname === `/api/content/${MOCK_POST.id}`,
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_POST),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/content/${MOCK_POST.id}`);

    // Word count footer should be visible (e.g. "25 words")
    await expect(page.getByText(/words/i)).toBeVisible();
  });

  test("displays content type label at bottom of editor", async ({ page }) => {
    await page.route(
      (url: URL) => url.pathname === `/api/content/${MOCK_POST.id}`,
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_POST),
        });
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/content/${MOCK_POST.id}`);

    // Content type shown at the footer (blog_post → "blog post")
    await expect(page.getByText(/blog post/i)).toBeVisible();
  });

  test("back button navigates to content list", async ({ page }) => {
    await page.route(
      (url: URL) => url.pathname === `/api/content/${MOCK_POST.id}`,
      async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_POST),
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
    await page.goto(`/${workspace}/content/${MOCK_POST.id}`);

    await page.getByRole("button", { name: /content/i }).click();
    await expect(page).toHaveURL(
      new RegExp(`/${workspace}/content$`)
    );
  });

  test("Save button is disabled while a save is in progress", async ({
    page,
  }) => {
    await page.route(
      (url: URL) => url.pathname === `/api/content/${MOCK_POST.id}`,
      async (route: any) => {
        if (route.request().method() === "PUT") {
          await new Promise((resolve) => setTimeout(resolve, 800));
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(MOCK_POST),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(MOCK_POST),
          });
        }
      }
    );

    const workspace = await loginAndGetWorkspace(page);
    await page.goto(`/${workspace}/content/${MOCK_POST.id}`);

    const saveButton = page.getByRole("button", { name: /save/i });
    await saveButton.click();

    // While saving, the button should be disabled
    await expect(
      page.getByRole("button", { name: /saving/i })
    ).toBeDisabled();
  });
});
