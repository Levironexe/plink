/**
 * Placing a library asset into the site document — the pure half.
 *
 * Written in the same algebra as the editor's `_lib/document-ops.ts`: every
 * function is `(document, …) => SiteDocument`, immutable, structurally shared
 * and **total**. An address that does not resolve — an unknown page, an unknown
 * block, a hero that would need a section the schema has no room for — returns
 * the *input document object*, and that reference equality is load-bearing: the
 * server action reports `next === current` to the operator as "that placement
 * no longer exists" instead of writing a save that changes nothing.
 *
 * Re-applying the same URL to the same target is deliberately *not* a no-op; it
 * returns a new document, exactly as `updateBlock` does. Only unresolved
 * addresses come back identical.
 *
 * The two rules this file encodes are not obvious from the schema, because the
 * schema gives `imageUrl` to every block while the renderer reads it in only two
 * places. Evidence, alternatives and the sanctioned deviation from the original
 * brief are in `docs/spikes/2026-09-03-asset-placement-targets.md`.
 */

import {
  newId,
  type SiteBlock,
  type SiteDocument,
  type SitePage,
  type SiteSection,
} from "@plink/core/site-schema";
import { LIMITS } from "../../_lib/document-ops";

/* ---------------------------------------------------------------- targets */

/**
 * Where an image is going. A block is addressed by its bare id rather than a
 * `(pageId, sectionId, blockId)` path so the choice round-trips through a
 * `<select>` as one string; ids are minted by `newId` and the search takes the
 * first match in document order.
 */
export type AssetTarget =
  | { kind: "hero"; pageId: string }
  | { kind: "block"; blockId: string };

/** One row of the placement picker: `id` is the target's page id or block id. */
export type AssetTargetOption = {
  id: string;
  label: string;
  kind: AssetTarget["kind"];
};

/**
 * The shape guard for the server boundary — a Server Action argument is
 * untrusted (Art. I.2). The algebra below is total and does not need it.
 */
export function isAssetTarget(value: unknown): value is AssetTarget {
  if (!value || typeof value !== "object") return false;
  const target = value as { kind?: unknown; pageId?: unknown; blockId?: unknown };
  if (target.kind === "hero") return typeof target.pageId === "string" && target.pageId.length > 0;
  if (target.kind === "block") return typeof target.blockId === "string" && target.blockId.length > 0;
  return false;
}

/* ------------------------------------------------------------ what paints */

/**
 * Block types whose renderer reads `imageUrl`: the `image` block (its whole
 * subject) and the storefront `product` card (a thumbnail above the title).
 * Any other type would store the URL and draw nothing.
 */
const IMAGE_BLOCK_TYPES = new Set(["image", "product"]);

/** A block already using the field is a target whatever its type. */
function hasImage(block: SiteBlock): boolean {
  return typeof block.imageUrl === "string" && block.imageUrl.length > 0;
}

/** Offerable in the picker: the renderer either paints it, or it is already in use. */
function isImageTarget(block: SiteBlock): boolean {
  return IMAGE_BLOCK_TYPES.has(block.type) || hasImage(block);
}

/**
 * Usable *inside a hero*, where the templates render `product` blocks nowhere
 * and pull the `header` out as text — so only an `image` block, or a block
 * already carrying a URL, can actually show the picture.
 */
function isHeroImageBlock(block: SiteBlock): boolean {
  return block.type === "image" || hasImage(block);
}

/** A fresh `image` block holding `url`, valid against `siteBlockSchema` as-is. */
function imageBlock(url: string): SiteBlock {
  return {
    id: newId("bl"),
    type: "image",
    title: "",
    subtitle: "",
    url: "",
    imageUrl: url,
    config: {},
    effects: {},
  };
}

/* -------------------------------------------------------------- placement */

/**
 * Put `url` where `target` says. Returns a new document, or the input document
 * unchanged when the target no longer resolves.
 */
export function applyAssetToDocument(
  doc: SiteDocument,
  target: AssetTarget,
  url: string,
): SiteDocument {
  return target.kind === "hero"
    ? applyToHero(doc, target.pageId, url)
    : applyToBlock(doc, target.blockId, url);
}

/**
 * The hero rule, in order: the first block of the page's first `hero` section
 * that can show an image; failing that a new `image` block appended to it;
 * failing that a whole `hero` section at the top of the page.
 */
function applyToHero(doc: SiteDocument, pageId: string, url: string): SiteDocument {
  return mapPage(doc, pageId, (page) => {
    const index = page.sections.findIndex((section) => section.kind === "hero");

    if (index === -1) {
      // A hero belongs at the top: `splitHero` finds it wherever it sits, but
      // every template renders it first, and a document should read the way it
      // paints.
      if (page.sections.length >= LIMITS.sectionsPerPage) return page;
      const hero: SiteSection = {
        id: newId("sc"),
        kind: "hero",
        title: "",
        blocks: [imageBlock(url)],
        effects: {},
      };
      return { ...page, sections: [hero, ...page.sections] };
    }

    const section = page.sections[index];
    const next = setHeroImage(section, url);
    if (next === section) return page;

    const sections = [...page.sections];
    sections[index] = next;
    return { ...page, sections };
  });
}

/** The hero section with the image placed, or the same section when it is full. */
function setHeroImage(section: SiteSection, url: string): SiteSection {
  const index = section.blocks.findIndex(isHeroImageBlock);

  if (index === -1) {
    if (section.blocks.length >= LIMITS.blocksPerSection) return section;
    // Appended, not prepended: the templates lift the `header` out of the hero
    // wherever it sits, so position only matters relative to the other blocks —
    // and appending is what `addBlock` does everywhere else in the studio.
    return { ...section, blocks: [...section.blocks, imageBlock(url)] };
  }

  const blocks = [...section.blocks];
  blocks[index] = { ...blocks[index], imageUrl: url };
  return { ...section, blocks };
}

/** Set `imageUrl` on one block, wherever in the tree it lives. */
function applyToBlock(doc: SiteDocument, blockId: string, url: string): SiteDocument {
  let done = false;

  const pages = doc.pages.map((page) => {
    if (done) return page;
    let touched = false;

    const sections = page.sections.map((section) => {
      if (done) return section;
      const index = section.blocks.findIndex((block) => block.id === blockId);
      if (index === -1) return section;

      done = true;
      touched = true;
      const blocks = [...section.blocks];
      blocks[index] = { ...blocks[index], imageUrl: url };
      return { ...section, blocks };
    });

    return touched ? { ...page, sections } : page;
  });

  return done ? { ...doc, pages } : doc;
}

/**
 * The one `map` helper this file needs. Like `document-ops`' own, it hands back
 * the input document when the mapper hands back the page it was given, so a
 * no-op propagates out as `result === input`.
 */
function mapPage(
  doc: SiteDocument,
  pageId: string,
  map: (page: SitePage) => SitePage,
): SiteDocument {
  let touched = false;
  const pages = doc.pages.map((page) => {
    if (page.id !== pageId) return page;
    const mapped = map(page);
    if (mapped !== page) touched = true;
    return mapped;
  });
  return touched ? { ...doc, pages } : doc;
}

/* ----------------------------------------------------------------- picker */

/**
 * The placements worth offering, in document order: for every page its hero
 * entry, then that page's image-carrying blocks in section-then-block order.
 *
 * A page always gets a hero entry, whether or not it has a hero section yet —
 * `applyAssetToDocument` creates one. A block is listed only when the renderer
 * would paint the field (`image`, `product`) or when it is already in use.
 */
export function imageTargets(doc: SiteDocument): AssetTargetOption[] {
  const options: AssetTargetOption[] = [];

  for (const page of doc.pages) {
    const pageTitle = page.title || "Untitled page";
    options.push({ id: page.id, label: pageTitle, kind: "hero" });

    for (const section of page.sections) {
      for (const block of section.blocks) {
        if (!isImageTarget(block)) continue;
        options.push({
          id: block.id,
          label: `${pageTitle} › ${block.title || block.type}`,
          kind: "block",
        });
      }
    }
  }

  return options;
}
