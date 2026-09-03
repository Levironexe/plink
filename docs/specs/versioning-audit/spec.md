# Spec — feat/versioning-audit: publish pipeline, rollback, audit log, event store

Feature D of the Creator Website OS plan
(`docs/superpowers/plans/2026-09-03-creator-website-os.md`). Product Plan VI §4
(principles), §6 (delivery metrics), §8 (DoD: preview/publish/rollback, audit
log on important operations, delivery metrics recorded).

## Problem

Sites are JSON documents (`@plink/core/site-schema`) stored in `Site.document`.
Today there is no way to snapshot a draft into an immutable version, publish
it, roll back to an earlier version, or answer "who changed what, when". The
Wave-2 studio UI (Feature E) needs a frozen API surface for all of that.

## Constitution constraints (binding)

- **III.3** — every significant mutation is auditable (who/what/when,
  before/after) and reversible: rollback never rewrites history, it always
  produces a *new* version.
- **I.1** — every route/store function authenticates and scopes by owner
  (`site.workspace.ownerId === current user id`).
- **II.3** — the Prisma schema is frozen for this feature; models `Site`,
  `SiteVersion`, `AuditLog`, `EventLog` are consumed as-is.
- **V.1** — `@plink/core` stays pure: no I/O, no prisma, no workspace deps.
- **VI.2** — behavior pinned by unit tests, no database access in tests.

## Public contract (frozen — E and F call every one of these)

### `packages/core/src/site-versioning.ts` (pure)

- `nextVersionNumber(existing: number[]): number` — `max + 1`; `1` for empty.
- `diffDocuments(a: SiteDocument, b: SiteDocument): { pagesAdded: string[]; pagesRemoved: string[]; sectionsChanged: number; blocksChanged: number }`
  - Pages are keyed by `path`. `pagesAdded` = paths present in `b` only;
    `pagesRemoved` = paths present in `a` only (each list in `b`/`a` order).
  - For pages present in both, sections are matched **by id**. A section
    counts as changed when its JSON differs — and since a section's JSON
    contains its blocks, a block-level edit also marks the enclosing section
    changed. A section added to or removed from a matching page also counts
    as changed (its JSON differs from absence).
  - `blocksChanged` counts block-level adds, removes and edits (matched by
    block id, compared as JSON) across **matching sections** — sections
    present in both versions of a matching page. Blocks inside added/removed
    sections or pages are not double-counted; the coarser unit reports them.
  - JSON comparison is key-order independent (stable stringify), so a
    document that round-tripped through storage never reads as "changed".

### `apps/web/src/lib/site-store.ts` (server-only prisma glue)

Every function resolves the current user via `getCurrentUser()` and checks
ownership through `site.workspace.ownerId`. Failure modes are thrown errors
with exact messages: `Error("UNAUTHENTICATED")`, `Error("FORBIDDEN")`,
`Error("NOT_FOUND")`.

- `getSiteForUser(siteId: string)` → the `Site` row (with `workspace`
  included), or throws.
- `saveDraft(siteId: string, document: unknown)` → gated by
  `parseSiteDocument`; invalid input returns `{ ok: false; error: string }`
  and writes nothing; valid input writes the normalized JSON to
  `Site.document` and returns `{ ok: true }`. Audit `site.save` (the `after`
  column records the `diffDocuments` summary against the previous draft when
  the previous draft still parses).
- `publishSite(siteId: string, note?: string)` →
  `Promise<{ ok: true; versionNumber: number } | { ok: false; error: string }>`.
  Snapshots `Site.document` into a new `SiteVersion` (number =
  `nextVersionNumber` over the site's existing numbers), sets
  `Site.publishedVersionId` and `status = "published"`, audits
  `site.publish` with `after = {"version":N}`, records event `publish`.
  A draft that no longer parses refuses to publish (`{ ok: false }`).
  Version create + site update happen in one transaction.
- `rollbackSite(siteId: string, versionNumber: number)` → same result shape.
  Copies that version's frozen document into `Site.document` **and**
  publishes it as a *new* version (note `Rollback to vN`) — history is never
  rewritten. Audits `site.rollback`, records event `rollback`. An unknown
  version number returns `{ ok: false; error }`.
- `listVersions(siteId: string)` →
  `[{ id, number, note, createdAt, isPublished }]`, newest first;
  `isPublished` marks the row matching `Site.publishedVersionId`.
- `writeAudit(entry: { userId?; siteId?; action; before?; after? })` and
  `logEvent(entry: { userId?; siteId?; type; data? })` — thin creators over
  `AuditLog` / `EventLog`, exported for reuse by Features C/E/F.

### API routes (thin wrappers; JSON responses)

| Route | Method | Body | 200 response |
| --- | --- | --- | --- |
| `/api/sites/[id]/versions` | GET | — | `{ versions }` |
| `/api/sites/[id]/publish` | POST | `{ note? }` | `{ versionNumber }` |
| `/api/sites/[id]/rollback` | POST | `{ number }` | `{ versionNumber }` |

Store errors map to status codes: `UNAUTHENTICATED` → 401, `FORBIDDEN` → 403,
`NOT_FOUND` → 404. A `{ ok: false }` store result (invalid draft, unknown
version, malformed body) → 400 with `{ error }`. Anything else → 500.

## Out of scope

- Studio UI (Feature E), AI generation events (Feature F).
- Any Prisma schema change or migration.
- Draft autosave debouncing (client concern; `saveDraft` is the primitive).

## Acceptance

- `pnpm --filter @plink/web typecheck && pnpm --filter @plink/web lint &&
  pnpm --filter @plink/web test` green; `pnpm --filter @plink/core typecheck`
  green.
- `apps/web/tests/unit/versioning.test.ts` covers: `nextVersionNumber`
  edges; `diffDocuments` page add/remove, section edit, block add/edit
  counts; store ownership rejection, invalid document rejection, version
  numbering across publishes, rollback-creates-a-new-version — all against a
  mocked `@plink/db`, no database.
