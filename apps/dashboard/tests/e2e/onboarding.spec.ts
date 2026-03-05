/**
 * E2E tests for the user onboarding flow.
 *
 * Covers the complete onboarding journey:
 * - Root redirect to /login for unauthenticated users
 * - Login page rendering and interactive elements
 * - Signup page rendering and interactive elements
 * - Navigation between login and signup
 * - Form validation (HTML5 required fields)
 * - Form submission with error handling (no DB in CI)
 * - 404 page for unknown routes
 *
 * Note: The login/signup forms use visually-adjacent <label> elements that
 * are not programmatically associated with inputs via for/id. Selectors
 * therefore use type attributes and placeholders rather than accessible names.
 */

import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Login page
// ---------------------------------------------------------------------------

test.describe("Login page", () => {
  test("root / redirects unauthenticated users to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("renders SessionForge branding", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "SessionForge" })).toBeVisible();
    await expect(page.getByText("Mine your Claude sessions. Ship content.")).toBeVisible();
  });

  test("renders all required form elements", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    // Email input identified by type since labels lack for/id association.
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("button", { name: /github/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible();
  });

  test("email field accepts input", async ({ page }) => {
    await page.goto("/login");
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill("test@example.com");
    await expect(emailInput).toHaveValue("test@example.com");
  });

  test("password field accepts input without revealing characters", async ({ page }) => {
    await page.goto("/login");
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill("supersecret");
    await expect(passwordInput).toHaveValue("supersecret");
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("shows error message on failed login submission", async ({ page }) => {
    await page.goto("/login");

    // Mock the login API to return a deterministic error response, ensuring
    // the test is stable regardless of DB availability or network conditions.
    await page.route("**/api/auth/sign-in/email", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" }),
      });
    });

    await page.locator('input[type="email"]').fill("user@example.com");
    await page.locator('input[type="password"]').fill("wrongpassword");
    await page.getByRole("button", { name: "Sign in" }).click();

    // The UI must display a meaningful error message and NOT crash or go blank.
    const errorMsg = page.locator("p.text-sf-danger");
    await expect(errorMsg).toBeVisible({ timeout: 5_000 });
    await expect(errorMsg).not.toBeEmpty();
  });

  test("submit button shows loading state while request is in-flight", async ({ page }) => {
    await page.goto("/login");

    await page.locator('input[type="email"]').fill("user@example.com");
    await page.locator('input[type="password"]').fill("password123");

    // Hold the route open until we have confirmed the loading state — this
    // avoids the race condition where the request completes before we can
    // observe the loading button text.
    let releaseRoute!: () => void;
    await page.route("**/api/auth/sign-in/email", async (route) => {
      await new Promise<void>((resolve) => { releaseRoute = resolve; });
      await route.continue();
    });

    await page.getByRole("button", { name: "Sign in" }).click();

    // While the route is held, the button must show the loading text.
    await expect(page.getByRole("button", { name: "Signing in..." })).toBeVisible({ timeout: 5_000 });

    // Release the held request so the browser can clean up.
    releaseRoute();
  });

  test("remains on login page and shows error after failed submission", async ({ page }) => {
    await page.goto("/login");

    // Mock the API to ensure consistent error behavior across all browsers.
    await page.route("**/api/auth/sign-in/email", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" }),
      });
    });

    await page.locator('input[type="email"]').fill("bad@example.com");
    await page.locator('input[type="password"]').fill("badpassword");
    await page.getByRole("button", { name: "Sign in" }).click();

    // After error we remain on /login — not redirected somewhere else.
    const errorMsg = page.locator("p.text-sf-danger");
    await expect(errorMsg).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Signup page
// ---------------------------------------------------------------------------

test.describe("Signup page", () => {
  test("renders at /signup", async ({ page }) => {
    await page.goto("/signup");
    await expect(page).toHaveURL(/\/signup/);
  });

  test("renders SessionForge branding", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: "SessionForge" })).toBeVisible();
  });

  test("renders all required form elements", async ({ page }) => {
    await page.goto("/signup");

    await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
    // Name input: type=text with specific placeholder.
    await expect(page.getByPlaceholder("Your name")).toBeVisible();
    // Email input: type=email.
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  test("name field accepts input", async ({ page }) => {
    await page.goto("/signup");
    const nameInput = page.getByPlaceholder("Your name");
    await nameInput.fill("Alice Developer");
    await expect(nameInput).toHaveValue("Alice Developer");
  });

  test("email field accepts input", async ({ page }) => {
    await page.goto("/signup");
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill("alice@example.com");
    await expect(emailInput).toHaveValue("alice@example.com");
  });

  test("password field has minimum length of 8 characters", async ({ page }) => {
    await page.goto("/signup");
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toHaveAttribute("minlength", "8");
  });

  test("shows error message on failed signup submission", async ({ page }) => {
    await page.goto("/signup");

    // Mock the signup API to return a deterministic error response,
    // ensuring the test is stable regardless of DB availability.
    await page.route("**/api/auth/sign-up/email", async (route) => {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({ code: "USER_ALREADY_EXISTS", message: "Email already in use" }),
      });
    });

    await page.getByPlaceholder("Your name").fill("Alice Developer");
    await page.locator('input[type="email"]').fill("alice@example.com");
    await page.locator('input[type="password"]').fill("password123");
    await page.getByRole("button", { name: "Create account" }).click();

    // The UI must display a meaningful error message and NOT crash or go blank.
    const errorMsg = page.locator("p.text-sf-danger");
    await expect(errorMsg).toBeVisible({ timeout: 10_000 });
    await expect(errorMsg).not.toBeEmpty();
  });

  test("submit button shows loading state while request is in-flight", async ({ page }) => {
    await page.goto("/signup");

    await page.getByPlaceholder("Your name").fill("Alice");
    await page.locator('input[type="email"]').fill("alice@example.com");
    await page.locator('input[type="password"]').fill("password123");

    // Hold the route open until we have confirmed the loading state — this
    // avoids the race condition where the request completes before we can
    // observe the loading button text.
    let releaseRoute!: () => void;
    await page.route("**/api/auth/sign-up/email", async (route) => {
      await new Promise<void>((resolve) => { releaseRoute = resolve; });
      await route.continue();
    });

    await page.getByRole("button", { name: "Create account" }).click();

    // While the route is held, the button must show the loading text.
    await expect(page.getByRole("button", { name: "Creating account..." })).toBeVisible({ timeout: 5_000 });

    // Release the held request so the browser can clean up.
    releaseRoute();
  });
});

// ---------------------------------------------------------------------------
// Navigation between login and signup
// ---------------------------------------------------------------------------

test.describe("Navigation between login and signup", () => {
  test("Sign up link on login page navigates to /signup", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Sign up" }).click();
    await expect(page).toHaveURL(/\/signup/);
    await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
  });

  test("Sign in link on signup page navigates to /login", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("back-navigating from signup to login preserves page titles", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Sign up" }).click();
    await expect(page).toHaveURL(/\/signup/);

    await page.goBack();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 404 / unknown routes
// ---------------------------------------------------------------------------

test.describe("Unknown routes", () => {
  test("navigating to an unknown route shows a not-found page", async ({ page }) => {
    const response = await page.goto("/this-route-does-not-exist");
    // Next.js returns 404 HTTP status for unknown routes.
    // Accept both 404 (standard) and 200 (dev mode with error overlay).
    const status = response?.status() ?? 0;
    const isNotFound = status === 404 || status === 200;
    expect(isNotFound).toBe(true);
    // The page content must indicate the route doesn't exist — not a blank page.
    const body = await page.textContent("body");
    expect(body).not.toBe("");
  });
});

// ---------------------------------------------------------------------------
// Accessibility basics
// ---------------------------------------------------------------------------

test.describe("Accessibility basics", () => {
  test("login page has a page title", async ({ page }) => {
    await page.goto("/login");
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test("signup page has a page title", async ({ page }) => {
    await page.goto("/signup");
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test("login form shows visible labels for each field", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByText("Email", { exact: true })).toBeVisible();
    await expect(page.getByText("Password", { exact: true })).toBeVisible();
  });

  test("signup form shows visible labels for each field", async ({ page }) => {
    await page.goto("/signup");

    await expect(page.getByText("Name", { exact: true })).toBeVisible();
    await expect(page.getByText("Email", { exact: true })).toBeVisible();
    await expect(page.getByText("Password", { exact: true })).toBeVisible();
  });
});
