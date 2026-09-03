# Plan — feat/admin-studio

Implementation approach for `docs/specs/admin-studio/spec.md`.

## Shape

```
apps/web/src/app/studio/[siteId]/
  page.tsx                     server: access, parse, seed history
  actions.ts                   "use server": saveSiteDraft, publish, rollback,
                               switchTemplate, versions
  _lib/document-ops.ts         pure: the whole document algebra (no React)
  _components/
    site-editor.tsx            the one client component that owns the document
    editor-chrome.tsx          Row, IconButton, KindPicker, ConfirmDialog,
                               MoveButtons — studio-local primitives
    page-tabs.tsx              tabs + add page + page settings (title/path/delete)
    section-card.tsx           one section: rename, reorder, delete, blocks
    block-card.tsx             one block: expand, fields, reorder, delete
    add-block-dialog.tsx       BLOCK_LIBRARY picker, grouped by category
    effects-dialog.tsx         one EffectPicker per target for one element
    template-switcher.tsx      three cards, current highlighted
    preview-pane.tsx           SiteRenderer in an isolated frame + width toggle
    publish-panel.tsx          publish dialog, history list, rollback
apps/web/tests/unit/studio-editor.test.ts
```

## Key decisions

### 1. One document, one state atom

The editor holds exactly one `SiteDocument`. Selection (`activePageId`,
expanded ids) is separate UI state. Nothing derived is stored: the active page,
the section list and the preview all read off the document. This is what makes
the preview trivially correct — it renders the same object the forms mutate.

### 2. Pure algebra in `_lib/document-ops.ts`

Every structural change is a `(document, …) => SiteDocument` function with no
React import, so the unit tests need no DOM, no DB and no mocks. The client
component is then a thin dispatcher: read input → call an op → set state →
schedule a save.

Ops that would violate a schema bound (deleting the last page, adding a 21st
page, moving the first section up) return the input document unchanged rather
than throwing — the UI disables those controls, and the algebra staying total
means a stale click can never crash the editor.

### 3. Effects addressed by scope, not by four near-identical functions

```ts
type EffectScope =
  | { level: "site" }
  | { level: "page"; pageId }
  | { level: "section"; pageId; sectionId }
  | { level: "block"; pageId; sectionId; blockId };
```

`readEffects(document, scope)` and `setEffect(document, scope, target, id)` are
the only two entry points, so adding a level later is one case arm and the
dialog component is written once. Clearing deletes the key (`delete next[target]`)
so a cleared effect leaves no residue in the stored JSON.

### 4. Pure state updates (regression guard)

`d9a3056` fixed a crash caused by scheduling a save *inside* a `setState`
updater — impure updaters run twice under StrictMode. The editor therefore keeps
the live document in a ref and applies changes outside the updater:

```ts
const docRef = React.useRef(document);
function apply(op: (d: SiteDocument) => SiteDocument) {
  const next = op(docRef.current);
  docRef.current = next;
  setDocument(next);
  save.schedule(next);          // side effect, outside setState
}
```

The ref also makes several `apply` calls in one tick compose correctly.

### 5. Autosave

`useDebouncedSave<SiteDocument>` from `@/lib/hooks` — the same hook, the same
550 ms, the same flush-on-hide/unmount semantics the dashboard uses. Publish
calls `save.flush()` first so a snapshot can never be older than the screen.

### 6. Preview isolation

`SiteRenderer` is not a client component but it is plain React, so a client
parent can render it. The frame is `isolate overflow-auto` with a
`border border-line` admin edge; everything inside gets its colours from the
`--pl-*` vars `SiteRenderer` sets on its own root, so no admin token reaches the
site and no site var escapes the frame.

### 7. Access-error mapping

The store throws `UNAUTHENTICATED | FORBIDDEN | NOT_FOUND` and returns
`{ ok: false, error }` for domain failures. `actions.ts` has one
`withStore(fn)` wrapper that turns the throws into `ActionResult` errors, so no
action leaks a 500 for an ordinary "you don't own this" case, and the page maps
the same three to `redirect("/login")` / `notFound()`.

## Risks

| Risk | Mitigation |
|---|---|
| Importing a module whose path contains `[siteId]` into a vitest file | The algebra is imported as `@/app/studio/[siteId]/_lib/document-ops`; verified by running the test file as the first implementation step, before any UI is written. |
| A stored draft that no longer parses | `safeParseSiteDocument` + a recovery card with history/rollback, instead of a thrown page. |
| Preview cost on every keystroke | The preview subtree is memoised on `(document, path)`; typing in one field re-renders the site once per change, which is the point of the pane. |

## Verification

`pnpm --filter @plink/web typecheck`, `lint`, `test` after each task; the full
three at the end. No dev server, no e2e (Art. VI.1 — this feature's e2e belongs
to the integration wave that has a seeded site to drive).
