# Tasks — feat/versioning-audit

- [x] T1 — Spike: diff semantics decision record
      (`docs/spikes/2026-09-03-diff-semantics-versioning.md`).
- [x] T2 — Pure core: `packages/core/src/site-versioning.ts`
      (`nextVersionNumber`, `diffDocuments`, `stableStringify` internal).
      `pnpm --filter @plink/core typecheck` green.
- [x] T3 — Core unit tests in `apps/web/tests/unit/versioning.test.ts`:
      `nextVersionNumber` edges; `diffDocuments` identity, page add/remove,
      section edit, block add/remove/edit counts, key-order independence.
- [x] T4 — Store: `apps/web/src/lib/site-store.ts` — `requireSiteAccess`,
      `getSiteForUser`, `saveDraft`, `publishSite`, `rollbackSite`,
      `listVersions`, `writeAudit`, `logEvent`.
- [x] T5 — Store unit tests (same file, mocked `@plink/db` + `@/lib/auth`):
      ownership rejection (UNAUTHENTICATED/FORBIDDEN/NOT_FOUND), invalid
      document rejection, version numbering across publishes, rollback
      creates a new version + restores the draft, listVersions ordering +
      `isPublished`, audit/event rows written.
- [x] T6 — API routes: `versions` (GET), `publish` (POST), `rollback`
      (POST) under `apps/web/src/app/api/sites/[id]/`, shared
      `store-errors.ts` mapper.
- [x] T7 — Full gate: `pnpm --filter @plink/web typecheck && lint && test`,
      `pnpm --filter @plink/core typecheck`; commit sequence tidy.
