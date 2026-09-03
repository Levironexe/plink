import { describe, expect, it } from "vitest";
import { parseSiteDocument, type SiteDocument, type SiteSection } from "@plink/core/site-schema";
import { LIMITS } from "@/app/studio/[siteId]/_lib/document-ops";
import {
  applyAssetToDocument,
  imageTargets,
  isAssetTarget,
  type AssetTarget,
} from "@/app/studio/[siteId]/assets/_lib/apply-asset";

/**
 * Placing a library asset into a site document (`assets/_lib/apply-asset.ts`).
 * Pure functions, so every case is an in/out assertion — no DOM, no database,
 * no network (constitution VI.2).
 *
 * Three invariants are asserted on every mutating case rather than stated once:
 * the input is deep-frozen (a stray write throws in module strict mode) and
 * byte-compared afterwards, and the result still satisfies `parseSiteDocument`
 * — `saveDraft` validates with it, so an op that produces an unsaveable
 * document is a defect.
 */

const URL_A = "https://blob.example.com/u/u1/ai-asset/s1/hero-abc.png";
const URL_B = "https://blob.example.com/u/u1/ai-asset/s1/hero-xyz.png";

/* ------------------------------------------------------------- seed builder */

type BlockSeed = { id: string; type: string; title?: string; imageUrl?: string };
type SectionSeed = { id: string; kind: SiteSection["kind"]; blocks?: BlockSeed[] };
type PageSeed = { id: string; title: string; path: string; sections?: SectionSeed[] };

/** A parsed document from a terse literal, so ids are predictable in assertions. */
function buildDoc(pages: PageSeed[]): SiteDocument {
  return parseSiteDocument({
    version: 1,
    template: "editorial",
    theme: {},
    effects: {},
    pages: pages.map((page) => ({
      id: page.id,
      kind: "custom",
      title: page.title,
      path: page.path,
      sections: (page.sections ?? []).map((section) => ({
        id: section.id,
        kind: section.kind,
        blocks: (section.blocks ?? []).map((block) => ({
          id: block.id,
          type: block.type,
          title: block.title ?? "",
          imageUrl: block.imageUrl ?? null,
        })),
      })),
    })),
  });
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

function expectValid(doc: SiteDocument) {
  expect(() => parseSiteDocument(JSON.parse(JSON.stringify(doc)))).not.toThrow();
}

/**
 * Apply against a frozen input, then assert the input is byte-identical and the
 * output is a saveable document. Every mutating case goes through here.
 */
function apply(doc: SiteDocument, target: AssetTarget, url = URL_A): SiteDocument {
  const before = JSON.stringify(doc);
  const result = applyAssetToDocument(deepFreeze(doc), target, url);
  expect(JSON.stringify(doc)).toBe(before);
  expectValid(result);
  return result;
}

function findBlock(doc: SiteDocument, blockId: string) {
  for (const page of doc.pages) {
    for (const section of page.sections) {
      const block = section.blocks.find((candidate) => candidate.id === blockId);
      if (block) return block;
    }
  }
  return undefined;
}

/** One page, one hero section holding `blocks`, plus a links section after it. */
function pageWithHero(blocks: BlockSeed[]): SiteDocument {
  return buildDoc([
    {
      id: "pg_home",
      title: "Home",
      path: "/",
      sections: [
        { id: "sc_hero", kind: "hero", blocks },
        { id: "sc_links", kind: "links", blocks: [{ id: "bl_link", type: "link", title: "Shop" }] },
      ],
    },
  ]);
}

/* ------------------------------------------------------------ target guard */

describe("isAssetTarget", () => {
  it("accepts the two shapes the action can act on", () => {
    expect(isAssetTarget({ kind: "hero", pageId: "pg_1" })).toBe(true);
    expect(isAssetTarget({ kind: "block", blockId: "bl_1" })).toBe(true);
  });

  it("refuses anything else a public endpoint might be handed", () => {
    expect(isAssetTarget(null)).toBe(false);
    expect(isAssetTarget(undefined)).toBe(false);
    expect(isAssetTarget("hero")).toBe(false);
    expect(isAssetTarget({})).toBe(false);
    expect(isAssetTarget({ kind: "section", sectionId: "sc_1" })).toBe(false);
    expect(isAssetTarget({ kind: "hero" })).toBe(false);
    expect(isAssetTarget({ kind: "hero", pageId: "" })).toBe(false);
    expect(isAssetTarget({ kind: "block", blockId: 7 })).toBe(false);
    // The hero shape's id lives under `pageId`; a block id does not stand in.
    expect(isAssetTarget({ kind: "hero", blockId: "bl_1" })).toBe(false);
  });
});

/* -------------------------------------------------------- hero placement */

describe("applyAssetToDocument — hero", () => {
  it("writes onto the hero's existing image block", () => {
    const doc = pageWithHero([
      { id: "bl_head", type: "header", title: "Clay & Co" },
      { id: "bl_img", type: "image" },
    ]);

    const next = apply(doc, { kind: "hero", pageId: "pg_home" });
    const hero = next.pages[0].sections[0];

    expect(hero.blocks).toHaveLength(2);
    expect(findBlock(next, "bl_img")?.imageUrl).toBe(URL_A);
    // The header keeps its identity — nothing else in the section is rebuilt.
    expect(hero.blocks[0]).toBe(doc.pages[0].sections[0].blocks[0]);
  });

  it("replaces the URL on a block already using the field, whatever its type", () => {
    const doc = pageWithHero([{ id: "bl_text", type: "text", imageUrl: URL_B }]);

    const next = apply(doc, { kind: "hero", pageId: "pg_home" });

    expect(next.pages[0].sections[0].blocks).toHaveLength(1);
    expect(findBlock(next, "bl_text")?.imageUrl).toBe(URL_A);
  });

  it("inserts an image block when the hero section is empty", () => {
    const doc = pageWithHero([]);

    const next = apply(doc, { kind: "hero", pageId: "pg_home" });
    const hero = next.pages[0].sections[0];

    expect(hero.blocks).toHaveLength(1);
    expect(hero.blocks[0]).toMatchObject({
      type: "image",
      imageUrl: URL_A,
      title: "",
      subtitle: "",
      url: "",
    });
    expect(hero.blocks[0].id).toMatch(/^bl_/);
  });

  it("inserts an image block when the hero holds only text the renderer will not paint", () => {
    const doc = pageWithHero([
      { id: "bl_head", type: "header", title: "Clay & Co" },
      { id: "bl_text", type: "text", title: "Studio pottery" },
    ]);

    const next = apply(doc, { kind: "hero", pageId: "pg_home" });
    const hero = next.pages[0].sections[0];

    // The deviation recorded in docs/specs/asset-apply/spec.md: a header block
    // would have stored the URL and drawn nothing.
    expect(hero.blocks.map((block) => block.type)).toEqual(["header", "text", "image"]);
    expect(hero.blocks[2].imageUrl).toBe(URL_A);
    expect(findBlock(next, "bl_head")?.imageUrl).toBeNull();
  });

  it("inserts a hero section at the top when the page has none", () => {
    const doc = buildDoc([
      {
        id: "pg_shop",
        title: "Shop",
        path: "/shop",
        sections: [{ id: "sc_products", kind: "products", blocks: [] }],
      },
    ]);

    const next = apply(doc, { kind: "hero", pageId: "pg_shop" });
    const [hero, products] = next.pages[0].sections;

    expect(next.pages[0].sections).toHaveLength(2);
    expect(hero.kind).toBe("hero");
    expect(hero.id).toMatch(/^sc_/);
    expect(hero.blocks).toHaveLength(1);
    expect(hero.blocks[0]).toMatchObject({ type: "image", imageUrl: URL_A });
    // The section that was already there is carried over untouched.
    expect(products).toBe(doc.pages[0].sections[0]);
  });

  it("targets the first hero section when a page somehow holds two", () => {
    const doc = buildDoc([
      {
        id: "pg_home",
        title: "Home",
        path: "/",
        sections: [
          { id: "sc_hero_a", kind: "hero", blocks: [{ id: "bl_a", type: "image" }] },
          { id: "sc_hero_b", kind: "hero", blocks: [{ id: "bl_b", type: "image" }] },
        ],
      },
    ]);

    const next = apply(doc, { kind: "hero", pageId: "pg_home" });

    expect(findBlock(next, "bl_a")?.imageUrl).toBe(URL_A);
    expect(findBlock(next, "bl_b")?.imageUrl).toBeNull();
  });

  it("leaves the other pages untouched by reference", () => {
    const doc = buildDoc([
      { id: "pg_home", title: "Home", path: "/", sections: [{ id: "sc_hero", kind: "hero" }] },
      { id: "pg_shop", title: "Shop", path: "/shop", sections: [{ id: "sc_p", kind: "products" }] },
    ]);

    const next = apply(doc, { kind: "hero", pageId: "pg_home" });

    expect(next).not.toBe(doc);
    expect(next.pages[1]).toBe(doc.pages[1]);
  });
});

/* ------------------------------------------------------- block placement */

describe("applyAssetToDocument — block", () => {
  it("finds a block nested deep in the tree", () => {
    const doc = buildDoc([
      { id: "pg_home", title: "Home", path: "/", sections: [{ id: "sc_hero", kind: "hero" }] },
      {
        id: "pg_shop",
        title: "Shop",
        path: "/shop",
        sections: [
          { id: "sc_a", kind: "links", blocks: [{ id: "bl_1", type: "link" }] },
          { id: "sc_b", kind: "posts", blocks: [] },
          {
            id: "sc_c",
            kind: "products",
            blocks: [
              { id: "bl_2", type: "product", title: "Mug" },
              { id: "bl_3", type: "product", title: "Bowl" },
            ],
          },
        ],
      },
    ]);

    const next = apply(doc, { kind: "block", blockId: "bl_3" });

    expect(findBlock(next, "bl_3")?.imageUrl).toBe(URL_A);
    expect(findBlock(next, "bl_2")?.imageUrl).toBeNull();
    // Structural sharing: only the page and section on the path are rebuilt.
    expect(next.pages[0]).toBe(doc.pages[0]);
    expect(next.pages[1].sections[0]).toBe(doc.pages[1].sections[0]);
    expect(next.pages[1].sections[2]).not.toBe(doc.pages[1].sections[2]);
  });

  it("replaces a URL that is already there", () => {
    const doc = pageWithHero([{ id: "bl_img", type: "image", imageUrl: URL_B }]);

    const next = apply(doc, { kind: "block", blockId: "bl_img" });

    expect(findBlock(next, "bl_img")?.imageUrl).toBe(URL_A);
  });

  it("writes to any block the operator addresses, not only paintable ones", () => {
    // The picker never offers a bare header, but the algebra stays total: an id
    // that resolves is written, and the caller owns the choice.
    const doc = pageWithHero([{ id: "bl_head", type: "header", title: "Clay & Co" }]);

    const next = apply(doc, { kind: "block", blockId: "bl_head" });

    expect(findBlock(next, "bl_head")?.imageUrl).toBe(URL_A);
    expect(next.pages[0].sections[0].blocks).toHaveLength(1);
  });
});

/* ----------------------------------------------------------------- no-ops */

describe("applyAssetToDocument — unresolved addresses", () => {
  it("hands back the same object for an unknown page id", () => {
    const doc = pageWithHero([{ id: "bl_img", type: "image" }]);
    deepFreeze(doc);

    expect(applyAssetToDocument(doc, { kind: "hero", pageId: "pg_gone" }, URL_A)).toBe(doc);
  });

  it("hands back the same object for an unknown block id", () => {
    const doc = pageWithHero([{ id: "bl_img", type: "image" }]);
    deepFreeze(doc);

    expect(applyAssetToDocument(doc, { kind: "block", blockId: "bl_gone" }, URL_A)).toBe(doc);
  });

  it("hands back the same object when a hero section would exceed the page's cap", () => {
    const sections: SectionSeed[] = Array.from({ length: LIMITS.sectionsPerPage }, (_, i) => ({
      id: `sc_${i}`,
      kind: "links" as const,
      blocks: [],
    }));
    const doc = buildDoc([{ id: "pg_home", title: "Home", path: "/", sections }]);
    deepFreeze(doc);

    expect(applyAssetToDocument(doc, { kind: "hero", pageId: "pg_home" }, URL_A)).toBe(doc);
  });

  it("hands back the same object when an image block would exceed the hero's cap", () => {
    const blocks: BlockSeed[] = Array.from({ length: LIMITS.blocksPerSection }, (_, i) => ({
      id: `bl_${i}`,
      type: "text",
    }));
    const doc = pageWithHero(blocks);
    deepFreeze(doc);

    expect(applyAssetToDocument(doc, { kind: "hero", pageId: "pg_home" }, URL_A)).toBe(doc);
  });

  it("still places into a full hero that already holds an image block", () => {
    const blocks: BlockSeed[] = Array.from({ length: LIMITS.blocksPerSection }, (_, i) => ({
      id: `bl_${i}`,
      type: i === 5 ? "image" : "text",
    }));
    const doc = pageWithHero(blocks);

    const next = apply(doc, { kind: "hero", pageId: "pg_home" });

    expect(next).not.toBe(doc);
    expect(findBlock(next, "bl_5")?.imageUrl).toBe(URL_A);
    expect(next.pages[0].sections[0].blocks).toHaveLength(LIMITS.blocksPerSection);
  });

  it("treats re-placing the same URL as a change, not a no-op", () => {
    // The action reports `result === input` as "that placement no longer
    // exists"; an idempotent second click must not trip that message.
    const doc = pageWithHero([{ id: "bl_img", type: "image", imageUrl: URL_A }]);

    const next = apply(doc, { kind: "hero", pageId: "pg_home" });

    expect(next).not.toBe(doc);
    expect(findBlock(next, "bl_img")?.imageUrl).toBe(URL_A);
  });
});

/* --------------------------------------------------------------- targets */

describe("imageTargets", () => {
  const doc = buildDoc([
    {
      id: "pg_home",
      title: "Home",
      path: "/",
      sections: [
        {
          id: "sc_hero",
          kind: "hero",
          blocks: [
            { id: "bl_head", type: "header", title: "Clay & Co" },
            { id: "bl_cover", type: "image", title: "Cover" },
          ],
        },
        {
          id: "sc_links",
          kind: "links",
          blocks: [
            { id: "bl_link", type: "link", title: "Shop" },
            { id: "bl_note", type: "text", title: "Note", imageUrl: URL_B },
          ],
        },
      ],
    },
    {
      id: "pg_shop",
      title: "Shop",
      path: "/shop",
      sections: [
        {
          id: "sc_products",
          kind: "products",
          blocks: [
            { id: "bl_mug", type: "product", title: "Mug" },
            { id: "bl_untitled", type: "image", title: "" },
          ],
        },
      ],
    },
  ]);

  it("offers one hero entry per page, labelled with the page title", () => {
    const heroes = imageTargets(doc).filter((option) => option.kind === "hero");

    expect(heroes).toEqual([
      { id: "pg_home", label: "Home", kind: "hero" },
      { id: "pg_shop", label: "Shop", kind: "hero" },
    ]);
  });

  it("offers a hero entry for a page that has no hero section yet", () => {
    const bare = buildDoc([{ id: "pg_bare", title: "Bare", path: "/bare", sections: [] }]);

    expect(imageTargets(bare)).toEqual([{ id: "pg_bare", label: "Bare", kind: "hero" }]);
  });

  it("lists image and product blocks, plus any block already using the field", () => {
    const blocks = imageTargets(doc).filter((option) => option.kind === "block");

    expect(blocks.map((option) => option.id)).toEqual([
      "bl_cover",
      "bl_note",
      "bl_mug",
      "bl_untitled",
    ]);
  });

  it("leaves out blocks the renderer would never paint", () => {
    const ids = imageTargets(doc).map((option) => option.id);

    expect(ids).not.toContain("bl_head");
    expect(ids).not.toContain("bl_link");
  });

  it("labels a block with its page and its title, falling back to its type", () => {
    const byId = new Map(imageTargets(doc).map((option) => [option.id, option.label]));

    expect(byId.get("bl_cover")).toBe("Home › Cover");
    expect(byId.get("bl_note")).toBe("Home › Note");
    expect(byId.get("bl_mug")).toBe("Shop › Mug");
    expect(byId.get("bl_untitled")).toBe("Shop › image");
  });

  it("orders by page, hero first, then blocks in section-then-block order", () => {
    expect(imageTargets(doc).map((option) => option.id)).toEqual([
      "pg_home",
      "bl_cover",
      "bl_note",
      "pg_shop",
      "bl_mug",
      "bl_untitled",
    ]);
  });

  it("reads without touching the document", () => {
    const before = JSON.stringify(doc);
    imageTargets(deepFreeze(doc));
    expect(JSON.stringify(doc)).toBe(before);
  });

  it("hands the ids back in the shape the target guard accepts", () => {
    for (const option of imageTargets(doc)) {
      const target: AssetTarget =
        option.kind === "hero"
          ? { kind: "hero", pageId: option.id }
          : { kind: "block", blockId: option.id };

      expect(isAssetTarget(target)).toBe(true);
      // Every offered placement resolves against the document it came from.
      expect(applyAssetToDocument(doc, target, URL_A)).not.toBe(doc);
    }
  });
});
