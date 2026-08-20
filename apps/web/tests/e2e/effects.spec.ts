import { expect, test, type Page } from "@playwright/test";

/**
 * These all need the same signed-in creator, and the login endpoint is rate
 * limited on purpose — so the suite signs in once and shares the page rather
 * than burning an attempt per test.
 */
test.describe.configure({ mode: "serial" });

const DEMO = { email: "maya@plink.demo", password: "plinkdemo123" };

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  await page.goto("/login");
  const form = page.locator("form");
  await form.getByLabel("Email", { exact: true }).fill(DEMO.email);
  await form.getByLabel("Password", { exact: true }).fill(DEMO.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/dashboard");
});

test.afterAll(async () => {
  await page.close();
});

/** Choose an effect through the real editor, and wait for the debounced save. */
async function chooseEffect(name: RegExp) {
  await page.goto("/dashboard/appearance");
  await page.getByRole("button", { name: "Effects", exact: true }).click();
  const swatch = page.getByRole("button", { name }).first();
  await swatch.click();
  await expect(swatch).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(1200);
}

test.describe("surface effects", () => {
  test("picking an effect saves it and it reaches every surface", async () => {
    await chooseEffect(/^Shimmer/);

    await page.goto("/mayabuilds");
    const surfaces = page.locator(".pl-fx-shimmer");
    await expect(surfaces.first()).toBeVisible();
    // Links *and* cards, not just buttons.
    expect(await surfaces.count()).toBeGreaterThan(1);
  });

  test("the theme's palette reaches the stylesheet as custom properties", async () => {
    const vars = await page.evaluate(() => {
      const el = document.querySelector(".pl-fx");
      if (!el) return null;
      const style = getComputedStyle(el);
      return {
        accent: style.getPropertyValue("--pl-accent").trim(),
        fgAlpha: style.getPropertyValue("--pl-fg-25").trim(),
      };
    });
    expect(vars?.accent).toMatch(/^#|^rgb/);
    expect(vars?.fgAlpha).toMatch(/^rgba\(/);
  });

  test("an effect animates rather than sitting on one frame", async () => {
    await chooseEffect(/^Border beam/);
    await page.goto("/mayabuilds");
    await expect(page.locator(".pl-fx-border-beam").first()).toBeVisible();

    const angle = () =>
      page.evaluate(() => {
        const el = document.querySelector(".pl-fx-border-beam");
        if (!el) return null;
        return getComputedStyle(el, "::before").backgroundImage.match(/from ([\d.]+)deg/)?.[1] ?? null;
      });

    const first = await angle();
    await page.waitForTimeout(700);
    expect(first).not.toBeNull();
    expect(await angle()).not.toBe(first);
  });

  test("an effect layer never blocks the content behind it", async () => {
    await chooseEffect(/^Aurora/);
    await page.goto("/mayabuilds");

    // The strict case: an animated surface wrapping a live form. If the effect
    // layer caught pointer events this would fail.
    const email = page.getByLabel("Email address").first();
    await email.fill("someone@example.com");
    await expect(email).toHaveValue("someone@example.com");
  });

  test("reduced motion leaves the page still", async () => {
    await chooseEffect(/^Shimmer/);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/mayabuilds");
    await expect(page.locator(".pl-fx-shimmer").first()).toBeVisible();

    const running = await page.evaluate(
      () =>
        document
          .querySelector(".pl-fx-shimmer")!
          .getAnimations({ subtree: true })
          .filter((animation) => animation.playState === "running").length,
    );
    expect(running).toBe(0);
    await page.emulateMedia({ reducedMotion: null });
  });

  test("clearing the effect returns the page to plain surfaces", async () => {
    await page.goto("/dashboard/appearance");
    await page.getByRole("button", { name: "Effects", exact: true }).click();
    await page.getByRole("button", { name: "Clear" }).click();
    await page.waitForTimeout(1200);

    await page.goto("/mayabuilds");
    await expect(page.locator("a[href], .pl-fx").first()).toBeVisible();
    expect(await page.locator(".pl-fx").count()).toBe(0);
  });
});
