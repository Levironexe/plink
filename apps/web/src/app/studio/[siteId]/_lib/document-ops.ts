/**
 * The studio editor's document algebra — every structural edit as a pure
 * `(document, …) => SiteDocument` function, with no React anywhere in the file.
 *
 * The editor holds one whole `SiteDocument` in state (the same shape the
 * schema, the renderer and `saveDraft` already speak) and is a thin dispatcher
 * over these functions. Keeping them here is what lets the behaviour be pinned
 * by `apps/web/tests/unit/studio-editor.test.ts` with no DOM, no database and
 * no dev server. Reasoning: `docs/spikes/2026-09-03-studio-editor-state.md`.
 *
 * Every op is **total**: an edit that would break a schema bound — deleting the
 * last page, adding a 21st page, moving the first section up, naming an id that
 * no longer exists — returns the input document unchanged instead of throwing.
 * The UI disables those controls, but the algebra never depends on it.
 */

import {
  newId,
  SITE_TEMPLATES,
  type EffectAssignment,
  type EffectTarget,
  type SiteBlock,
  type SiteDocument,
  type SitePage,
  type SiteSection,
  type SiteTemplateId,
} from "@plink/core/site-schema";
import type { BlockDefinition } from "@plink/core/blocks";

/* --------------------------------------------------------------- capacity */

/** Mirrors the `.max()` / `.min()` bounds in `site-schema.ts`. */
export const LIMITS = {
  pages: 20,
  sectionsPerPage: 24,
  blocksPerSection: 40,
} as const;

/* ------------------------------------------------------------------ paths */

/**
 * Fold arbitrary operator input into a path the schema accepts
 * (`^\/[a-z0-9\-/]*$`, ≤ 120 chars). Normalising rather than rejecting keeps
 * the field from ever holding a value `parseSiteDocument` would refuse — a save
 * error whose cause the operator cannot see is worse than a nudged character.
 */
export function normalizePagePath(input: string): string {
  const segments = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\-/]+/g, "-")
    .split("/")
    // Hyphens only ever separate words, so a run of them — or one left at
    // either edge by a folded character — is noise, not part of the path.
    .map((segment) => segment.replace(/-{2,}/g, "-").replace(/^-+|-+$/g, ""))
    .filter(Boolean);
  return segments.length === 0 ? "/" : `/${segments.join("/")}`.slice(0, 120);
}

/** The path a new page of this kind wants before collisions are resolved. */
const BASE_PATH_FOR_KIND: Record<SitePage["kind"], string> = {
  bio: "/bio",
  shop: "/shop",
  blog: "/blog",
  custom: "/page",
};

/**
 * `desired`, or `desired-2` / `desired-3` / … until no other page claims it.
 * `exceptPageId` lets a page keep its own path while being edited.
 */
export function uniquePagePath(
  document: SiteDocument,
  desired: string,
  exceptPageId?: string,
): string {
  const base = normalizePagePath(desired);
  const taken = new Set(
    document.pages.filter((page) => page.id !== exceptPageId).map((page) => page.path),
  );
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = normalizePagePath(base === "/" ? `/page-${n}` : `${base}-${n}`);
    if (!taken.has(candidate)) return candidate;
  }
  // Unreachable at 20 pages; a fresh id is still a legal, unique path.
  return normalizePagePath(`/${newId("pg")}`);
}

/* ------------------------------------------------------------ page titles */

const TITLE_FOR_KIND: Record<SitePage["kind"], string> = {
  bio: "About",
  shop: "Shop",
  blog: "Blog",
  custom: "New page",
};

/* ------------------------------------------------------------------ pages */

export function findPage(document: SiteDocument, pageId: string): SitePage | undefined {
  return document.pages.find((page) => page.id === pageId);
}

/**
 * Append a page of `kind`. Root (`/`) is never auto-assigned — the first page
 * owns it and a second page there would silently shadow the home page.
 */
export function addPage(document: SiteDocument, kind: SitePage["kind"]): SiteDocument {
  if (document.pages.length >= LIMITS.pages) return document;
  const page: SitePage = {
    id: newId("pg"),
    kind,
    title: TITLE_FOR_KIND[kind],
    path: uniquePagePath(document, BASE_PATH_FOR_KIND[kind]),
    sections: [],
    effects: {},
  };
  return { ...document, pages: [...document.pages, page] };
}

/** Deleting the last page is a no-op — the schema requires at least one. */
export function removePage(document: SiteDocument, pageId: string): SiteDocument {
  if (document.pages.length <= 1) return document;
  const pages = document.pages.filter((page) => page.id !== pageId);
  return pages.length === document.pages.length ? document : { ...document, pages };
}

/**
 * Patch a page's title and/or path. A path is normalised and de-duplicated
 * against its siblings, so the operator can type freely.
 */
export function updatePage(
  document: SiteDocument,
  pageId: string,
  patch: { title?: string; path?: string },
): SiteDocument {
  return mapPage(document, pageId, (page) => ({
    ...page,
    ...(patch.title !== undefined ? { title: patch.title.slice(0, 120) } : {}),
    ...(patch.path !== undefined
      ? { path: uniquePagePath(document, patch.path, pageId) }
      : {}),
  }));
}

/**
 * The three `map*` helpers below all return the *input* node when the mapper
 * hands back what it was given. That identity is load-bearing: it is how a
 * no-op op (an unknown id, a move off the end, an add at the cap) propagates
 * all the way out as `document === input`, which in turn lets the editor skip
 * a state update and an autosave for a change that did not happen.
 */
function mapPage(
  document: SiteDocument,
  pageId: string,
  map: (page: SitePage) => SitePage,
): SiteDocument {
  let touched = false;
  const pages = document.pages.map((page) => {
    if (page.id !== pageId) return page;
    const mapped = map(page);
    if (mapped !== page) touched = true;
    return mapped;
  });
  return touched ? { ...document, pages } : document;
}

function mapSection(
  document: SiteDocument,
  pageId: string,
  sectionId: string,
  map: (section: SiteSection) => SiteSection,
): SiteDocument {
  return mapPage(document, pageId, (page) => {
    let touched = false;
    const sections = page.sections.map((section) => {
      if (section.id !== sectionId) return section;
      const mapped = map(section);
      if (mapped !== section) touched = true;
      return mapped;
    });
    return touched ? { ...page, sections } : page;
  });
}

/* --------------------------------------------------------------- sections */

export function addSection(
  document: SiteDocument,
  pageId: string,
  kind: SiteSection["kind"],
): SiteDocument {
  return mapPage(document, pageId, (page) => {
    if (page.sections.length >= LIMITS.sectionsPerPage) return page;
    const section: SiteSection = {
      id: newId("sc"),
      kind,
      title: "",
      blocks: [],
      effects: {},
    };
    return { ...page, sections: [...page.sections, section] };
  });
}

export function renameSection(
  document: SiteDocument,
  pageId: string,
  sectionId: string,
  title: string,
): SiteDocument {
  return mapSection(document, pageId, sectionId, (section) => ({
    ...section,
    title: title.slice(0, 200),
  }));
}

export function removeSection(
  document: SiteDocument,
  pageId: string,
  sectionId: string,
): SiteDocument {
  return mapPage(document, pageId, (page) => {
    const sections = page.sections.filter((section) => section.id !== sectionId);
    return sections.length === page.sections.length ? page : { ...page, sections };
  });
}

/** `delta` is `-1` (up) or `+1` (down); a move off either end is a no-op. */
export function moveSection(
  document: SiteDocument,
  pageId: string,
  sectionId: string,
  delta: number,
): SiteDocument {
  return mapPage(document, pageId, (page) => {
    const sections = moveWithin(page.sections, sectionId, delta);
    return sections === page.sections ? page : { ...page, sections };
  });
}

/* ----------------------------------------------------------------- blocks */

/**
 * Append a block seeded from its `BLOCK_LIBRARY` definition. The definition's
 * defaults are the only place block content templates live — the studio never
 * invents a second set.
 */
export function addBlock(
  document: SiteDocument,
  pageId: string,
  sectionId: string,
  definition: BlockDefinition,
): SiteDocument {
  return mapSection(document, pageId, sectionId, (section) => {
    if (section.blocks.length >= LIMITS.blocksPerSection) return section;
    const block: SiteBlock = {
      id: newId("bl"),
      type: definition.type,
      title: definition.defaults.title ?? "",
      subtitle: definition.defaults.subtitle ?? "",
      url: definition.defaults.url ?? "",
      imageUrl: null,
      config: { ...(definition.defaults.config ?? {}) },
      effects: {},
    };
    return { ...section, blocks: [...section.blocks, block] };
  });
}

export type BlockPatch = Partial<Pick<SiteBlock, "title" | "subtitle" | "url" | "imageUrl">>;

export function updateBlock(
  document: SiteDocument,
  pageId: string,
  sectionId: string,
  blockId: string,
  patch: BlockPatch,
): SiteDocument {
  return mapBlock(document, pageId, sectionId, blockId, (block) => ({ ...block, ...patch }));
}

export function removeBlock(
  document: SiteDocument,
  pageId: string,
  sectionId: string,
  blockId: string,
): SiteDocument {
  return mapSection(document, pageId, sectionId, (section) => {
    const blocks = section.blocks.filter((block) => block.id !== blockId);
    return blocks.length === section.blocks.length ? section : { ...section, blocks };
  });
}

export function moveBlock(
  document: SiteDocument,
  pageId: string,
  sectionId: string,
  blockId: string,
  delta: number,
): SiteDocument {
  return mapSection(document, pageId, sectionId, (section) => {
    const blocks = moveWithin(section.blocks, blockId, delta);
    return blocks === section.blocks ? section : { ...section, blocks };
  });
}

function mapBlock(
  document: SiteDocument,
  pageId: string,
  sectionId: string,
  blockId: string,
  map: (block: SiteBlock) => SiteBlock,
): SiteDocument {
  return mapSection(document, pageId, sectionId, (section) => {
    let touched = false;
    const blocks = section.blocks.map((block) => {
      if (block.id !== blockId) return block;
      const mapped = map(block);
      if (mapped !== block) touched = true;
      return mapped;
    });
    return touched ? { ...section, blocks } : section;
  });
}

/**
 * Shift one item by `delta`, returning the *same array reference* when nothing
 * moves — the identity check is what lets the callers above skip rebuilding
 * their spine on a no-op.
 */
function moveWithin<T extends { id: string }>(items: T[], id: string, delta: number): T[] {
  const from = items.findIndex((item) => item.id === id);
  if (from === -1) return items;
  const to = from + delta;
  if (to < 0 || to >= items.length || delta === 0) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/* ---------------------------------------------------------------- effects */

/**
 * Where an effect assignment lives. One address type instead of four
 * near-identical getter/setter pairs, so the effects dialog is written once and
 * a new level is one case arm.
 */
export type EffectScope =
  | { level: "site" }
  | { level: "page"; pageId: string }
  | { level: "section"; pageId: string; sectionId: string }
  | { level: "block"; pageId: string; sectionId: string; blockId: string };

/** The assignment at `scope`, or `{}` when the address does not resolve. */
export function readEffects(document: SiteDocument, scope: EffectScope): EffectAssignment {
  if (scope.level === "site") return document.effects;
  const page = findPage(document, scope.pageId);
  if (!page) return {};
  if (scope.level === "page") return page.effects;
  const section = page.sections.find((s) => s.id === scope.sectionId);
  if (!section) return {};
  if (scope.level === "section") return section.effects;
  const block = section.blocks.find((b) => b.id === scope.blockId);
  return block?.effects ?? {};
}

/**
 * Assign — or, with `undefined`, clear — one effect target at `scope`.
 *
 * Clearing deletes the key rather than storing `undefined`, so "cleared" and
 * "never set" are the same state in the saved JSON and in the picker's
 * selected-swatch logic.
 */
export function setEffect(
  document: SiteDocument,
  scope: EffectScope,
  target: EffectTarget,
  id: string | undefined,
): SiteDocument {
  const assign = (effects: EffectAssignment): EffectAssignment => {
    const next = { ...effects };
    if (id) next[target] = id;
    else delete next[target];
    return next;
  };

  switch (scope.level) {
    case "site":
      return { ...document, effects: assign(document.effects) };
    case "page":
      return mapPage(document, scope.pageId, (page) => ({ ...page, effects: assign(page.effects) }));
    case "section":
      return mapSection(document, scope.pageId, scope.sectionId, (section) => ({
        ...section,
        effects: assign(section.effects),
      }));
    case "block":
      return mapBlock(document, scope.pageId, scope.sectionId, scope.blockId, (block) => ({
        ...block,
        effects: assign(block.effects),
      }));
  }
}

/** How many of an assignment's four targets carry an effect. */
export function countEffects(effects: EffectAssignment): number {
  return Object.values(effects).filter(Boolean).length;
}

/**
 * The targets an element of this level can be given. Site, page and section are
 * containers — they paint behind their contents and animate in; only a block is
 * a concrete surface with letters of its own.
 */
export function targetsForLevel(level: EffectScope["level"]): EffectTarget[] {
  return level === "block"
    ? ["surface", "text", "background", "entrance"]
    : ["background", "entrance"];
}

/* -------------------------------------------------------------- templates */

export function isSiteTemplate(value: string): value is SiteTemplateId {
  return (SITE_TEMPLATES as readonly string[]).includes(value);
}

/** Swap the template, or leave the document untouched if the id is not one we ship. */
export function switchDocumentTemplate(document: SiteDocument, template: string): SiteDocument {
  if (!isSiteTemplate(template) || document.template === template) return document;
  return { ...document, template };
}
