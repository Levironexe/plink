# Spike — studio editor state and the document algebra

Date: 2026-09-03 · Feature: `feat/admin-studio` · Status: decided

Three questions had to be answered before the editor could be written: what the
client's state actually *is*, where structural edits live, and how a cleared
effect is represented. All three have a cheap wrong answer that is expensive to
undo later.

## 1. State shape — one document, not a normalised store

**Rejected:** flattening the tree into `Record<id, node>` maps the way an editor
"should", with the document reassembled on save.

**Chosen:** the client holds one `SiteDocument`, exactly the shape the schema,
the renderer and the store already speak.

Reasons:

- The preview is `SiteRenderer document={document}`. With a normalised store,
  every keystroke would need a denormalise pass to preview and the two shapes
  could drift; with the document itself the preview is definitionally what will
  be saved.
- The wire format is the document. `saveDraft` validates a whole document, so a
  normalised model would be serialised on every autosave anyway — the map buys
  nothing and costs a second source of truth (constitution III.1).
- Node counts are bounded by the schema: 20 pages × 24 sections × 40 blocks.
  Structural sharing on immutable updates makes the copies free at this size.

Cost accepted: an edit deep in the tree rebuilds the spine down to it. Measured
against the caps that is a handful of small object spreads per keystroke, far
below the cost of the preview re-render it triggers.

## 2. Where structural edits live — a pure module, not the component

Every "add a section", "move a block up", "assign an effect" is a
`(document, …) => SiteDocument` function in `_lib/document-ops.ts` with no React
import at all.

This is what makes the feature testable without a DOM, a database or a dev
server (constitution VI.2): `apps/web/tests/unit/studio-editor.test.ts` imports
the algebra directly. The component keeps only the parts that genuinely need
React — selection, dialogs, the debounce.

**Totality rule.** Ops never throw on a bound violation. Deleting the last page,
adding a 21st page, moving the first section up, editing an id that no longer
exists — all return the input document unchanged. The schema's `.min(1)` on
pages and `.max()` on collections are hard walls; a UI that has to remember to
disable a control before every call would eventually forget and produce a
document the store rejects. The UI *does* disable those controls, but the
algebra does not depend on it.

## 3. Clearing an effect — delete the key

`effectAssignmentSchema` is `.strict()` with four optional string ids.
`{ background: undefined }` and `{}` both parse, and `JSON.stringify` erases the
difference — so the choice looks cosmetic. It is not:

- `diffDocuments` (Feature D) compares with a key-sorted `stableStringify` that
  filters `undefined`, so the two forms already compare equal. Keeping the
  `undefined` key would still be dead weight travelling through every save.
- The dialog reads `assignment[target]` to decide the selected swatch;
  `EffectPicker` treats `undefined` as "None". Deleting the key makes "cleared"
  and "never set" literally the same state, so there is no third case to test.

So `setEffect(doc, scope, target, undefined)` deletes the key, and an element
with no effects carries `effects: {}` — the schema's own default.

## 4. Path allocation for new pages

Page paths must match `^\/[a-z0-9\-/]*$`, be unique enough to route, and be
guessable by the operator. New pages take a base path from their kind —
`bio → /bio`, `shop → /shop`, `blog → /blog`, `custom → /page` — and collide
into `-2`, `-3`, … Root (`/`) is never auto-assigned: a document always has at
least one page and the first one owns `/`, so handing `/` to an added page would
silently shadow the home page. The operator can still type `/` into the path
field; that is an explicit act with the preview showing the result.

Path input is normalised on the way in (lowercase, slash-rooted, invalid
characters folded to `-`, repeated slashes collapsed) rather than validated and
rejected, so the field can never be left in a state the schema refuses — the
store's `parseSiteDocument` would turn that into a save error the operator
cannot see the cause of.

## 5. Autosave scheduling — outside the state updater

`d9a3056` ("Fix dashboard reorder crash from impure state updater") is the
precedent: calling `save.schedule(next)` inside a `setState(prev => …)` updater
double-fires under StrictMode and, worse, makes the scheduled value depend on
when React chooses to run the updater.

The editor keeps the live document in a ref alongside the state. `apply()`
computes the next document from the ref, writes the ref, calls `setDocument`
with the finished value, then schedules the save — all synchronously, all
outside the updater. Several `apply` calls in one tick compose correctly
because the ref, not the (still stale) state, is the input.
