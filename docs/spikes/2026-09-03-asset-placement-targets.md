# Spike — where a generated image can land in a site document

Date: 2026-09-03 · Feature: `feat/asset-apply`
Question: the asset library holds URLs; the site document holds `imageUrl`
fields. Which fields are worth offering an operator, and what exactly should
"place this in the hero" write?

## 1. What the renderer actually paints

`SiteBlock.imageUrl` exists on every block (`packages/core/src/site-schema.ts`),
but only two places in the renderer read it:

| Reader | File | Condition |
| --- | --- | --- |
| `ImageBlock` | `apps/web/src/components/site/blocks.tsx:317` | `block.imageUrl \|\| block.url` — the `image` block's whole subject |
| storefront product card | `apps/web/src/components/site/blocks.tsx:246` | `product` block, rendered above the title |

Every other block type ignores the field completely. Two consequences:

- The honest placement list is **image blocks, product blocks, and any block
  already carrying an `imageUrl`** (the last one because a document written by
  another tool — or a future template — may already be using the field, and
  silently dropping it from the list would hide a real target).
- A hero section has no `imageUrl` of its own. The only way to put a picture in
  a hero is to have a block inside it that paints one.

## 2. The hero rule, and why it is not literally "the first block"

All three templates pull the hero's **header** block out and render it as text
only (`templates/editorial.tsx:82`, `storefront.tsx:76`, `portfolio.tsx:85`):
`title` becomes the masthead, `subtitle` the standfirst. `imageUrl` is never
read. Everything *else* in the hero goes through `SiteBlockView`, where an
`image` block does paint.

The generator's own house rule is `"A hero holds one header block and, at most,
one text block"` (`packages/ai/src/site.ts:463`). So on a generated site — the
common case this feature exists for — the hero's *first* block is a header, and
writing `imageUrl` onto it produces a saved document, a green audit row, a
success toast, and **no visible change to the page**.

Three candidate rules:

| Rule | Verdict |
| --- | --- |
| (a) Write to the hero's first block, whatever it is | Literal, predictable, and invisible on every AI-generated hero. Rejected. |
| (b) Refuse hero placement; offer image blocks only | Truthful, but leaves the operator with no target at all on a fresh site whose hero is empty. Rejected. |
| (c) Write to the hero's first *image-capable* block; if there is none, insert an `image` block | Always renders. One extra branch. **Chosen.** |

"Image-capable" is one predicate shared with the target list: `type === "image"`
or `imageUrl` already non-empty. `product` counts everywhere except inside a
hero, where no template renders products — so the hero rule uses the narrower
test and the list uses the wider one.

Recorded as a contract deviation in `docs/specs/asset-apply/spec.md`; the
original wording is a strict subset of (c) for every hero whose blocks can
already show an image.

## 3. Addressing a block

`AssetTarget` addresses a block by bare `blockId`, not by
`(pageId, sectionId, blockId)` the way `document-ops` does. The ids are minted
by `newId("bl")` (nanoid, 10 chars) so collisions are not a practical concern,
and the flat form is what a `<select>` can round-trip as one string without the
client having to reassemble a path. The search walks the tree in document order
and the first match wins; an id that matches nothing is a no-op, exactly as an
unknown id is in `document-ops`.

The cost is a full-tree walk per apply. A document is capped at 20 pages × 24
sections × 40 blocks, and this runs once per operator click on the server —
not a budget worth optimising against.

## 4. Re-applying the same URL is a change, not a no-op

`document-ops`' `updateBlock` returns a fresh document even when the patch is
identical (`{ ...block, ...patch }` is never reference-equal), and the identity
check is reserved for *addresses that did not resolve*. `applyAssetToDocument`
keeps that split: the original object comes back only when the page, section or
block could not be found. The server action leans on it — `next === current` is
what it reports as "That placement no longer exists" — so if placing the same
image twice were a no-op, the second click would report a phantom error.

## 5. Toasts in the studio

`@plink/ui/toast` needs a `ToastProvider` above it; `useToast` returns a silent
stub without one. `apps/web/src/app/dashboard/layout.tsx` mounts one, but
`/studio` has no layout at all — so `site-editor.tsx` and `publish-panel.tsx`
already call `toast()` into the void. Fixing that means adding
`app/studio/layout.tsx`, which is another agent's file this branch must not
touch.

The asset panel therefore mounts its own `ToastProvider` around its subtree.
It is one component, no new dependency, and it renders the same toast chrome as
the rest of the app. If a studio-level provider lands later, the inner one keeps
serving this panel and nothing double-fires — worst case the page holds two
(empty) toast regions, and deleting one line here resolves it.
