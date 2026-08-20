import { expect, test } from "@playwright/test";

const PATHS = ["/", "/pricing", "/templates", "/explore", "/mayabuilds", "/login"];

test.describe("responsive layout", () => {
  for (const path of PATHS) {
    test(`${path} fits the viewport without horizontal scroll`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(1);
    });
  }

  test("mobile nav opens and closes", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile-only behaviour");
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("link", { name: "Sign up free" })).toBeVisible();
    await page.getByRole("button", { name: "Close menu" }).click();
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
  });
});
