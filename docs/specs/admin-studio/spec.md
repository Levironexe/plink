# Spec — feat/admin-studio: the operator site editor

Feature E of the Creator Website OS plan
(`docs/superpowers/plans/2026-09-03-creator-website-os.md`). Product Plan VI §4
("Admin Studio: edit block, preview, approve, publish và rollback") and §8 DoD
(operator can preview / publish / rollback; ≥3 templates from one schema; no
per-client code; audit log on important operations).

## Problem

Waves 1 and 2 shipped every part except the seat the operator sits in:

- `@plink/core/site-schema` owns the document (site → page → section → block,
  theme, per-element `effects`).
- `apps/web/src/components/site/site-renderer.tsx` renders any document in
  three templates, in `live` or `preview` mode.
- `apps/web/src/components/effects/effect-picker.tsx` picks one effect for one
  target.
- `apps/web/src/lib/site-store.ts` saves drafts, publishes versions, rolls back
  and lists history — all owner-scoped and audited.

Nothing composes them. `/studio` lists sites and links every card at
`/studio/[siteId]`, which 404s today. This feature is that route: one screen
where an operator edits the draft document, watches a live preview, assigns
effects at any level, switches templates, publishes, and rolls back.

## Constitution constraints (binding)

- **I.1 / I.2** — the page and every server action authenticate and scope by
  owner; a Server Action is a public endpoint, so the document arrives as
  `unknown` and is re-validated by `parseSiteDocument` inside the store. The
  client never gets to name a site it does not own.
- **III.1** — the schema is the source of truth. The editor is a consumer: every
  mutation produces a new `SiteDocument` and goes through `saveDraft`.
- **III.3** — publish and rollback are the store's, so audit and event rows come
  for free; the studio never writes those tables itself.
- **IV.1 / IV.3** — admin chrome uses `DESIGN.md` tokens and the
  `.card` / `.field` / `.eyebrow` primitives only. The preview pane hosts the
  themed site, which brings its own `--pl-*` vars; admin tokens do not leak in
  and site vars do not leak out.
- **V.2** — everything lives in `studio/[siteId]/_components` and
  `studio/[siteId]/_lib`; nothing new is shared across route areas.
- **VI.2** — the document algebra is pure and pinned by unit tests.

## Scope

### Owned

- `apps/web/src/app/studio/[siteId]/page.tsx` — server page.
- `apps/web/src/app/studio/[siteId]/actions.ts` — server actions.
- `apps/web/src/app/studio/[siteId]/_lib/document-ops.ts` — pure algebra.
- `apps/web/src/app/studio/[siteId]/_components/**` — the editor UI.
- `apps/web/tests/unit/studio-editor.test.ts`.

### Not owned (linked to, never created)

- `studio/[siteId]/generate/**` (Feature F) and `studio/[siteId]/assets/**`
  (Feature G). The shell nav links both; the routes may 404 until they merge —
  the same link contract `SiteCard` already uses for this route.

### Explicitly out

No new API routes, no new npm dependencies, no drag-and-drop library (reorder is
up/down buttons), no theme editor (the theme is the generator's and the
appearance surface's business), no schema or Prisma change.

## Behaviour

### Route

`GET /studio/<siteId>`

1. `getSiteForUser(siteId)` — `UNAUTHENTICATED` redirects to `/login`;
   `NOT_FOUND` and `FORBIDDEN` are indistinguishable and both `notFound()`
   (Art. I.1 — a foreign site must not be detectable).
2. `Site.document` is parsed with `safeParseSiteDocument`. A row that no longer
   parses does not white-screen the operator: the page renders a recovery card
   explaining the draft is unreadable and offers the version history so an
   earlier snapshot can be rolled back in.
3. `listVersions(siteId)` seeds the history panel so it is populated on arrival.

### Editing

One `SiteDocument` in client state is the whole editor model. Every control
produces a new document through `_lib/document-ops` (immutable, `newId()` for
new nodes) and hands it to a debounced `saveSiteDraft`. There is no per-field
endpoint and no partial patch protocol — the document *is* the wire format.

| Level | Operations |
|---|---|
| Site | template switch (three templates, current highlighted); effects |
| Page | tabs; add (kind picker `bio`/`shop`/`blog`/`custom`, auto path); title + path edit; delete (confirm, never the last page); effects |
| Section | add (kind picker from `SECTION_KINDS`); rename; reorder up/down; delete (confirm); effects |
| Block | add (type picker from `BLOCK_LIBRARY`); edit title / subtitle / url / imageUrl; reorder up/down; delete; effects |

Caps come from the schema and are enforced in the algebra *and* surfaced as
disabled buttons: 20 pages, 24 sections per page, 40 blocks per section.

### Effects

One dialog per element, opened from a button that shows how many targets are
assigned. Inside, one `EffectPicker` per target:

- site, page and section → `background`, `entrance`;
- block → `surface`, `text`, `background`, `entrance`.

The picker receives the document theme's `--pl-*` vars (`siteThemeVars`) so its
swatches preview against the real palette. Choosing "None" deletes the key
rather than storing `undefined`, so a cleared effect leaves no trace in the
saved JSON.

### Preview

`SiteRenderer` with `mode="preview"`, the *current in-memory* document and the
active page's path — it re-renders on every keystroke, before autosave lands,
so the operator edits against what they see. No `basePath`: preview nav is
inert by design. A desktop/mobile width toggle frames the same document at both
breakpoints (§8 DoD "responsive").

### Publish and rollback

- **Publish** — a dialog takes an optional note; the pending draft is flushed
  first so the snapshot can never lag the screen, then `publish(siteId, note)`
  returns the new version number, which is toasted and shown in history.
- **History** — a panel lists versions newest-first with number, note, date and
  a "live" marker. Every version that is not live offers **Rollback**, behind a
  confirm dialog, and the page refreshes afterwards so the restored draft is the
  one on screen.

### Autosave indicator

The `page-editor.tsx` pattern: a `aria-live="polite"` "Saving…" label that is
visible while a write is pending or in flight and fades otherwise.

## Server actions (`[siteId]/actions.ts`)

All return the dashboard `ActionResult` shape and map the store's thrown access
errors to messages rather than letting them escape as 500s.

| Action | Store call | Returns |
|---|---|---|
| `saveSiteDraft(siteId, document: unknown)` | `saveDraft` | `ActionResult` |
| `publish(siteId, note?)` | `publishSite` | `ActionResult<{ versionNumber }>` |
| `rollback(siteId, number)` | `rollbackSite` | `ActionResult<{ versionNumber }>` |
| `switchTemplate(siteId, template)` | read + `saveDraft` | `ActionResult` |
| `versions(siteId)` | `listVersions` | `ActionResult<VersionRow[]>` |

`switchTemplate` validates against `SITE_TEMPLATES` before touching anything and
patches only `document.template`, re-reading the stored draft so a stale client
cannot clobber a concurrent edit with an old body.

`VersionRow` is `VersionSummary` with `createdAt` as an ISO string — the client
formats it; nothing depends on `Date` surviving the action boundary.

## Non-goals / accepted trade-offs

- **Last write wins.** Two tabs editing one site overwrite each other. Publish
  history makes that recoverable and the operator is a single human per site;
  optimistic concurrency is a later feature.
- **No block `config` editor.** `config` is per-type free-form; the picker seeds
  it from `BLOCK_LIBRARY` defaults and the editor edits the four shared fields.
  A per-type config form belongs with the block definitions, not here.
- **Reorder is buttons, not drag.** Adding `@dnd-kit` here would be a new
  dependency in a nested list; up/down is keyboard-accessible by construction.

## Definition of done

- `/studio/<siteId>` edits pages, sections, blocks and effects, previews live,
  switches template, publishes with a note and rolls back from history.
- Every mutation round-trips through `parseSiteDocument` in the store.
- `apps/web/tests/unit/studio-editor.test.ts` pins the algebra.
- `pnpm --filter @plink/web typecheck && lint && test` green.
