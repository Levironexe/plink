import { expect, test } from "@playwright/test";

/**
 * The public site renderer — the half of the Website OS a client's visitors
 * actually see. These read the three seeded demo sites and never write, so they
 * are safe to run in both viewport projects and alongside anything else.
 *
 * The claim under test is the plan's hardest one: three visibly different
 * websites out of one schema, with no per-client code.
 */

const SITES = {
  editorial: { slug: "demo-linh-florals", name: "Linh Florals" },
  storefront: { slug: "demo-baseline-coffee", name: "Baseline Coffee" },
  portfolio: { slug: "demo-atlas-audio", name: "Atlas Audio" },
} as const;

test.describe("published sites render", () => {
  for (const [template, site] of Object.entries(SITES)) {
    test(`the ${template} template serves its site`, async ({ page }) => {
      await page.goto(`/s/${site.slug}`);
      await expect(page.getByRole("heading", { name: site.name, level: 1 })).toBeVisible();
      // The document's own name reaches the tab, not a generic app title.
      await expect(page).toHaveTitle(new RegExp(site.name));
    });
  }

  test("every template navigates to its other pages", async ({ page }) => {
    for (const site of Object.values(SITES)) {
      await page.goto(`/s/${site.slug}`);
      await page.getByRole("link", { name: /^Shop$/i }).first().click();
      await expect(page).toHaveURL(new RegExp(`/s/${site.slug}/shop$`));
      await page.getByRole("link", { name: /^Journal$/i }).first().click();
      await expect(page).toHaveURL(new RegExp(`/s/${site.slug}/blog$`));
    }
  });

  test("the current page is the only one marked current", async ({ page }) => {
    await page.goto(`/s/${SITES.editorial.slug}/shop`);
    const current = page.locator('[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toHaveText(/Shop/i);
  });
});

test.describe("one schema, three distinct interfaces", () => {
  /** Structure, not colour: the templates must differ in the DOM they emit. */
  test("each template lays the same document out differently", async ({ page }) => {
    const shapes: Record<string, string> = {};

    for (const [template, site] of Object.entries(SITES)) {
      await page.goto(`/s/${site.slug}`);
      shapes[template] = await page.evaluate(() => {
        const root = document.querySelector("main") ?? document.body;
        // A coarse structural fingerprint: the tag path of the first few
        // elements plus where the nav sits relative to the heading.
        const nav = document.querySelector("nav");
        const h1 = document.querySelector("h1");
        const navBeforeHeading =
          nav && h1 ? !!(nav.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING) : false;
        return JSON.stringify({
          navBeforeHeading,
          depth: root.querySelectorAll("*").length > 0,
          firstTags: Array.from(root.querySelectorAll("*"))
            .slice(0, 12)
            .map((el) => el.tagName)
            .join(">"),
        });
      });
    }

    expect(shapes.editorial).not.toBe(shapes.storefront);
    expect(shapes.storefront).not.toBe(shapes.portfolio);
    expect(shapes.editorial).not.toBe(shapes.portfolio);
  });

  test("each template applies its own theme palette", async ({ page }) => {
    const accents = new Set<string>();
    for (const site of Object.values(SITES)) {
      await page.goto(`/s/${site.slug}`);
      accents.add(
        await page.evaluate(() => {
          const el = document.querySelector<HTMLElement>("[style*='--pl-accent']") ?? document.body;
          return getComputedStyle(el).getPropertyValue("--pl-accent").trim();
        }),
      );
    }
    // Three seeded sites, three different accents — the theme is document-driven.
    expect(accents.size).toBe(3);
  });
});

test.describe("what must never be served", () => {
  test("an unknown slug is a 404, not a crash", async ({ page }) => {
    const response = await page.goto("/s/no-such-site-anywhere");
    expect(response?.status()).toBe(404);
  });

  test("a page path the document does not define is a 404", async ({ page }) => {
    const response = await page.goto(`/s/${SITES.editorial.slug}/not-a-page`);
    expect(response?.status()).toBe(404);
  });
});
