import { describe, expect, it } from "vitest";
import {
  AI_LIMITS,
  DEFAULT_MODEL,
  aiEnabled,
  modelFor,
  safeHttpUrl,
  sanitizeGeneratedCopy,
  sanitizeGeneratedPage,
  sanitizeGeneratedTheme,
} from "@plink/ai";
import { BLOCK_LIBRARY } from "@plink/core/blocks";
import { THEME_PRESETS } from "@plink/core/themes";
import { effectsForTarget } from "@plink/effects/registry";

/**
 * These tests never touch the network. `sanitizeGeneratedPage` is a pure
 * function, so every case below is a plain object standing in for model output.
 */

const validPage = {
  profile: {
    displayName: "Marta Reis",
    bio: "Ceramicist in Lisbon. I run small studio workshops and write a monthly letter.",
    category: "Artist",
  },
  theme: {
    presetId: "linen",
    buttonStyle: "outline",
    buttonRadius: "sm",
    fontFamily: "serif",
  },
  blocks: [
    {
      type: "link",
      title: "Book a workshop",
      subtitle: "Saturdays in Alfama",
      url: "https://marta.studio/workshops",
      config: {},
    },
    {
      type: "email",
      title: "Monthly letter",
      subtitle: "Kiln notes and new pieces",
      url: "",
      config: { buttonLabel: "Subscribe", placeholder: "you@email.com" },
    },
  ],
};

describe("aiEnabled", () => {
  it("reports disabled when the gateway key is missing or blank", () => {
    const original = process.env.AI_GATEWAY_API_KEY;
    try {
      delete process.env.AI_GATEWAY_API_KEY;
      expect(aiEnabled()).toBe(false);

      process.env.AI_GATEWAY_API_KEY = "   ";
      expect(aiEnabled()).toBe(false);

      process.env.AI_GATEWAY_API_KEY = "vck_example";
      expect(aiEnabled()).toBe(true);
    } finally {
      if (original === undefined) delete process.env.AI_GATEWAY_API_KEY;
      else process.env.AI_GATEWAY_API_KEY = original;
    }
  });
});

describe("modelFor", () => {
  it("routes page generation to the default model and copy to a cheaper one", () => {
    expect(modelFor("page")).toBe(DEFAULT_MODEL);
    expect(modelFor("copy")).not.toBe(DEFAULT_MODEL);
    expect(modelFor("page").startsWith("anthropic/")).toBe(true);
  });
});

describe("safeHttpUrl", () => {
  it("keeps http and https URLs byte-for-byte", () => {
    expect(safeHttpUrl("https://example.com/a?b=c#d")).toBe("https://example.com/a?b=c#d");
    expect(safeHttpUrl("http://example.com")).toBe("http://example.com");
  });

  it("strips everything that is not http(s)", () => {
    for (const bad of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "  javascript:alert(1)  ",
      "data:text/html;base64,PHNjcmlwdD4=",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "//evil.example.com",
      "/dashboard",
      "example.com",
      "",
    ]) {
      expect(safeHttpUrl(bad)).toBe("");
    }
  });

  it("rejects non-strings and absurdly long URLs", () => {
    expect(safeHttpUrl(null)).toBe("");
    expect(safeHttpUrl(42)).toBe("");
    expect(safeHttpUrl({ href: "https://example.com" })).toBe("");
    expect(safeHttpUrl(`https://example.com/${"a".repeat(AI_LIMITS.url)}`)).toBe("");
  });
});

describe("sanitizeGeneratedPage", () => {
  it("passes valid model output through unchanged", () => {
    const page = sanitizeGeneratedPage(validPage);

    expect(page.profile).toEqual(validPage.profile);
    expect(page.blocks).toHaveLength(2);
    expect(page.blocks[0]).toEqual({
      position: 0,
      type: "link",
      title: "Book a workshop",
      subtitle: "Saturdays in Alfama",
      url: "https://marta.studio/workshops",
      config: {},
    });
    expect(page.blocks[1]).toEqual({
      position: 1,
      type: "email",
      title: "Monthly letter",
      subtitle: "Kiln notes and new pieces",
      url: "",
      config: { buttonLabel: "Subscribe", placeholder: "you@email.com" },
    });
  });

  it("resolves the named theme preset and applies the requested overrides", () => {
    const page = sanitizeGeneratedPage(validPage);
    const linen = THEME_PRESETS.find((p) => p.id === "linen")!;

    expect(page.theme.presetId).toBe("linen");
    expect(page.theme.bgColor).toBe(linen.values.bgColor);
    expect(page.theme.buttonStyle).toBe("outline");
    expect(page.theme.buttonRadius).toBe("sm");
    expect(page.theme.fontFamily).toBe("serif");
    // Never model-controlled.
    expect(page.theme.bgImageUrl).toBeNull();
    expect(page.theme.hideBranding).toBe(false);
  });

  it("drops unknown block types", () => {
    const page = sanitizeGeneratedPage({
      ...validPage,
      blocks: [
        { type: "link", title: "Real", subtitle: "", url: "https://example.com" },
        { type: "iframe", title: "Nope", subtitle: "", url: "https://example.com" },
        { type: "script", title: "Also nope", subtitle: "", url: "https://example.com" },
        { type: "", title: "Blank", subtitle: "", url: "" },
        { type: 7, title: "Not a string", subtitle: "", url: "" },
        "not an object",
        null,
        { type: "faq", title: "Questions", subtitle: "", url: "" },
      ],
    });

    expect(page.blocks.map((b) => b.type)).toEqual(["link", "faq"]);
  });

  it("accepts every type in the block library", () => {
    const page = sanitizeGeneratedPage({
      ...validPage,
      blocks: BLOCK_LIBRARY.slice(0, AI_LIMITS.maxBlocks).map((def) => ({
        type: def.type,
        title: def.label,
        subtitle: "",
        url: "",
      })),
    });

    expect(page.blocks).toHaveLength(AI_LIMITS.maxBlocks);
    expect(page.blocks.map((b) => b.type)).toEqual(
      BLOCK_LIBRARY.slice(0, AI_LIMITS.maxBlocks).map((d) => d.type),
    );
  });

  it("strips javascript: and data: URLs but keeps the block", () => {
    const page = sanitizeGeneratedPage({
      ...validPage,
      blocks: [
        { type: "link", title: "XSS", subtitle: "", url: "javascript:alert(document.cookie)" },
        { type: "image", title: "Smuggled", subtitle: "", url: "data:text/html,<script>x</script>" },
        { type: "link", title: "Fine", subtitle: "", url: "https://example.com/ok" },
      ],
    });

    expect(page.blocks).toHaveLength(3);
    expect(page.blocks[0].url).toBe("");
    expect(page.blocks[1].url).toBe("");
    expect(page.blocks[2].url).toBe("https://example.com/ok");
  });

  it("strips unsafe URLs nested inside a block config", () => {
    const page = sanitizeGeneratedPage({
      ...validPage,
      blocks: [
        {
          type: "gallery",
          title: "Work",
          subtitle: "",
          url: "",
          config: {
            items: [
              { label: "One", url: "javascript:alert(1)", imageUrl: "https://cdn.example.com/1.jpg" },
              { label: "Two", url: "https://example.com/two", imageUrl: "data:image/svg+xml,<svg/>" },
            ],
          },
        },
      ],
    });

    const items = page.blocks[0].config.items as Array<Record<string, unknown>>;
    expect(items[0].url).toBe("");
    expect(items[0].imageUrl).toBe("https://cdn.example.com/1.jpg");
    expect(items[1].url).toBe("https://example.com/two");
    expect(items[1].imageUrl).toBe("");
  });

  it("clamps over-long block arrays to the maximum", () => {
    const page = sanitizeGeneratedPage({
      ...validPage,
      blocks: Array.from({ length: 40 }, (_, i) => ({
        type: "link",
        title: `Link ${i}`,
        subtitle: "",
        url: `https://example.com/${i}`,
      })),
    });

    expect(page.blocks).toHaveLength(AI_LIMITS.maxBlocks);
    expect(page.blocks.at(-1)?.title).toBe(`Link ${AI_LIMITS.maxBlocks - 1}`);
  });

  it("resequences positions from zero even when the model supplies its own", () => {
    const page = sanitizeGeneratedPage({
      ...validPage,
      blocks: [
        { type: "link", title: "A", subtitle: "", url: "", position: 99 },
        { type: "nonsense", title: "Dropped", subtitle: "", url: "", position: 100 },
        { type: "link", title: "B", subtitle: "", url: "", position: 4 },
        { type: "link", title: "C", subtitle: "", url: "", position: -3 },
      ],
    });

    expect(page.blocks.map((b) => b.position)).toEqual([0, 1, 2]);
    expect(page.blocks.map((b) => b.title)).toEqual(["A", "B", "C"]);
  });

  it("trims oversized strings down to the field limits", () => {
    const page = sanitizeGeneratedPage({
      profile: {
        displayName: "n".repeat(400),
        bio: "b".repeat(4000),
        category: "c".repeat(400),
      },
      theme: validPage.theme,
      blocks: [
        {
          type: "link",
          title: "t".repeat(900),
          subtitle: "s".repeat(900),
          url: "https://example.com",
          config: { buttonLabel: "l".repeat(4000) },
        },
      ],
    });

    expect(page.profile.displayName).toHaveLength(AI_LIMITS.displayName);
    expect(page.profile.bio).toHaveLength(AI_LIMITS.bio);
    expect(page.profile.category).toHaveLength(AI_LIMITS.category);
    expect(page.blocks[0].title).toHaveLength(AI_LIMITS.title);
    expect(page.blocks[0].subtitle).toHaveLength(AI_LIMITS.subtitle);
    expect(page.blocks[0].config.buttonLabel).toHaveLength(AI_LIMITS.configString);
  });

  it("strips control characters from model text", () => {
    const page = sanitizeGeneratedPage({
      ...validPage,
      profile: { displayName: "Ma\u0000rta\u001b", bio: "Line\u0007one", category: "Artist" },
    });

    expect(page.profile.displayName).toBe("Marta");
    expect(page.profile.bio).toBe("Lineone");
  });

  it("falls back to a real preset when the theme is missing or invented", () => {
    const fallback = THEME_PRESETS[0];

    for (const theme of [undefined, null, "moonlight", { presetId: "vaporwave-deluxe" }, {}]) {
      const page = sanitizeGeneratedPage({ ...validPage, theme });
      expect(page.theme.presetId).toBe(fallback.id);
      expect(page.theme.buttonStyle).toBe(fallback.values.buttonStyle);
    }
  });

  it("ignores colour overrides that are not plain hex", () => {
    const linen = THEME_PRESETS.find((p) => p.id === "linen")!;
    const page = sanitizeGeneratedPage({
      ...validPage,
      theme: {
        ...validPage.theme,
        bgColor: "url(https://evil.example.com/x.png)",
        textColor: "expression(alert(1))",
        accentColor: "#0070F3",
        buttonColor: "rebeccapurple",
      },
    });

    expect(page.theme.bgColor).toBe(linen.values.bgColor);
    expect(page.theme.textColor).toBe(linen.values.textColor);
    expect(page.theme.accentColor).toBe("#0070f3");
    expect(page.theme.buttonColor).toBe(linen.values.buttonColor);
  });

  it("survives garbage without throwing", () => {
    for (const raw of [null, undefined, "", 0, [], "a string", { blocks: "nope" }]) {
      const page = sanitizeGeneratedPage(raw);
      expect(page.blocks).toEqual([]);
      expect(page.profile.displayName).toBe("");
      expect(page.theme.presetId).toBe(THEME_PRESETS[0].id);
    }
  });

  it("never copies prototype-polluting keys out of a config", () => {
    const page = sanitizeGeneratedPage({
      ...validPage,
      blocks: [
        {
          type: "link",
          title: "A",
          subtitle: "",
          url: "",
          config: JSON.parse('{"__proto__":{"polluted":true},"ok":1}'),
        },
      ],
    });

    expect(page.blocks[0].config.ok).toBe(1);
    expect(Object.prototype.hasOwnProperty.call(page.blocks[0].config, "__proto__")).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("is pure — the same input always yields the same output and is not mutated", () => {
    const input = structuredClone(validPage);
    const first = sanitizeGeneratedPage(input);
    const second = sanitizeGeneratedPage(input);

    expect(first).toEqual(second);
    expect(input).toEqual(validPage);
  });
});

describe("sanitizeGeneratedTheme — page effects", () => {
  const themeOf = (effects: Record<string, unknown>) =>
    sanitizeGeneratedTheme({ ...validPage.theme, ...effects });

  it("leaves every page effect off when the model names none", () => {
    const theme = sanitizeGeneratedTheme(validPage.theme);
    expect(theme.bgEffect).toBe("none");
    expect(theme.textEffect).toBe("none");
    expect(theme.entranceEffect).toBe("none");
  });

  it("keeps an id the registry files under that exact target", () => {
    const theme = themeOf({
      bgEffect: "bg-mesh-drift",
      textEffect: "text-shimmer",
      entranceEffect: "enter-stagger",
    });
    expect(theme.bgEffect).toBe("bg-mesh-drift");
    expect(theme.textEffect).toBe("text-shimmer");
    expect(theme.entranceEffect).toBe("enter-stagger");
  });

  it("accepts every id the registry offers for each target", () => {
    for (const effect of effectsForTarget("background")) {
      expect(themeOf({ bgEffect: effect.id }).bgEffect, effect.id).toBe(effect.id);
    }
    for (const effect of effectsForTarget("text")) {
      expect(themeOf({ textEffect: effect.id }).textEffect, effect.id).toBe(effect.id);
    }
    for (const effect of effectsForTarget("entrance")) {
      expect(themeOf({ entranceEffect: effect.id }).entranceEffect, effect.id).toBe(effect.id);
    }
  });

  it("preserves an explicit none", () => {
    const theme = themeOf({ bgEffect: "none", textEffect: "none", entranceEffect: "none" });
    expect(theme.bgEffect).toBe("none");
    expect(theme.textEffect).toBe("none");
    expect(theme.entranceEffect).toBe("none");
  });

  it("drops a real id filed under the wrong target", () => {
    // The interesting attack: every value here names an effect that exists.
    const theme = themeOf({
      bgEffect: "text-glitch",
      textEffect: "enter-zoom",
      entranceEffect: "bg-noise",
    });
    expect(theme.bgEffect).toBe("none");
    expect(theme.textEffect).toBe("none");
    expect(theme.entranceEffect).toBe("none");
  });

  it("drops a surface effect from every page-level target", () => {
    const theme = themeOf({
      bgEffect: "shimmer",
      textEffect: "spotlight",
      entranceEffect: "neon",
    });
    expect(theme.bgEffect).toBe("none");
    expect(theme.textEffect).toBe("none");
    expect(theme.entranceEffect).toBe("none");
  });

  it("drops unknown ids and anything that is not a string", () => {
    const theme = themeOf({
      bgEffect: "bg-drop-tables",
      textEffect: { toString: () => "text-wave" },
      entranceEffect: 7,
    });
    expect(theme.bgEffect).toBe("none");
    expect(theme.textEffect).toBe("none");
    expect(theme.entranceEffect).toBe("none");
  });

  it("never lets an effect id through as a class fragment", () => {
    const theme = themeOf({
      bgEffect: "bg-grid; background: url(javascript:alert(1))",
      textEffect: "pl-fx-text-wave",
      entranceEffect: "enter-fade-up enter-zoom",
    });
    expect(theme.bgEffect).toBe("none");
    expect(theme.textEffect).toBe("none");
    expect(theme.entranceEffect).toBe("none");
  });

  it("keeps one valid target when its siblings are junk", () => {
    const theme = themeOf({
      bgEffect: "bg-dot-grid",
      textEffect: "nonsense",
      entranceEffect: null,
    });
    expect(theme.bgEffect).toBe("bg-dot-grid");
    expect(theme.textEffect).toBe("none");
    expect(theme.entranceEffect).toBe("none");
  });

  it("reaches the page sanitizer, not just the theme one", () => {
    const page = sanitizeGeneratedPage({
      ...validPage,
      theme: { ...validPage.theme, bgEffect: "bg-beams", textEffect: "shimmer" },
    });
    expect(page.theme.bgEffect).toBe("bg-beams");
    expect(page.theme.textEffect).toBe("none");
    expect(page.theme.entranceEffect).toBe("none");
  });
});

describe("sanitizeGeneratedCopy", () => {
  it("clamps the bio, drops empty titles and caps the list", () => {
    const copy = sanitizeGeneratedCopy({
      bio: "b".repeat(1000),
      titles: [...Array.from({ length: 30 }, (_, i) => `Title ${i}`), "", "   "],
    });

    expect(copy.bio).toHaveLength(AI_LIMITS.bio);
    expect(copy.titles).toHaveLength(AI_LIMITS.maxTitles);
    expect(copy.titles.every((t) => t.length > 0)).toBe(true);
  });

  it("returns empty values for garbage", () => {
    expect(sanitizeGeneratedCopy(null)).toEqual({ bio: "", titles: [] });
    expect(sanitizeGeneratedCopy({ titles: "nope" })).toEqual({ bio: "", titles: [] });
  });
});
