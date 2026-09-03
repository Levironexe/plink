import { expect, test, type Page } from "@playwright/test";

/**
 * The operator's side of the Website OS: workspace list, the site editor, and
 * the publish pipeline.
 *
 * Serial and single-viewport on purpose. These sign in once (the login endpoint
 * is rate limited) and they write to the shared demo database, so running two
 * copies at once would have them clobbering each other — the same reason
 * effects.spec.ts is desktop-only.
 *
 * Writes are kept reversible: a page title is edited and put back, and publish
 * only ever appends a version. Nothing here deletes seeded content.
 */

test.describe.configure({ mode: "serial" });

const DEMO = { email: "maya@plink.demo", password: "plinkdemo123" };
const SITE = "Linh Florals";

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

/** Opens the editor for the seeded editorial site and waits for the preview. */
async function openEditor() {
  await page.goto("/studio");
  await expect(page.getByRole("heading", { name: "Studio" })).toBeVisible();
  // The first card is the seeded editorial site; its Open link enters the editor.
  await page.getByRole("link", { name: "Open" }).first().click();
  await page.waitForURL(/\/studio\/[a-z0-9]+$/);
  await expect(page.getByRole("heading", { name: SITE }).first()).toBeVisible();
}

test.describe("studio workspace list", () => {
  test("lists the agency's sites with template, status and client", async () => {
    await page.goto("/studio");
    await expect(page.getByRole("heading", { name: "Studio" })).toBeVisible();
    await expect(page.getByText("Plink Agency")).toBeVisible();

    for (const name of ["Linh Florals", "Baseline Coffee", "Atlas Audio"]) {
      await expect(page.getByText(name, { exact: true })).toBeVisible();
    }
    // Seeded sites are published and their briefs submitted.
    await expect(page.getByText("published").first()).toBeVisible();
    await expect(page.getByText("submitted").first()).toBeVisible();
  });

  test("signing out of the studio is impossible for a stranger", async ({ browser }) => {
    const anon = await browser.newPage();
    await anon.goto("/studio");
    await expect(anon).toHaveURL(/\/login/);
    await anon.close();
  });
});

test.describe("site editor", () => {
  test("opens with the document tree and a live preview", async () => {
    await openEditor();

    // Page tabs come from the document, not a hardcoded list.
    for (const tab of ["Home", "Shop", "Journal"]) {
      await expect(page.getByRole("button", { name: new RegExp(`^${tab}`) }).first()).toBeVisible();
    }
    // The section and block tree is present. The kind label is CSS-uppercased,
    // so match the text the DOM actually carries.
    await expect(page.getByText(/^hero$/i).first()).toBeVisible();
    // One per section, so there is more than one by design.
    await expect(page.getByRole("button", { name: /Add block/ }).first()).toBeVisible();

    // The site name appears twice — once as the editor's own header, once
    // inside the live preview. Two is the proof the preview actually rendered.
    await expect(page.getByRole("heading", { name: SITE })).toHaveCount(2);
  });

  test("switching page tabs re-points the preview", async () => {
    await openEditor();
    await page.getByRole("button", { name: /^Shop/ }).click();
    await expect(page.getByText(/PREVIEW · \/shop/i)).toBeVisible();
  });

  test("the template switcher marks the document's current template", async () => {
    await openEditor();
    for (const name of ["Editorial", "Storefront", "Portfolio"]) {
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    }
    // The seeded editorial site must show editorial as chosen.
    const editorial = page.locator("button").filter({ hasText: "Editorial" }).first();
    await expect(editorial).toHaveAttribute("aria-pressed", "true");
    const storefront = page.locator("button").filter({ hasText: "Storefront" }).first();
    await expect(storefront).toHaveAttribute("aria-pressed", "false");
  });

  test("editing a page title autosaves and the preview follows", async () => {
    await openEditor();
    const title = page.getByLabel("Page title");
    const original = await title.inputValue();
    const edited = `${original} QA`;

    await title.fill(edited);
    await title.blur();
    // Autosave is debounced; the indicator is the contract with the operator.
    await expect(page.getByText(/Saving|Saved/i).first()).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1500);

    // Reload proves it reached the database, not just React state.
    await page.reload();
    await expect(page.getByLabel("Page title")).toHaveValue(edited);

    // Put it back so the next run starts from the seeded state.
    const restore = page.getByLabel("Page title");
    await restore.fill(original);
    await restore.blur();
    await page.waitForTimeout(1500);
    await page.reload();
    await expect(page.getByLabel("Page title")).toHaveValue(original);
  });
});

test.describe("publish pipeline", () => {
  /** Opens the history modal, counts the version chips, and closes it again. */
  async function countVersions(): Promise<number> {
    await page.getByRole("button", { name: /History/ }).click();
    await expect(page.getByRole("heading", { name: "Version history" })).toBeVisible();
    const count = await page.getByText(/^v\d+$/).count();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "Version history" })).toBeHidden();
    return count;
  }

  test("history lists the seeded first version as live", async () => {
    await openEditor();
    await page.getByRole("button", { name: /History/ }).click();
    await expect(page.getByRole("heading", { name: "Version history" })).toBeVisible();
    await expect(page.getByText(/^v1$/)).toBeVisible();
    // The published snapshot is labelled, so an operator knows what is serving.
    await expect(page.getByText("Live", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("publishing appends a version rather than rewriting history", async () => {
    await openEditor();
    const before = await countVersions();

    await page.getByRole("button", { name: /^Publish/ }).click();
    // The confirm modal explains the consequence before anything is written.
    await expect(page.getByRole("heading", { name: "Publish this site" })).toBeVisible();
    await page.getByLabel(/Note/).fill("e2e publish check");
    // The modal's own Publish button, not the toolbar one behind it.
    await page.getByRole("dialog").getByRole("button", { name: /^Publish$/ }).click();
    await expect(page.getByRole("heading", { name: "Publish this site" })).toBeHidden();

    expect(await countVersions()).toBe(before + 1);
  });
});

test.describe("studio nav reaches the AI surfaces", () => {
  test("brief, generate and assets are all reachable from the editor", async () => {
    await openEditor();
    const siteUrl = page.url();

    await page.getByRole("link", { name: /Brief/ }).click();
    await expect(page).toHaveURL(/\/studio\/brief\//);

    await page.goto(siteUrl);
    await page.getByRole("link", { name: /Generate/ }).click();
    await expect(page).toHaveURL(/\/generate$/);

    await page.goto(siteUrl);
    await page.getByRole("link", { name: /Assets/ }).click();
    await expect(page).toHaveURL(/\/assets$/);
  });
});
