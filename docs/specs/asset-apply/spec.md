# Spec — feat/asset-apply: place a library asset into the site document

Closes the gap `docs/specs/asset-generator/spec.md` left open under
"Out of scope": *"Applying an asset into the site document. The editor agent
owns document mutations; copy-URL is the v1 bridge between the library and the
editor."*

## Problem

An operator generates a hero image, then has to: copy its URL, leave the asset
library, open the editor, find the page, find the section, find the block, open
its image field, paste, wait for the autosave. Seven steps between "that one"
and "it is on the site" — and on a fresh site the block they need to paste into
does not exist yet, so the honest answer is "make one first".

The library already knows the URL. The document already knows where an image can
go. This feature joins them with one control on the asset card: pick a
placement, press the button, the draft is saved.

## Constitution constraints (binding)

- **I.1** — the server action resolves the site through `getSiteForUser`, which
  throws `UNAUTHENTICATED` / `NOT_FOUND` / `FORBIDDEN` before any document is
  read. No second ownership path is invented.
- **I.2** — a Server Action is a public endpoint. `target` and `url` arrive
  untrusted: the target shape is re-validated by hand, the URL must be http(s)
  (`safeHttpUrl` from `@plink/ai`) and within the schema's 600-char `imageUrl`
  bound, and the resulting document is re-validated by `saveDraft`'s
  `parseSiteDocument` before it is written.
- **III.1** — the document stays the source of truth. The apply is a document
  operation; nothing writes an image reference anywhere else.
- **III.3** — a significant mutation, so it is auditable: `AuditLog`
  `asset.apply` and `EventLog` `asset_applied`, both carrying the URL and the
  target. Reversible by construction — it writes the **draft**, never
  publishes, so the live page is untouched until the operator publishes and
  every published version stays rollback-able.
- **IV.1 / IV.3** — the control is admin UI: `@theme` tokens and the `.field` /
  `.card` classes, no hardcoded colour, no new dependency.
- **V.2** — the helper and the action live in the assets route's own
  `_lib/` and `actions.ts`; `_lib/document-ops.ts` is imported (for `LIMITS`),
  never edited.
- **VI.2** — every branch of the helper is pinned by unit tests with no DB and
  no network.

## Public contract

### `apps/web/src/app/studio/[siteId]/assets/_lib/apply-asset.ts`

```ts
export type AssetTarget =
  | { kind: "hero"; pageId: string }
  | { kind: "block"; blockId: string };

export type AssetTargetOption = { id: string; label: string; kind: "hero" | "block" };

export function applyAssetToDocument(
  doc: SiteDocument,
  target: AssetTarget,
  url: string,
): SiteDocument;

export function imageTargets(doc: SiteDocument): AssetTargetOption[];
export function isAssetTarget(value: unknown): value is AssetTarget;
```

Pure, in the same algebra as `_lib/document-ops.ts`: immutable, structurally
shared, total. It never throws, never mutates its input, and its result always
satisfies `parseSiteDocument`.

**`applyAssetToDocument`, by target:**

| Target | Behaviour |
| --- | --- |
| `{ kind: "block", blockId }` | Sets `imageUrl` on the block with that id, wherever in the tree it lives. First match in document order wins. |
| `{ kind: "hero", pageId }` — page has a hero section with an image-capable block | Sets `imageUrl` on the **first image-capable block** of that section. |
| `{ kind: "hero", pageId }` — hero section has no image-capable block (empty, or text/header only) | Appends a new `image` block (`newId("bl")`) carrying the URL. |
| `{ kind: "hero", pageId }` — page has no hero section | Inserts a `hero` section (`newId("sc")`) at the **top** of the page, holding one new `image` block. |

*Image-capable*, inside a hero, means `type === "image"` or a non-empty
`imageUrl` — the only two things the templates actually paint there.

**No-op discipline** (matching `document-ops`): the **input object** comes back,
reference-equal, when — and only when — the address does not resolve:

- an unknown `pageId` or `blockId`;
- a hero placement that would need a new section on a page already at
  `LIMITS.sectionsPerPage`, or a new block in a hero already at
  `LIMITS.blocksPerSection`.

Re-applying the same URL to the same target is **not** a no-op — it returns a
new document, exactly as `updateBlock` does. See the spike, §4.

**`imageTargets`** returns the placements worth offering, in document order:
for each page, its hero entry first, then that page's image-carrying blocks in
section-then-block order.

- hero entry: `{ id: page.id, kind: "hero", label: page.title }` — one per page,
  whether or not the page has a hero section yet (the apply creates one).
- block entry: `{ id: block.id, kind: "block", label: "<page title> › <block title or type>" }`,
  emitted for a block whose `imageUrl` is already in use **or** whose `type` is
  `"image"` or `"product"` — the fields the renderer paints
  (`docs/spikes/2026-09-03-asset-placement-targets.md`, §1).

**`isAssetTarget`** is the shape guard the server boundary uses; the helper
itself is total and does not need it.

### `apps/web/src/app/studio/[siteId]/assets/actions.ts`

```ts
export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; field?: string };

export async function applyAsset(
  siteId: string,
  target: AssetTarget,
  url: string,
): Promise<ActionResult>;
```

Same shape and the same `withStore` access-error mapping as
`apps/web/src/app/dashboard/actions.ts` and
`apps/web/src/app/studio/[siteId]/actions.ts`. In order:

| Step | Failure |
| --- | --- |
| `isAssetTarget(target)` | `"That placement is not one we can apply to"` |
| `safeHttpUrl(url)`, ≤ 600 chars | `"An image needs a plain http(s) link"` |
| `getSiteForUser(siteId)` | throws → mapped to the access message |
| `safeParseSiteDocument(site.document)` | `"The draft is not a valid site document"` |
| `applyAssetToDocument` returned the input | `"That placement no longer exists"` |
| `saveDraft` | the store's own message |

On success: `writeAudit` `asset.apply` (`after` = `{ url, target }`), `logEvent`
`asset_applied` (`data` = `{ url, target }`), `revalidatePath("/studio/<id>")`,
`{ ok: true }`. The draft only — publishing stays a separate, deliberate act.

### `/studio/[siteId]/assets`

The server page already loads the site through `requireSite`; it now also parses
`site.document` and hands `imageTargets(...)` to the panel as data. An
unparseable draft yields an empty list and the control renders disabled with a
one-line explanation rather than the page failing.

Each gallery card keeps its copy-URL button and gains a "Place in site" row: a
native `<select className="field">` grouped into *Page hero* / *Blocks*
`<optgroup>`s, plus a small `Place` button with a pending state. Result is
reported as a toast (`@plink/ui/toast`, provider mounted by the panel — spike
§5), success and error alike.

## Out of scope

- Publishing. The apply writes the draft; the publish panel already owns going
  live.
- Removing an image from a block, reordering, cropping, or alt text — the editor
  owns those.
- Applying to anything the renderer does not paint (section backgrounds, theme
  images): there is no field for them in the schema, and inventing one is a
  schema change (II.3).
- Any Prisma schema change, any new dependency.

## Contract deviation (sanctioned, recorded here)

The branch brief specified the hero rule as *"set `imageUrl` on the first block
of the named page's first hero section; if that section has no block, insert an
`image` block"*. Shipped behaviour narrows "first block" to "first
**image-capable** block" and widens "has no block" to "has no image-capable
block".

Reason: all three templates extract the hero's `header` block and render it as
text only, and the generator's house rule puts exactly a `header` (plus at most
a `text`) in every hero. Under the literal rule, the primary case — place a
generated hero image on a generated site — would save a document, write an audit
row, report success, and change nothing on the page. Evidence and the rejected
alternatives are in `docs/spikes/2026-09-03-asset-placement-targets.md`, §2.

Every other name, signature and behaviour in the brief ships unchanged, and for
any hero whose first block can already show an image the two rules agree.

## Acceptance

- `pnpm --filter @plink/web typecheck && lint && test` green.
- `apps/web/tests/unit/asset-apply.test.ts` covers every branch above: hero into
  an existing image block, hero into an empty section, hero into a header-only
  section, hero into a page with no hero section, a block nested deep by id,
  unknown page and block ids returning the same object reference, the section
  and block caps, the input never mutated (deep-frozen input plus a snapshot
  compare), `parseSiteDocument` on every result, and `imageTargets` labelling,
  filtering and ordering. No database, no network.
