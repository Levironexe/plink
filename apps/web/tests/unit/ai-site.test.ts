import { describe, expect, it } from "vitest";
import {
  SITE_AI_LIMITS,
  sanitizeEffectAssignment,
  sanitizeSiteDocument,
  sanitizeSiteTheme,
  siteSystemPrompt,
  siteUserPrompt,
} from "@plink/ai/site";
import { BLOCK_LIBRARY } from "@plink/core/blocks";
import {
  PAGE_KINDS,
  SECTION_KINDS,
  emptyBrief,
  siteDocumentSchema,
  type BriefData,
} from "@plink/core/site-schema";
import { EFFECTS } from "@plink/effects/registry";

/**
 * `sanitizeSiteDocument` is pure — no network, no database, no gateway. Every
 * case below is a plain object standing in for model output, including several
 * a model would never produce but an attacker or a stale row might.
 */

const brandColors = { primary: "#0f172a", accent: "#f97316" };

const validProposal = {
  theme: {
    bgColor: "#FFFDF7",
    textColor: "#0f172a",
    mutedColor: "#6b7280",
    accentColor: "#f97316",
    buttonColor: "#0f172a",
    buttonTextColor: "#ffffff",
    buttonStyle: "outline",
    buttonRadius: "sm",
    fontFamily: "serif",
  },
  effects: { background: "bg-dot-grid" },
  pages: [
    {
      kind: "bio",
      title: "Home",
      path: "/",
      sections: [
        {
          kind: "hero",
          title: "",
          blocks: [
            {
              type: "header",
              title: "Marta Reis",
              subtitle: "Ceramics from Lisbon",
              effects: { text: "text-gradient" },
            },
          ],
          effects: { entrance: "enter-fade-up" },
        },
        {
          kind: "links",
          title: "Start here",
          blocks: [
            {
              type: "link",
              title: "Book a workshop",
              subtitle: "Saturdays in Alfama",
              url: "https://marta.studio/workshops",
              config: {},
            },
            {
              type: "socials",
              title: "Elsewhere",
              config: { items: [{ platform: "instagram", url: "https://instagram.com/marta" }] },
            },
          ],
        },
      ],
    },
    {
      kind: "shop",
      title: "Shop",
      path: "/shop",
      sections: [
        {
          kind: "products",
          title: "Current work",
          blocks: [
            {
              type: "product",
              title: "Stoneware mug",
              subtitle: "€38",
              url: "https://marta.studio/mug",
              imageUrl: "https://cdn.marta.studio/mug.jpg",
            },
          ],
        },
      ],
    },
  ],
};

function sanitize(raw: unknown, template: "editorial" | "storefront" | "portfolio" = "editorial") {
  return sanitizeSiteDocument(raw, template, brandColors);
}

/* --------------------------------------------------------------- round trip */

describe("sanitizeSiteDocument — a valid proposal", () => {
  it("survives the round trip and re-validates against the schema", () => {
    const doc = sanitize(validProposal);
    expect(doc).not.toBeNull();
    expect(siteDocumentSchema.safeParse(doc).success).toBe(true);
  });

  it("keeps the structure the model proposed", () => {
    const doc = sanitize(validProposal)!;
    expect(doc.version).toBe(1);
    expect(doc.pages).toHaveLength(2);
    expect(doc.pages.map((p) => p.kind)).toEqual(["bio", "shop"]);
    expect(doc.pages.map((p) => p.path)).toEqual(["/", "/shop"]);
    expect(doc.pages[0].sections.map((s) => s.kind)).toEqual(["hero", "links"]);
    expect(doc.pages[0].sections[1].blocks.map((b) => b.type)).toEqual(["link", "socials"]);
    expect(doc.pages[1].sections[0].blocks[0].subtitle).toBe("€38");
  });

  it("keeps http(s) urls byte for byte", () => {
    const doc = sanitize(validProposal)!;
    expect(doc.pages[0].sections[1].blocks[0].url).toBe("https://marta.studio/workshops");
    expect(doc.pages[1].sections[0].blocks[0].imageUrl).toBe("https://cdn.marta.studio/mug.jpg");
  });

  it("keeps block config through the shared config sanitiser", () => {
    const doc = sanitize(validProposal)!;
    const socials = doc.pages[0].sections[1].blocks[1];
    expect(socials.config).toEqual({
      items: [{ platform: "instagram", url: "https://instagram.com/marta" }],
    });
  });
});

/* ------------------------------------------------------------- unknown kinds */

describe("sanitizeSiteDocument — unknown vocabulary is dropped", () => {
  it("drops blocks whose type is not in the block library", () => {
    const doc = sanitize({
      pages: [
        {
          kind: "bio",
          title: "Home",
          path: "/",
          sections: [
            {
              kind: "links",
              blocks: [
                { type: "iframe", title: "Definitely fine" },
                { type: "script", title: "Also fine" },
                { type: "link", title: "Real one", url: "https://example.com" },
              ],
            },
          ],
        },
      ],
    })!;
    const blocks = doc.pages[0].sections[0].blocks;
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("link");
  });

  it("drops sections whose kind is not in SECTION_KINDS", () => {
    const doc = sanitize({
      pages: [
        {
          kind: "bio",
          title: "Home",
          path: "/",
          sections: [
            { kind: "newsletter-signup-mega", blocks: [] },
            { kind: "hero", blocks: [] },
          ],
        },
      ],
    })!;
    expect(doc.pages[0].sections.map((s) => s.kind)).toEqual(["hero"]);
  });

  it("drops pages whose kind is not in PAGE_KINDS", () => {
    const doc = sanitize({
      pages: [
        { kind: "checkout", title: "Checkout", path: "/checkout", sections: [] },
        { kind: "bio", title: "Home", path: "/", sections: [] },
      ],
    })!;
    expect(doc.pages).toHaveLength(1);
    expect(doc.pages[0].kind).toBe("bio");
  });

  it("accepts every kind the schema itself declares", () => {
    const doc = sanitize({
      pages: PAGE_KINDS.map((kind, i) => ({
        kind,
        title: kind,
        path: `/${i}`,
        sections: SECTION_KINDS.map((sectionKind) => ({ kind: sectionKind, blocks: [] })),
      })),
    })!;
    expect(doc.pages.map((p) => p.kind)).toEqual([...PAGE_KINDS]);
    expect(doc.pages[0].sections.map((s) => s.kind)).toEqual([...SECTION_KINDS]);
  });

  it("accepts every block type the library declares", () => {
    const doc = sanitize({
      pages: [
        {
          kind: "bio",
          title: "Home",
          path: "/",
          sections: [
            {
              kind: "custom",
              blocks: BLOCK_LIBRARY.slice(0, SITE_AI_LIMITS.maxBlocksPerSection).map((b) => ({
                type: b.type,
                title: b.label,
              })),
            },
          ],
        },
      ],
    })!;
    expect(doc.pages[0].sections[0].blocks).toHaveLength(
      Math.min(BLOCK_LIBRARY.length, SITE_AI_LIMITS.maxBlocksPerSection),
    );
  });
});

/* ------------------------------------------------------------------ template */

describe("sanitizeSiteDocument — the template is ours", () => {
  it("forces the template argument over whatever the input claims", () => {
    const doc = sanitize({ ...validProposal, template: "storefront" }, "portfolio")!;
    expect(doc.template).toBe("portfolio");
  });

  it("falls back to editorial for a template id nobody ships", () => {
    const doc = sanitizeSiteDocument(
      validProposal,
      "brochure" as unknown as "editorial",
      brandColors,
    )!;
    expect(doc.template).toBe("editorial");
  });
});

/* ---------------------------------------------------------------------- urls */

describe("sanitizeSiteDocument — urls", () => {
  const hostile = [
    "javascript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "//evil.example.com",
    "/relative/path",
    "ftp://files.example.com",
    "  javascript:alert(1)  ",
  ];

  it("strips every non-http(s) url to an empty string", () => {
    for (const url of hostile) {
      const doc = sanitize({
        pages: [
          {
            kind: "bio",
            title: "Home",
            path: "/",
            sections: [{ kind: "links", blocks: [{ type: "link", title: "Tap", url }] }],
          },
        ],
      })!;
      expect(doc.pages[0].sections[0].blocks[0].url, url).toBe("");
    }
  });

  it("nulls a non-http image url rather than rendering it", () => {
    const doc = sanitize({
      pages: [
        {
          kind: "bio",
          title: "Home",
          path: "/",
          sections: [
            {
              kind: "gallery",
              blocks: [{ type: "image", title: "Shot", imageUrl: "javascript:alert(1)" }],
            },
          ],
        },
      ],
    })!;
    expect(doc.pages[0].sections[0].blocks[0].imageUrl).toBeNull();
  });

  it("strips hostile urls hiding inside block config", () => {
    const doc = sanitize({
      pages: [
        {
          kind: "bio",
          title: "Home",
          path: "/",
          sections: [
            {
              kind: "links",
              blocks: [
                {
                  type: "socials",
                  title: "Elsewhere",
                  config: {
                    items: [
                      { platform: "x", url: "javascript:alert(1)" },
                      { platform: "instagram", url: "https://instagram.com/ok" },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    })!;
    const items = doc.pages[0].sections[0].blocks[0].config.items as { url: string }[];
    expect(items[0].url).toBe("");
    expect(items[1].url).toBe("https://instagram.com/ok");
  });
});

/* ------------------------------------------------------------------- effects */

describe("sanitizeEffectAssignment", () => {
  it("keeps registry ids that match their target", () => {
    expect(
      sanitizeEffectAssignment({
        surface: "shimmer",
        text: "text-gradient",
        background: "bg-aurora",
        entrance: "enter-fade-up",
      }),
    ).toEqual({
      surface: "shimmer",
      text: "text-gradient",
      background: "bg-aurora",
      entrance: "enter-fade-up",
    });
  });

  it("drops ids the registry has never heard of", () => {
    expect(
      sanitizeEffectAssignment({ surface: "hyperdrive", text: "text-gradient" }),
    ).toEqual({ text: "text-gradient" });
  });

  it("drops a real id filed under the wrong target", () => {
    expect(sanitizeEffectAssignment({ text: "bg-aurora", background: "shimmer" })).toEqual({});
  });

  it("drops `none` and empty values — an assignment, not a picker", () => {
    expect(sanitizeEffectAssignment({ surface: "none", text: "", background: "   " })).toEqual({});
  });

  it("ignores keys that are not effect targets, and non-objects", () => {
    expect(sanitizeEffectAssignment({ onclick: "shimmer", surface: "lift" })).toEqual({
      surface: "lift",
    });
    expect(sanitizeEffectAssignment("shimmer")).toEqual({});
    expect(sanitizeEffectAssignment(null)).toEqual({});
    expect(sanitizeEffectAssignment(["shimmer"])).toEqual({});
  });

  it("accepts every id the registry actually ships", () => {
    for (const effect of EFFECTS) {
      if (effect.id === "none") continue;
      expect(sanitizeEffectAssignment({ [effect.target]: effect.id })).toEqual({
        [effect.target]: effect.id,
      });
    }
  });
});

describe("sanitizeSiteDocument — effects at every level", () => {
  it("filters site, page, section and block assignments alike", () => {
    const doc = sanitize({
      effects: { background: "bg-noise", surface: "not-real" },
      pages: [
        {
          kind: "bio",
          title: "Home",
          path: "/",
          effects: { entrance: "enter-zoom", text: "enter-zoom" },
          sections: [
            {
              kind: "hero",
              effects: { background: "bg-grid", entrance: "made-up" },
              blocks: [{ type: "header", title: "Hi", effects: { text: "text-wave" } }],
            },
          ],
        },
      ],
    })!;
    expect(doc.effects).toEqual({ background: "bg-noise" });
    expect(doc.pages[0].effects).toEqual({ entrance: "enter-zoom" });
    expect(doc.pages[0].sections[0].effects).toEqual({ background: "bg-grid" });
    expect(doc.pages[0].sections[0].blocks[0].effects).toEqual({ text: "text-wave" });
  });
});

/* --------------------------------------------------------------------- theme */

describe("sanitizeSiteTheme", () => {
  it("lowercases hex the model shouted", () => {
    expect(sanitizeSiteTheme({ bgColor: "#FFFDF7" }).bgColor).toBe("#fffdf7");
  });

  it("falls back to the brief's brand colours for the colours they own", () => {
    const theme = sanitizeSiteTheme(
      { textColor: "rebeccapurple", accentColor: "var(--evil)", buttonColor: "" },
      brandColors,
    );
    expect(theme.textColor).toBe("#0f172a");
    expect(theme.buttonColor).toBe("#0f172a");
    expect(theme.accentColor).toBe("#f97316");
  });

  it("falls back to schema defaults when there are no brand colours", () => {
    const theme = sanitizeSiteTheme({});
    expect(theme.bgColor).toBe("#ffffff");
    expect(theme.textColor).toBe("#171717");
    expect(theme.accentColor).toBe("#6d28d9");
    expect(theme.mutedColor).toBe("#888888");
    expect(theme.buttonTextColor).toBe("#ffffff");
  });

  it("refuses css expressions, colour names and injection attempts", () => {
    const theme = sanitizeSiteTheme({
      bgColor: "red; background-image: url(https://evil.example)",
      mutedColor: "rgb(0,0,0)",
      buttonTextColor: "#12345",
    });
    expect(theme.bgColor).toBe("#ffffff");
    expect(theme.mutedColor).toBe("#888888");
    expect(theme.buttonTextColor).toBe("#ffffff");
  });

  it("accepts shorthand hex", () => {
    expect(sanitizeSiteTheme({ accentColor: "#0Af" }).accentColor).toBe("#0af");
  });

  it("picks style, radius and font from vocabularies the renderer knows", () => {
    const theme = sanitizeSiteTheme({
      buttonStyle: "brutalist",
      buttonRadius: "enormous",
      fontFamily: "comic-sans",
    });
    expect(theme.buttonStyle).toBe("solid");
    expect(theme.buttonRadius).toBe("md");
    expect(theme.fontFamily).toBe("sans");
    const kept = sanitizeSiteTheme({ buttonStyle: "glass", buttonRadius: "full", fontFamily: "mono" });
    expect(kept.buttonStyle).toBe("glass");
    expect(kept.buttonRadius).toBe("full");
    expect(kept.fontFamily).toBe("mono");
  });

  it("carries brand colours through the whole document", () => {
    const doc = sanitize({ theme: {}, pages: validProposal.pages })!;
    expect(doc.theme.accentColor).toBe("#f97316");
    expect(doc.theme.textColor).toBe("#0f172a");
  });
});

/* ----------------------------------------------------------------- hopeless */

describe("sanitizeSiteDocument — null only when nothing is salvageable", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "make me a website"],
    ["a number", 42],
    ["an array", [{ kind: "bio" }]],
    ["an empty object", {}],
    ["no pages array", { theme: {}, pages: "lots" }],
    ["an empty pages array", { pages: [] }],
    ["only unknown page kinds", { pages: [{ kind: "checkout", title: "x", path: "/x" }] }],
    ["pages that are not objects", { pages: ["bio", 3, null] }],
  ])("returns null for %s", (_label, raw) => {
    expect(sanitize(raw)).toBeNull();
  });

  it("never throws, whatever it is handed", () => {
    const cyclic: Record<string, unknown> = { pages: [] };
    cyclic.self = cyclic;
    expect(() => sanitize(cyclic)).not.toThrow();
    expect(() => sanitize(new Map())).not.toThrow();
  });

  it("keeps a page that survived even when its siblings did not", () => {
    const doc = sanitize({ pages: [null, { kind: "bio", title: "Home", path: "/" }, 7] })!;
    expect(doc.pages).toHaveLength(1);
  });
});

/* ---------------------------------------------------------------------- ids */

describe("sanitizeSiteDocument — ids are minted, never accepted", () => {
  it("replaces model ids with fresh prefixed ones", () => {
    const doc = sanitize({
      pages: [
        {
          id: "../../etc/passwd",
          kind: "bio",
          title: "Home",
          path: "/",
          sections: [
            {
              id: "sc_evil",
              kind: "hero",
              blocks: [{ id: "bl_evil", type: "header", title: "Hi" }],
            },
          ],
        },
      ],
    })!;
    const page = doc.pages[0];
    expect(page.id).not.toBe("../../etc/passwd");
    expect(page.id).toMatch(/^pg_[a-z0-9]{10}$/);
    expect(page.sections[0].id).toMatch(/^sc_[a-z0-9]{10}$/);
    expect(page.sections[0].blocks[0].id).toMatch(/^bl_[a-z0-9]{10}$/);
  });

  it("gives every node a distinct id", () => {
    const doc = sanitize(validProposal)!;
    const ids = doc.pages.flatMap((p) => [
      p.id,
      ...p.sections.flatMap((s) => [s.id, ...s.blocks.map((b) => b.id)]),
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/* -------------------------------------------------------------- caps & text */

describe("sanitizeSiteDocument — budgets and text", () => {
  it("caps pages, sections and blocks below the schema ceiling", () => {
    const doc = sanitize({
      pages: Array.from({ length: 12 }, (_, i) => ({
        kind: "custom",
        title: `Page ${i}`,
        path: `/p${i}`,
        sections: Array.from({ length: 20 }, () => ({
          kind: "custom",
          blocks: Array.from({ length: 30 }, () => ({ type: "text", title: "x" })),
        })),
      })),
    })!;
    expect(doc.pages).toHaveLength(SITE_AI_LIMITS.maxPages);
    expect(doc.pages[0].sections).toHaveLength(SITE_AI_LIMITS.maxSectionsPerPage);
    expect(doc.pages[0].sections[0].blocks).toHaveLength(SITE_AI_LIMITS.maxBlocksPerSection);
  });

  it("clamps long strings and strips control characters", () => {
    const doc = sanitize({
      pages: [
        {
          kind: "bio",
          title: "H ome",
          path: "/",
          sections: [
            {
              kind: "hero",
              title: "Title",
              blocks: [{ type: "text", title: "a".repeat(900), subtitle: "b".repeat(900) }],
            },
          ],
        },
      ],
    })!;
    expect(doc.pages[0].title).toBe("Home");
    expect(doc.pages[0].sections[0].title).toBe("Title");
    expect(doc.pages[0].sections[0].blocks[0].title).toHaveLength(SITE_AI_LIMITS.blockTitle);
    expect(doc.pages[0].sections[0].blocks[0].subtitle).toHaveLength(SITE_AI_LIMITS.blockSubtitle);
  });

  it("gives an untitled page the title its kind implies", () => {
    const doc = sanitize({ pages: [{ kind: "shop", title: "   ", path: "/shop" }] })!;
    expect(doc.pages[0].title).toBe("Shop");
  });
});

/* --------------------------------------------------------------------- paths */

describe("sanitizeSiteDocument — paths", () => {
  it("coerces a path into the schema's shape rather than dropping the page", () => {
    const doc = sanitize({
      pages: [
        { kind: "shop", title: "Shop", path: "Shop Page!" },
        { kind: "blog", title: "Blog", path: "blog/2026" },
      ],
    })!;
    expect(doc.pages[0].path).toBe("/shop-page");
    expect(doc.pages[1].path).toBe("/blog/2026");
  });

  it("falls back to the kind's canonical path when nothing is usable", () => {
    const doc = sanitize({
      pages: [
        { kind: "bio", title: "Home", path: "!!!" },
        { kind: "blog", title: "Journal", path: 7 },
      ],
    })!;
    expect(doc.pages[0].path).toBe("/");
    expect(doc.pages[1].path).toBe("/blog");
  });

  it("never lets two pages share a path", () => {
    const doc = sanitize({
      pages: [
        { kind: "bio", title: "One", path: "/" },
        { kind: "custom", title: "Two", path: "/" },
        { kind: "shop", title: "Three", path: "/shop" },
        { kind: "shop", title: "Four", path: "/shop" },
      ],
    })!;
    const paths = doc.pages.map((p) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths[0]).toBe("/");
  });

  it("strips a trailing slash so nav entries do not double up", () => {
    const doc = sanitize({ pages: [{ kind: "shop", title: "Shop", path: "/shop/" }] })!;
    expect(doc.pages[0].path).toBe("/shop");
  });
});

/* ------------------------------------------------------------------ prompts */

describe("prompts", () => {
  it("tells the model about every block type, section kind and page kind", () => {
    const prompt = siteSystemPrompt();
    for (const block of BLOCK_LIBRARY) expect(prompt).toContain(`- ${block.type}:`);
    for (const kind of SECTION_KINDS) expect(prompt).toContain(kind);
    for (const kind of PAGE_KINDS) expect(prompt).toContain(kind);
  });

  it("lists every effect id the registry ships, under its own target", () => {
    const prompt = siteSystemPrompt();
    for (const effect of EFFECTS) {
      if (effect.id === "none") continue;
      expect(prompt, effect.id).toContain(effect.id);
    }
  });

  it("composes a user prompt from the brief the operator filled in", () => {
    const brief: BriefData = {
      ...emptyBrief(),
      businessName: "Marta Reis Ceramics",
      tagline: "Wheel-thrown, wood-fired",
      description: "A one-woman studio in Lisbon.",
      category: "Ceramics",
      tone: "minimal",
      pages: ["bio", "shop"],
      products: [{ name: "Stoneware mug", price: "€38", description: "Glazed in ash" }],
      links: [{ label: "Workshops", url: "https://marta.studio/workshops" }],
      socials: [{ platform: "instagram", url: "https://instagram.com/marta" }],
      brandColors,
      contactEmail: "hello@marta.studio",
    };

    const prompt = siteUserPrompt(brief, "storefront");
    expect(prompt).toContain("Template: storefront.");
    expect(prompt).toContain("Marta Reis Ceramics");
    expect(prompt).toContain("Tone: minimal.");
    expect(prompt).toContain("bio, shop");
    expect(prompt).toContain("Stoneware mug — €38 — Glazed in ash");
    expect(prompt).toContain("https://marta.studio/workshops");
    expect(prompt).toContain("instagram: https://instagram.com/marta");
    expect(prompt).toContain("primary #0f172a, accent #f97316");
    expect(prompt).toContain("hello@marta.studio");
  });

  it("omits the sections an empty brief has nothing to say about", () => {
    const prompt = siteUserPrompt(emptyBrief(), "editorial");
    expect(prompt).not.toContain("Products");
    expect(prompt).not.toContain("Socials");
    expect(prompt).toContain("Pages to build");
  });
});
