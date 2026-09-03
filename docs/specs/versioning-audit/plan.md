# Plan — feat/versioning-audit

## Shape of the change

Three layers, one-way dependencies (constitution V.1):

```
api/sites/[id]/{versions,publish,rollback}/route.ts   (thin HTTP mapping)
        └── apps/web/src/lib/site-store.ts            (auth + prisma glue)
                └── packages/core/src/site-versioning.ts  (pure math)
                └── packages/core/src/site-schema.ts      (existing)
```

## Key decisions

1. **Diff semantics** (recorded in
   `docs/spikes/2026-09-03-diff-semantics-versioning.md`): pages keyed by
   `path`, sections/blocks matched by `id`, JSON compared with a local
   key-order-independent `stableStringify` (no new deps). A block edit marks
   its enclosing section changed — the section's JSON literally differs —
   so `sectionsChanged ≥` "sections containing block edits" by design.
   Added/removed containers are reported once, at the coarsest unit.

2. **Ownership helper**: one internal `requireSiteAccess(siteId)` in
   site-store returns `{ user, site }` and throws
   UNAUTHENTICATED/NOT_FOUND/FORBIDDEN in that order (auth before
   existence, existence before ownership). `getSiteForUser` is the public
   face returning just the site.

3. **Atomicity**: `publishSite`/`rollbackSite` run an *interactive*
   `prisma.$transaction` — read existing version numbers, create the
   snapshot, update the site — so concurrent publishes can't race the
   monotonic number (`@@unique([siteId, number])` backstops). Audit + event
   rows are written inside the same transaction (constitution III.3: an
   important operation without its audit row must not commit). `saveDraft`
   writes document + audit without a transaction — a draft save is
   low-stakes and autosave-frequency.

4. **Audit payloads**: publish `after = {"version":N}` (frozen by contract);
   rollback `after = {"version":N,"restoredFrom":M}`; save `after` = the
   `diffDocuments` summary vs the previous draft (compact, human-readable,
   reuses the pure core). Full document history lives in `SiteVersion`, not
   `AuditLog` — audit rows stay small.

5. **Error channels**: thrown errors are *access* failures (who/where);
   `{ ok: false; error }` results are *domain* failures (bad document,
   unknown version). Routes map the former to 401/403/404 and the latter to
   400. A shared `apps/web/src/app/api/sites/store-errors.ts` holds the
   6-line mapper so the three route files stay thin and identical in shape.

6. **Testing seam**: `vi.mock("@plink/db")` with a tiny in-memory table
   store (pattern proven in `tokens.test.ts`), `vi.mock("@/lib/auth")` for
   the session user, `vi.mock("server-only")` so the store module imports
   under vitest. The mock `$transaction` supports both the interactive
   callback and array forms by delegating to the same mock client.

## Risks

- Zod-normalized JSON vs stored JSON key order → neutralized by
  stableStringify in `diffDocuments`.
- `SiteVersion.document` is the *string* column copied verbatim on rollback —
  no re-parse loss; but publish re-validates the draft before snapshotting so
  a corrupt draft can never become a version.
- Next 16 route handlers take `params` as a Promise (verified against
  `node_modules/next/dist/docs/.../route.md` and the existing
  `api/broadcasts/[id]/send/route.ts`).
