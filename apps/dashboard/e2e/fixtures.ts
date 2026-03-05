import { test as base, expect, type Page } from "@playwright/test";

export type TestUser = {
  email: string;
  password: string;
  name: string;
};

export type LoginFixtures = {
  loginPage: Page;
  testUser: TestUser;
};

export const TEST_USER: TestUser = {
  email: "test@example.com",
  password: "password123",
  name: "Test User",
};

export const INVALID_USER: TestUser = {
  email: "notreal@example.com",
  password: "wrongpassword",
  name: "Invalid User",
};

/**
 * Navigate to the login page and wait for it to be ready.
 */
export async function goToLogin(page: Page): Promise<void> {
  await page.goto("/login");
  await page.waitForSelector("form", { state: "visible" });
}

/**
 * Fill the login form with the given credentials.
 */
export async function fillLoginForm(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.getByRole("textbox", { name: /email/i }).fill(email);
  await page.getByRole("textbox", { name: /password/i }).fill(password);
}

/**
 * Submit the login form by clicking the submit button.
 */
export async function submitLoginForm(page: Page): Promise<void> {
  await page.getByRole("button", { name: /sign in/i }).click();
}

export const test = base.extend<LoginFixtures>({
  loginPage: async ({ page }, use) => {
    await goToLogin(page);
    await use(page);
  },
  testUser: async ({}, use) => {
    await use(TEST_USER);
  },
});

export { expect };
