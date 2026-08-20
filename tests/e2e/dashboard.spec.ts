import { expect, test, type Page } from "@playwright/test";

const DEMO = { email: "maya@plink.demo", password: "plinkdemo123" };

async function login(page: Page) {
  await page.goto("/login");
  // The auth layout also renders a demo profile with its own email field.
  const form = page.locator("form");
  await form.getByLabel("Email", { exact: true }).fill(DEMO.email);
  await form.getByLabel("Password", { exact: true }).fill(DEMO.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/dashboard");
}

test.describe("authenticated dashboard", () => {
  test("logs in and shows the page editor with a live preview", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("heading", { name: "My page" })).toBeVisible();
    await expect(page.getByText("New: my design system course").first()).toBeVisible();
  });

  test("every dashboard section loads", async ({ page }) => {
    await login(page);
    const sections: [string, string][] = [
      ["/dashboard/appearance", "Appearance"],
      ["/dashboard/analytics", "Analytics"],
      ["/dashboard/store", "Store"],
      ["/dashboard/audience", "Audience"],
      ["/dashboard/media-kit", "Media kit"],
      ["/dashboard/settings", "Settings"],
    ];
    for (const [path, heading] of sections) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    }
  });

  test("analytics renders a chart with real data", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard/analytics");
    await expect(page.getByText("Page views")).toBeVisible();
    // The series must actually be drawn, not left clipped to zero width.
    await expect(page.locator("path.recharts-area-curve").first()).toBeVisible({ timeout: 15_000 });
    const clipWidth = await page.evaluate(() => {
      const rect = document.querySelector("clipPath rect");
      return rect ? Number(rect.getAttribute("width")) : 0;
    });
    expect(clipWidth).toBeGreaterThan(100);
  });

  test("redirects anonymous visitors away from the dashboard", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  });
});
