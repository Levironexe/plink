import { describe, expect, it } from "vitest";
import {
  SITE_TEMPLATES,
  emptySiteDocument,
  newId,
  type SiteDocument,
} from "@plink/core/site-schema";
import {
  buildSiteNav,
  fx,
  normalizeTemplateId,
  pathFromSegments,
  resolveSitePage,
  siteButtonCss,
  siteDescription,
  siteFontStack,
  siteThemeVars,
} from "@/components/site/site-model";

/** A three-page document shaped like the seeded demo sites. */
function demoDoc(): SiteDocument {
  const doc = emptySiteDocument("editorial");
  doc.pages[0].sections[0].blocks.push({
    id: newId("bl"),
    type: "header",
    title: "Linh Florals",
    subtitle: "Seasonal arrangements from a Saigon studio.",
    url: "",
    imageUrl: null,
    config: {},
    effects: {},
  });
  doc.pages.push(
    { id: newId("pg"), kind: "shop", title: "Shop", path: "/shop", sections: [], effects: {} },
    { id: newId("pg"), kind: "blog", title: "Journal", path: "/blog", sections: [], effects: {} },
  );
  return doc;
}

describe("pathFromSegments", () => {
  it("joins catch-all segments into a rooted path", () => {
    expect(pathFromSegments([])).toBe("/");
    expect(pathFromSegments(["shop"])).toBe("/shop");
    expect(pathFromSegments(["a", "b"])).toBe("/a/b");
  });

  it("decodes URL-encoded segments and drops empties", () => {
    expect(pathFromSegments(["sh%6Fp"])).toBe("/shop");
    expect(pathFromSegments(["", "shop"])).toBe("/shop");
  });
});

describe("resolveSitePage", () => {
  const doc = demoDoc();

  it("resolves the root page for no segments", () => {
    expect(resolveSitePage(doc, [])?.title).toBe("Home");
  });

  it("resolves subpages by path", () => {
    expect(resolveSitePage(doc, ["shop"])?.title).toBe("Shop");
    expect(resolveSitePage(doc, ["blog"])?.title).toBe("Journal");
  });

  it("returns null for unknown or partial paths", () => {
    expect(resolveSitePage(doc, ["nope"])).toBeNull();
    expect(resolveSitePage(doc, ["shop", "extra"])).toBeNull();
  });

  it("forgives trailing slashes in document paths", () => {
    const slashed = demoDoc();
    slashed.pages[1].path = "/shop/";
    expect(resolveSitePage(slashed, ["shop"])?.title).toBe("Shop");
  });
});

describe("buildSiteNav", () => {
  const doc = demoDoc();

  it("lists every page in document order with basePath-prefixed hrefs", () => {
    const nav = buildSiteNav(doc, "/s/demo-linh-florals", "/shop");
    expect(nav.map((i) => i.title)).toEqual(["Home", "Shop", "Journal"]);
    expect(nav.map((i) => i.href)).toEqual([
      "/s/demo-linh-florals",
      "/s/demo-linh-florals/shop",
      "/s/demo-linh-florals/blog",
    ]);
  });

  it("marks exactly the current page", () => {
    const nav = buildSiteNav(doc, "/s/x", "/shop");
    expect(nav.map((i) => i.current)).toEqual([false, true, false]);
    const home = buildSiteNav(doc, "/s/x", "/");
    expect(home.map((i) => i.current)).toEqual([true, false, false]);
  });

  it("keeps the root href sane without a basePath", () => {
    const nav = buildSiteNav(doc, "", "/");
    expect(nav[0].href).toBe("/");
    expect(nav[1].href).toBe("/shop");
  });
});

describe("siteThemeVars", () => {
  const theme = emptySiteDocument("editorial").theme;
  const vars = siteThemeVars(theme) as Record<string, string>;

  it("mirrors the buttonEffectVars contract for pl-fx surfaces", () => {
    expect(vars["--pl-bg"]).toBe(theme.buttonColor);
    expect(vars["--pl-fg"]).toBe(theme.buttonTextColor);
    expect(vars["--pl-accent"]).toBe(theme.accentColor);
    // Default button text is #ffffff — the alpha steps are precomputed rgba.
    expect(vars["--pl-fg-25"]).toBe("rgba(255, 255, 255, 0.25)");
    expect(vars["--pl-accent-30"]).toBe("rgba(109, 40, 217, 0.3)");
  });

  it("exposes site tokens for template CSS", () => {
    expect(vars["--pl-site-bg"]).toBe(theme.bgColor);
    expect(vars["--pl-site-fg"]).toBe(theme.textColor);
    expect(vars["--pl-site-muted"]).toBe(theme.mutedColor);
    expect(vars["--pl-site-accent-10"]).toBe("rgba(109, 40, 217, 0.1)");
    // Unknown radius id ("rounded") falls back to the pill radius.
    expect(vars["--pl-radius"]).toBe("999px");
    expect(vars["--pl-font"]).toContain("sans-serif");
  });
});

describe("siteFontStack", () => {
  it("maps known ids and falls back to sans", () => {
    expect(siteFontStack("serif")).toContain("Georgia");
    expect(siteFontStack("mono")).toContain("monospace");
    expect(siteFontStack("comic")).toBe(siteFontStack("sans"));
  });
});

describe("siteButtonCss", () => {
  const theme = emptySiteDocument("editorial").theme;

  it("renders the default solid style as a fill", () => {
    const css = siteButtonCss(theme);
    expect(css.background).toBe(theme.buttonColor);
    expect(css.color).toBe(theme.buttonTextColor);
    expect(css.border).toBe("none");
  });

  it("respects outline and glass styles", () => {
    const outline = siteButtonCss({ ...theme, buttonStyle: "outline" });
    expect(outline.background).toBe("transparent");
    expect(outline.border).toContain("2px solid");
    const glass = siteButtonCss({ ...theme, buttonStyle: "glass" });
    expect(glass.backdropFilter).toBe("blur(12px)");
  });
});

describe("fx", () => {
  it("returns an empty string for nothing assigned", () => {
    expect(fx(undefined)).toBe("");
    expect(fx({})).toBe("");
  });

  it("composes known surface effects behind the pl-fx base class", () => {
    expect(fx({ surface: "shimmer" })).toBe("pl-fx pl-fx-shimmer");
    expect(fx({ surface: "border-beam" })).toBe("pl-fx pl-fx-border-beam");
  });

  it("treats unknown ids as no-ops so parallel-branch effects degrade safely", () => {
    expect(fx({ background: "definitely-not-an-effect" })).toBe("");
    expect(fx({ surface: "shimmer", text: "not-shipped-yet" })).toBe("pl-fx pl-fx-shimmer");
  });

  it("treats the explicit none id as no effect", () => {
    expect(fx({ surface: "none" })).toBe("");
  });
});

describe("normalizeTemplateId", () => {
  it("keeps every shipped template id", () => {
    for (const id of SITE_TEMPLATES) expect(normalizeTemplateId(id)).toBe(id);
  });

  it("falls back to editorial for unknown, empty or missing ids", () => {
    expect(normalizeTemplateId("brutalist")).toBe("editorial");
    expect(normalizeTemplateId("")).toBe("editorial");
    expect(normalizeTemplateId(undefined)).toBe("editorial");
  });
});

describe("siteDescription", () => {
  it("reads the hero header subtitle as the document's one-liner", () => {
    expect(siteDescription(demoDoc())).toBe("Seasonal arrangements from a Saigon studio.");
  });

  it("returns empty when no hero block carries a subtitle", () => {
    expect(siteDescription(emptySiteDocument("portfolio"))).toBe("");
  });
});
