# Spike — diff semantics for `diffDocuments` (Feature D)

**Question.** The contract fixes the shape —
`{ pagesAdded, pagesRemoved, sectionsChanged, blocksChanged }` — but not how
elements are matched between two `SiteDocument`s or what "changed" means at
each level. The studio (Feature E) will render this as a publish-dialog
summary, so the numbers must be explainable to a human.

## Options considered

1. **Positional matching** (compare page 0 to page 0, section 0 to section 0).
   Rejected: reordering sections — a first-class studio operation — would
   report everything changed.
2. **Match by id everywhere.** Rejected for pages: the contract says pages
   are "keyed by path", and paths are what a human sees in the added/removed
   lists (`"/shop"` reads better than `"pg_x8k2m4n1qz"`).
3. **Pages by `path`, sections and blocks by `id`** — chosen. Paths are
   unique in practice (the router would break otherwise), ids are stable
   across edits and survive reorders.

## Decisions

- **Pages keyed by `path`.** `pagesAdded` = paths only in `b`,
  `pagesRemoved` = paths only in `a`. A page whose path is edited therefore
  reads as remove + add — accepted; a moved URL *is* a removed URL from the
  visitor's point of view.
- **"Changed" = JSON differs**, per the contract, compared with a local
  key-order-independent stable stringify. Zod re-parsing or a
  storage round-trip can reorder keys; that must never read as a change.
  No new dependency: ~10 lines, sorts object keys recursively, leaves
  arrays ordered (order *is* meaningful for pages/sections/blocks).
- **A block edit marks its enclosing section changed.** The section's JSON
  literally contains its blocks, so this follows from the contract's own
  definition. Consequence the studio should expect: one block edit ⇒
  `sectionsChanged: 1, blocksChanged: 1`.
- **Added/removed sections in a matching page count toward
  `sectionsChanged`** (their JSON differs from absence), and their blocks do
  **not** leak into `blocksChanged` — each change is reported once, at the
  coarsest unit that captures it. Same principle one level up: sections of
  added/removed pages count toward nothing; the page lists already say it.
- **`blocksChanged`** = adds + removes + edits of blocks (by id, JSON
  compared) across sections present in both versions of a matching page.
- **Reorders:** a reordered array with identical members changes the parent's
  JSON (arrays keep order), so a section reorder marks nothing at
  block level but does *not* count individual sections as changed — each
  section's own JSON is unchanged; only the page moved them. This is
  deliberate: `sectionsChanged` answers "how many sections did you edit?",
  not "did the page change at all?" (publish itself answers that).

## Consequence for `nextVersionNumber`

Trivial by contract (`max + 1`, `1` for empty) — but it deliberately tolerates
gaps and unsorted input, because `listVersions` order and version deletion
must never be able to corrupt numbering. Backstopped in the store by
`@@unique([siteId, number])` inside an interactive transaction.
