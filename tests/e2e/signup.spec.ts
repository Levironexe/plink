import { expect, test } from "@playwright/test";

/** A fresh handle per run so the suite can be re-run without cleanup. */
function uniqueHandle() {
  return `e2e${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`.slice(0, 24);
}

test.describe("sign up and onboarding", () => {
  test("claims a handle, onboards, and publishes a live page", async ({ page }) => {
    const handle = uniqueHandle();

    await page.goto("/");
    await page.getByLabel("Choose your Plink username").first().fill(handle);
    await page.getByRole("button", { name: "Claim" }).first().click();

    await page.waitForURL(`**/signup?username=${handle}`);
    await expect(page.getByLabel("Your Plink")).toHaveValue(handle);

    const form = page.locator("form");
    await form.getByLabel("Email", { exact: true }).fill(`${handle}@plink.test`);
    await form.getByLabel("Password", { exact: true }).fill("supersecret123");
    await page.getByRole("button", { name: "Create my Plink" }).click();

    await page.waitForURL("**/onboarding", { timeout: 20_000 });

    // Step 1 — identity
    await page.getByLabel("Display name").fill("E2E Tester");
    await page.getByLabel("Bio").fill("Automated end-to-end run.");
    await page.getByRole("button", { name: "Designer" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 2 — links
    await page.getByLabel("Link 1 label").fill("My portfolio");
    await page.getByLabel("Link 1 URL").fill("https://example.com/work");
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 3 — socials
    await page.getByRole("button", { name: "Instagram", exact: true }).click();
    await page.getByLabel("Instagram handle").fill("e2etester");
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 4 — theme
    await page.getByRole("button", { name: "Citrus" }).click();
    await page.getByRole("button", { name: "Publish my page" }).click();

    await page.waitForURL("**/dashboard", { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "My page" })).toBeVisible();
    await expect(page.getByText("My portfolio").first()).toBeVisible();

    // The public page reflects everything chosen during onboarding.
    await page.goto(`/${handle}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("E2E Tester");
    await expect(page.getByText("Automated end-to-end run.")).toBeVisible();
    await expect(page.getByRole("link", { name: /My portfolio/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Instagram" })).toBeVisible();
  });

  test("rejects a handle that is already taken", async ({ page }) => {
    await page.goto("/signup?username=mayabuilds");
    await expect(page.getByText("Already taken")).toBeVisible({ timeout: 10_000 });
  });
});
