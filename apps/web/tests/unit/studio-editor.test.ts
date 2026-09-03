import { describe, expect, it } from "vitest";
import {
  emptySiteDocument,
  parseSiteDocument,
  SECTION_KINDS,
  SITE_TEMPLATES,
  type SiteDocument,
} from "@plink/core/site-schema";
import { BLOCK_LIBRARY, blockDefinition } from "@plink/core/blocks";
import {
  LIMITS,
  addBlock,
  addPage,
  addSection,
  countEffects,
  findPage,
  isSiteTemplate,
  moveBlock,
  moveSection,
  normalizePagePath,
  readEffects,
  removeBlock,
  removePage,
  removeSection,
  renameSection,
  setEffect,
  switchDocumentTemplate,
  targetsForLevel,
  uniquePagePath,
  updateBlock,
  updatePage,
  type EffectScope,
} from "@/app/studio/[siteId]/_lib/document-ops";

/**
 * The studio's document algebra (`_lib/document-ops.ts`). Pure functions over a
 * `SiteDocument`, so every case here is a plain in/out assertion — no DOM, no
 * database, no server (constitution VI.2).
 *
 * Two invariants are asserted everywhere rather than stated once: the result
 * still satisfies `parseSiteDocument` (the store validates with it, so an op
 * that produces an unsaveable document is a defect), and the input document is
 * never mutated (the editor keeps the previous value for optimistic rollback).
 */

/** A document with one root page, two sections and a couple of blocks. */
function seed(): SiteDocument {
  let doc = emptySiteDocument("editorial");
  const pageId = doc.pages[0].id;
  const [hero, links] = doc.pages[0].sections;
  doc = addBlock(doc, pageId, hero.id, blockDefinition("header")!);
  doc = addBlock(doc, pageId, links.id, blockDefinition("link")!);
  doc = addBlock(doc, pageId, links.id, blockDefinition("text")!);
  return doc;
}

function rootPageId(doc: SiteDocument) {
  return doc.pages[0].id;
}

function expectValid(doc: SiteDocument) {
  expect(() => parseSiteDocument(JSON.parse(JSON.stringify(doc)))).not.toThrow();
}

describe("path normalisation", () => {
  it("roots, lowercases and folds illegal characters", () => {
    expect(normalizePagePath("Shop")).toBe("/shop");
    expect(normalizePagePath("  Fall Drop  ")).toBe("/fall-drop");
    expect(normalizePagePath("/Blog/Posts")).toBe("/blog/posts");
    expect(normalizePagePath("/café ~menu!")).toBe("/caf-menu");
  });

  it("collapses repeats and drops a trailing slash, but keeps the root", () => {
    expect(normalizePagePath("//shop//fall//")).toBe("/shop/fall");
    expect(normalizePagePath("/shop---fall")).toBe("/shop-fall");
    expect(normalizePagePath("/")).toBe("/");
    expect(normalizePagePath("")).toBe("/");
  });

  it("hands back a free path, or suffixes until one is free", () => {
    let doc = addPage(seed(), "shop");
    doc = addPage(doc, "blog");
    expect(uniquePagePath(doc, "/press")).toBe("/press");
    expect(uniquePagePath(doc, "Shop")).toBe("/shop-2");
    // A page editing its own path is not a collision with itself.
    expect(uniquePagePath(doc, "/shop", doc.pages[1].id)).toBe("/shop");
  });

  it("always produces a path the schema accepts", () => {
    const doc = seed();
    for (const raw of ["Shop", "///", "A B C", "%%%", "  ", "ÜBER uns", "x".repeat(400)]) {
      const next = updatePage(doc, rootPageId(doc), { path: raw });
      expectValid(next);
      expect(next.pages[0].path.length).toBeLessThanOrEqual(120);
    }
  });
});

describe("pages", () => {
  it("adds a page per kind with a kind-derived path, never the root", () => {
    let doc = seed();
    for (const kind of ["bio", "shop", "blog", "custom"] as const) {
      doc = addPage(doc, kind);
    }
    expect(doc.pages.map((p) => p.path)).toEqual(["/", "/bio", "/shop", "/blog", "/page"]);
    expect(doc.pages.every((p) => p.id.startsWith("pg_"))).toBe(true);
    expectValid(doc);
  });

  it("de-duplicates a colliding path with a numeric suffix", () => {
    let doc = addPage(seed(), "shop");
    doc = addPage(doc, "shop");
    doc = addPage(doc, "shop");
    expect(doc.pages.map((p) => p.path)).toEqual(["/", "/shop", "/shop-2", "/shop-3"]);
    expect(new Set(doc.pages.map((p) => p.path)).size).toBe(doc.pages.length);
  });

  it("keeps paths unique when one is edited into another's", () => {
    let doc = addPage(seed(), "shop");
    doc = addPage(doc, "blog");
    const blogId = doc.pages[2].id;
    doc = updatePage(doc, blogId, { path: "/shop" });
    expect(findPage(doc, blogId)!.path).toBe("/shop-2");
  });

  it("lets a page keep its own path while being renamed", () => {
    const doc = addPage(seed(), "shop");
    const shopId = doc.pages[1].id;
    const next = updatePage(doc, shopId, { title: "Store", path: "/shop" });
    expect(findPage(next, shopId)).toMatchObject({ title: "Store", path: "/shop" });
  });

  it("stops at the page cap", () => {
    let doc = seed();
    while (doc.pages.length < LIMITS.pages) doc = addPage(doc, "custom");
    expect(doc.pages).toHaveLength(LIMITS.pages);
    expect(addPage(doc, "custom")).toBe(doc);
    expectValid(doc);
  });

  it("removes a page but never the last one", () => {
    const doc = addPage(seed(), "shop");
    const removed = removePage(doc, doc.pages[1].id);
    expect(removed.pages).toHaveLength(1);
    // The schema demands at least one page, so the final delete is a no-op.
    expect(removePage(removed, removed.pages[0].id)).toBe(removed);
    expectValid(removed);
  });

  it("ignores unknown page ids", () => {
    const doc = seed();
    expect(removePage(doc, "pg_nope")).toBe(doc);
    expect(updatePage(doc, "pg_nope", { title: "x" })).toBe(doc);
  });

  it("does not mutate the input document", () => {
    const doc = seed();
    const before = JSON.stringify(doc);
    addPage(doc, "shop");
    updatePage(doc, rootPageId(doc), { title: "Renamed", path: "/renamed" });
    removePage(doc, rootPageId(doc));
    expect(JSON.stringify(doc)).toBe(before);
  });
});

describe("sections", () => {
  it("adds a section of every schema kind with an sc_ id", () => {
    let doc = seed();
    for (const kind of SECTION_KINDS) doc = addSection(doc, rootPageId(doc), kind);
    const added = doc.pages[0].sections.slice(2);
    expect(added.map((s) => s.kind)).toEqual([...SECTION_KINDS]);
    expect(added.every((s) => s.id.startsWith("sc_") && s.blocks.length === 0)).toBe(true);
    expectValid(doc);
  });

  it("renames and removes", () => {
    const doc = seed();
    const sectionId = doc.pages[0].sections[1].id;
    const renamed = renameSection(doc, rootPageId(doc), sectionId, "Where to find me");
    expect(renamed.pages[0].sections[1].title).toBe("Where to find me");

    const removed = removeSection(renamed, rootPageId(renamed), sectionId);
    expect(removed.pages[0].sections).toHaveLength(1);
    expectValid(removed);
  });

  it("reorders up and down, and no-ops at both ends", () => {
    const base = seed();
    const doc = addSection(base, rootPageId(base), "faq");
    const page = rootPageId(doc);
    const ids = doc.pages[0].sections.map((s) => s.id);

    const down = moveSection(doc, page, ids[0], 1);
    expect(down.pages[0].sections.map((s) => s.id)).toEqual([ids[1], ids[0], ids[2]]);

    const up = moveSection(down, page, ids[0], -1);
    expect(up.pages[0].sections.map((s) => s.id)).toEqual(ids);

    // Off either end, a zero delta and an unknown id all leave the document as-is.
    expect(moveSection(doc, page, ids[0], -1)).toBe(doc);
    expect(moveSection(doc, page, ids[ids.length - 1], 1)).toBe(doc);
    expect(moveSection(doc, page, ids[0], 0)).toBe(doc);
    expect(moveSection(doc, page, "sc_nope", 1)).toBe(doc);
  });

  it("stops at the section cap", () => {
    let doc = seed();
    const page = rootPageId(doc);
    while (doc.pages[0].sections.length < LIMITS.sectionsPerPage) {
      doc = addSection(doc, page, "custom");
    }
    expect(addSection(doc, page, "custom")).toBe(doc);
    expectValid(doc);
  });
});

describe("blocks", () => {
  it("seeds a new block from its BLOCK_LIBRARY definition with a bl_ id", () => {
    const doc = seed();
    const page = rootPageId(doc);
    const sectionId = doc.pages[0].sections[0].id;

    for (const definition of BLOCK_LIBRARY) {
      const next = addBlock(doc, page, sectionId, definition);
      const block = next.pages[0].sections[0].blocks.at(-1)!;
      expect(block.id).toMatch(/^bl_[a-z0-9]+$/);
      expect(block).toMatchObject({
        type: definition.type,
        title: definition.defaults.title ?? "",
        subtitle: definition.defaults.subtitle ?? "",
        url: definition.defaults.url ?? "",
        imageUrl: null,
        effects: {},
      });
      expect(block.config).toEqual(definition.defaults.config ?? {});
      expectValid(next);
    }
  });

  it("gives every added block a distinct id", () => {
    let doc = seed();
    const page = rootPageId(doc);
    const sectionId = doc.pages[0].sections[0].id;
    for (let i = 0; i < 12; i += 1) doc = addBlock(doc, page, sectionId, blockDefinition("link")!);
    const ids = doc.pages[0].sections[0].blocks.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("copies the definition's config rather than sharing it", () => {
    const definition = blockDefinition("faq")!;
    const doc = seed();
    const next = addBlock(doc, rootPageId(doc), doc.pages[0].sections[0].id, definition);
    const block = next.pages[0].sections[0].blocks.at(-1)!;
    expect(block.config).not.toBe(definition.defaults.config);
  });

  it("patches the four editable fields and leaves the rest alone", () => {
    const doc = seed();
    const page = rootPageId(doc);
    const sectionId = doc.pages[0].sections[1].id;
    const blockId = doc.pages[0].sections[1].blocks[0].id;

    const next = updateBlock(doc, page, sectionId, blockId, {
      title: "Book a call",
      subtitle: "30 minutes",
      url: "https://cal.com/marta",
      imageUrl: "https://cdn.example.com/cover.jpg",
    });
    const block = next.pages[0].sections[1].blocks[0];
    expect(block).toMatchObject({
      title: "Book a call",
      subtitle: "30 minutes",
      url: "https://cal.com/marta",
      imageUrl: "https://cdn.example.com/cover.jpg",
      type: "link",
    });
    expectValid(next);

    // imageUrl is nullable, and clearing it must reach the document as null.
    const cleared = updateBlock(next, page, sectionId, blockId, { imageUrl: null });
    expect(cleared.pages[0].sections[1].blocks[0].imageUrl).toBeNull();
    expectValid(cleared);
  });

  it("reorders and removes within its own section only", () => {
    const doc = seed();
    const page = rootPageId(doc);
    const links = doc.pages[0].sections[1];
    const [first, second] = links.blocks.map((b) => b.id);

    const moved = moveBlock(doc, page, links.id, first, 1);
    expect(moved.pages[0].sections[1].blocks.map((b) => b.id)).toEqual([second, first]);
    // The other section is untouched — same reference, not merely equal.
    expect(moved.pages[0].sections[0]).toBe(doc.pages[0].sections[0]);

    const removed = removeBlock(moved, page, links.id, first);
    expect(removed.pages[0].sections[1].blocks.map((b) => b.id)).toEqual([second]);
    expectValid(removed);
  });

  it("no-ops on unknown ids at every level", () => {
    const doc = seed();
    const page = rootPageId(doc);
    const sectionId = doc.pages[0].sections[1].id;
    const blockId = doc.pages[0].sections[1].blocks[0].id;

    expect(addBlock(doc, "pg_nope", sectionId, blockDefinition("link")!)).toBe(doc);
    expect(addBlock(doc, page, "sc_nope", blockDefinition("link")!)).toBe(doc);
    expect(updateBlock(doc, page, sectionId, "bl_nope", { title: "x" })).toBe(doc);
    expect(removeBlock(doc, page, sectionId, "bl_nope")).toBe(doc);
    expect(moveBlock(doc, page, sectionId, "bl_nope", 1)).toBe(doc);
    expect(moveBlock(doc, page, sectionId, blockId, -1)).toBe(doc);
  });

  it("stops at the block cap", () => {
    let doc = seed();
    const page = rootPageId(doc);
    const sectionId = doc.pages[0].sections[0].id;
    const definition = blockDefinition("link")!;
    while (doc.pages[0].sections[0].blocks.length < LIMITS.blocksPerSection) {
      doc = addBlock(doc, page, sectionId, definition);
    }
    expect(addBlock(doc, page, sectionId, definition)).toBe(doc);
    expectValid(doc);
  });
});

describe("effects", () => {
  function scopes(doc: SiteDocument): EffectScope[] {
    const pageId = rootPageId(doc);
    const sectionId = doc.pages[0].sections[1].id;
    const blockId = doc.pages[0].sections[1].blocks[0].id;
    return [
      { level: "site" },
      { level: "page", pageId },
      { level: "section", pageId, sectionId },
      { level: "block", pageId, sectionId, blockId },
    ];
  }

  it("sets and reads an assignment at every level", () => {
    const doc = seed();
    for (const scope of scopes(doc)) {
      const next = setEffect(doc, scope, "background", "aurora");
      expect(readEffects(next, scope)).toEqual({ background: "aurora" });
      // Sibling levels stay empty — an assignment never leaks upward or down.
      for (const other of scopes(doc)) {
        if (other.level === scope.level) continue;
        expect(readEffects(next, other)).toEqual({});
      }
      expectValid(next);
    }
  });

  it("clearing deletes the key rather than storing undefined", () => {
    const doc = seed();
    for (const scope of scopes(doc)) {
      const assigned = setEffect(doc, scope, "entrance", "fade-up");
      const cleared = setEffect(assigned, scope, "entrance", undefined);
      const effects = readEffects(cleared, scope);
      expect(effects).toEqual({});
      expect(Object.prototype.hasOwnProperty.call(effects, "entrance")).toBe(false);
      expect(JSON.stringify(cleared)).toBe(JSON.stringify(doc));
    }
  });

  it("keeps targets independent and counts the assigned ones", () => {
    const doc = seed();
    const scope = scopes(doc)[3];
    let next = setEffect(doc, scope, "surface", "glow");
    next = setEffect(next, scope, "text", "gradient-text");
    next = setEffect(next, scope, "background", "grid");
    next = setEffect(next, scope, "entrance", "fade-up");
    expect(countEffects(readEffects(next, scope))).toBe(4);

    next = setEffect(next, scope, "text", undefined);
    expect(readEffects(next, scope)).toEqual({
      surface: "glow",
      background: "grid",
      entrance: "fade-up",
    });
    expect(countEffects(readEffects(next, scope))).toBe(3);
    expectValid(next);
  });

  it("replaces rather than accumulates within one target", () => {
    const doc = seed();
    const scope = scopes(doc)[0];
    const once = setEffect(doc, scope, "background", "aurora");
    const twice = setEffect(once, scope, "background", "grid");
    expect(readEffects(twice, scope)).toEqual({ background: "grid" });
  });

  it("no-ops on an address that does not resolve", () => {
    const doc = seed();
    const page = rootPageId(doc);
    const bad: EffectScope[] = [
      { level: "page", pageId: "pg_nope" },
      { level: "section", pageId: page, sectionId: "sc_nope" },
      { level: "block", pageId: page, sectionId: doc.pages[0].sections[0].id, blockId: "bl_nope" },
    ];
    for (const scope of bad) {
      expect(readEffects(doc, scope)).toEqual({});
      expect(setEffect(doc, scope, "background", "aurora")).toBe(doc);
    }
  });

  it("offers all four targets to blocks and the two container targets above", () => {
    expect(targetsForLevel("block")).toEqual(["surface", "text", "background", "entrance"]);
    for (const level of ["site", "page", "section"] as const) {
      expect(targetsForLevel(level)).toEqual(["background", "entrance"]);
    }
  });
});

describe("template switching", () => {
  it("accepts exactly the three templates the renderer ships", () => {
    for (const template of SITE_TEMPLATES) expect(isSiteTemplate(template)).toBe(true);
    for (const bogus of ["", "Editorial", "brutalist", "../editorial"]) {
      expect(isSiteTemplate(bogus)).toBe(false);
    }
  });

  it("switches between templates and preserves the content", () => {
    const doc = seed();
    const next = switchDocumentTemplate(doc, "storefront");
    expect(next.template).toBe("storefront");
    expect(next.pages).toBe(doc.pages);
    expectValid(next);
  });

  it("rejects an unknown template and no-ops on the current one", () => {
    const doc = seed();
    expect(switchDocumentTemplate(doc, "brutalist")).toBe(doc);
    expect(switchDocumentTemplate(doc, "editorial")).toBe(doc);
  });
});
