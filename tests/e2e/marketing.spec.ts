import { expect, test } from "@playwright/test";

test.describe("marketing site", () => {
  test("landing page renders the hero and claim form", async ({ page, isMobile }) => {
    await page.goto("/");
    // The live page must own exactly one h1; preview cards render a paragraph.
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Everything you are");
    await expect(page.getByLabel("Choose your Plink username").first()).toBeVisible();

    if (isMobile) {
      // Sign-up lives behind the hamburger on small screens.
      await page.getByRole("button", { name: "Open menu" }).click();
    }
    await expect(page.getByRole("link", { name: "Sign up free" }).first()).toBeVisible();
  });

  test("username availability check responds", async ({ page }) => {
    await page.goto("/");
    const input = page.getByLabel("Choose your Plink username").first();
    await input.fill("mayabuilds");
    await expect(page.getByText("Already taken").first()).toBeVisible({ timeout: 10_000 });

    await input.fill("a-name-nobody-has-taken");
    await expect(page.getByText("That one’s free — grab it").first()).toBeVisible({ timeout: 10_000 });
  });

  test("pricing page lists all three plans", async ({ page }) => {
    await page.goto("/pricing");
    for (const plan of ["Free", "Pro", "Studio"]) {
      await expect(page.getByRole("heading", { name: plan, exact: true })).toBeVisible();
    }
  });

  test("templates page links through to a live profile", async ({ page }) => {
    await page.goto("/templates");
    await expect(page.getByRole("heading", { name: "Real pages, not screenshots" })).toBeVisible();
    await page.getByRole("link", { name: "Open" }).first().click();
    await expect(page).toHaveURL(/\/[a-z0-9._-]+$/);
  });

  test("does not scroll horizontally at any width", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe("public profile", () => {
  test("renders a seeded demo creator with a single h1", async ({ page }) => {
    await page.goto("/mayabuilds");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Maya Osei");
    await expect(page.getByText("@mayabuilds")).toBeVisible();
  });

  test("returns a 404 page for an unknown handle", async ({ page }) => {
    const response = await page.goto("/definitely-not-a-real-handle-123");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: /doesn’t exist yet/ })).toBeVisible();
  });
});
