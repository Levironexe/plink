/**
 * Pure versioning math for the publish pipeline — no I/O, no prisma.
 *
 * The store (`apps/web/src/lib/site-store.ts`) numbers snapshots with
 * `nextVersionNumber` and the studio summarises a publish with
 * `diffDocuments`. Matching rules and the reasoning behind them live in
 * `docs/spikes/2026-09-03-diff-semantics-versioning.md`: pages are keyed by
 * `path`, sections and blocks are matched by `id`, and "changed" means the
 * JSON differs under a key-order-independent comparison.
 */

import type { SiteBlock, SiteDocument, SiteSection } from "./site-schema";

/**
 * The number the next snapshot should carry: one past the highest existing
 * number, `1` for a site that has never been published. Tolerates gaps and
 * unsorted input — deletion or listing order must never corrupt numbering.
 */
export function nextVersionNumber(existing: number[]): number {
  let max = 0;
  for (const n of existing) if (n > max) max = n;
  return max + 1;
}

export interface DocumentDiff {
  /** Paths present only in the new document, in its page order. */
  pagesAdded: string[];
  /** Paths present only in the old document, in its page order. */
  pagesRemoved: string[];
  /** Sections (within pages present in both) whose JSON differs, was added, or was removed. */
  sectionsChanged: number;
  /** Block adds + removes + edits across sections present in both documents. */
  blocksChanged: number;
}

/**
 * JSON.stringify with object keys sorted recursively. Array order is kept —
 * order is meaningful for pages, sections and blocks — but a document that
 * merely round-tripped through zod or storage must never read as changed.
 */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function differs(a: unknown, b: unknown): boolean {
  return stableStringify(a) !== stableStringify(b);
}

function byId<T extends { id: string }>(items: readonly T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) map.set(item.id, item);
  return map;
}

/** Adds + removes + edits between two block lists, matched by id. */
function countBlockChanges(before: readonly SiteBlock[], after: readonly SiteBlock[]): number {
  const beforeById = byId(before);
  const afterById = byId(after);
  let changed = 0;
  for (const [blockId, block] of afterById) {
    const prev = beforeById.get(blockId);
    if (!prev) changed += 1; // added
    else if (differs(prev, block)) changed += 1; // edited
  }
  for (const blockId of beforeById.keys()) {
    if (!afterById.has(blockId)) changed += 1; // removed
  }
  return changed;
}

/**
 * Section-level and block-level change counts between two versions of the
 * same page. A section added or removed counts as changed once and its
 * blocks are not double-counted — every change is reported at the coarsest
 * unit that captures it.
 */
function diffSections(
  before: readonly SiteSection[],
  after: readonly SiteSection[],
): { sectionsChanged: number; blocksChanged: number } {
  const beforeById = byId(before);
  const afterById = byId(after);
  let sectionsChanged = 0;
  let blocksChanged = 0;

  for (const [sectionId, section] of afterById) {
    const prev = beforeById.get(sectionId);
    if (!prev) {
      sectionsChanged += 1; // added
      continue;
    }
    if (differs(prev, section)) sectionsChanged += 1;
    blocksChanged += countBlockChanges(prev.blocks, section.blocks);
  }
  for (const sectionId of beforeById.keys()) {
    if (!afterById.has(sectionId)) sectionsChanged += 1; // removed
  }

  return { sectionsChanged, blocksChanged };
}

/**
 * Summarises what publishing `b` over `a` would change. Pages are keyed by
 * `path`; a renamed path reads as remove + add (a moved URL is a removed URL
 * from the visitor's point of view). Sections and blocks are matched by id
 * inside pages present in both documents.
 */
export function diffDocuments(a: SiteDocument, b: SiteDocument): DocumentDiff {
  const beforePaths = new Map(a.pages.map((page) => [page.path, page]));
  const afterPaths = new Map(b.pages.map((page) => [page.path, page]));

  const pagesAdded = b.pages.filter((page) => !beforePaths.has(page.path)).map((page) => page.path);
  const pagesRemoved = a.pages.filter((page) => !afterPaths.has(page.path)).map((page) => page.path);

  let sectionsChanged = 0;
  let blocksChanged = 0;
  for (const [path, page] of afterPaths) {
    const prev = beforePaths.get(path);
    if (!prev) continue; // reported in pagesAdded
    const counts = diffSections(prev.sections, page.sections);
    sectionsChanged += counts.sectionsChanged;
    blocksChanged += counts.blocksChanged;
  }

  return { pagesAdded, pagesRemoved, sectionsChanged, blocksChanged };
}
