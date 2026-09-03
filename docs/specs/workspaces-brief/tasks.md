# Tasks — feat/workspaces-brief

- [ ] T1 — `apps/web/src/lib/workspace.ts`: pure helpers (`baseSlug`,
      `uniqueSlug`, `resolveTemplate`, `validateBrief`, `parseBriefJson`) +
      guards (`requireWorkspace`, `requireSite`). Commit.
- [ ] T2 — `apps/web/tests/unit/workspace.test.ts`: slug generation +
      collision suffixing, template fallback, brief validation glue, guard
      auth matrix with mocked `@plink/db` / `@/lib/auth`. Commit with T1 green.
- [ ] T3 — `apps/web/src/app/studio/actions.ts`: `createWorkspace`,
      `createSite`, `saveBrief`, `submitBrief` + audit writes. Commit.
- [ ] T4 — `apps/web/src/app/api/workspaces/route.ts`: GET (401 unauth).
      Commit.
- [ ] T5 — `/studio` page + `_components` (workspace create form, new site
      modal, site cards). Commit.
- [ ] T6 — `/studio/brief/[siteId]` page + `BriefForm` covering every
      BriefData field, Save/Submit, submitted state. Commit.
- [ ] T7 — Spike doc `docs/spikes/2026-09-03-workspace-guards-and-slugs.md`.
      Commit.
- [ ] T8 — Gate: `pnpm --filter @plink/web typecheck && lint && test` all
      green; tasks checked off; final commit.
