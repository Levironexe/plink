# Tasks — feat/workspaces-brief

- [x] T1 — `apps/web/src/lib/workspace.ts`: pure helpers (`baseSlug`,
      `uniqueSlug`, `resolveTemplate`, `validateBrief`, `parseBriefJson`) +
      guards (`requireWorkspace`, `requireSite`). Commit.
- [x] T2 — `apps/web/tests/unit/workspace.test.ts`: slug generation +
      collision suffixing, template fallback, brief validation glue, guard
      auth matrix with mocked `@plink/db` / `@/lib/auth`. Commit with T1 green.
- [x] T3 — `apps/web/src/app/studio/actions.ts`: `createWorkspace`,
      `createSite`, `saveBrief`, `submitBrief` + audit writes. Commit.
- [x] T4 — `apps/web/src/app/api/workspaces/route.ts`: GET (401 unauth).
      Commit.
- [x] T5 — `/studio` page + `_components` (workspace create form, new site
      modal, site cards). Commit.
- [x] T6 — `/studio/brief/[siteId]` page + `BriefForm` covering every
      BriefData field, Save/Submit, submitted state. Commit.
- [x] T7 — Spike doc `docs/spikes/2026-09-03-workspace-guards-and-slugs.md`.
      Commit.
- [x] T8 — Gate: `pnpm --filter @plink/web typecheck && lint && test` all
      green; tasks checked off; final commit.
