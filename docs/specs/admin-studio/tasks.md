# Tasks — feat/admin-studio

- [ ] T1 — Spec, plan, tasks (`docs/specs/admin-studio/`) + spike on editor
      state and document algebra (`docs/spikes/2026-09-03-studio-editor-state.md`).
- [ ] T2 — Pure algebra `apps/web/src/app/studio/[siteId]/_lib/document-ops.ts`:
      page add/remove/update + path uniqueness, section add/rename/move/remove,
      block add/update/move/remove, `readEffects` / `setEffect` by scope,
      `switchDocumentTemplate` validation, schema caps as total no-ops.
- [ ] T3 — Unit tests `apps/web/tests/unit/studio-editor.test.ts` covering every
      op, including the bracketed import path resolving under vitest.
- [ ] T4 — Server actions `[siteId]/actions.ts`: `saveSiteDraft`, `publish`,
      `rollback`, `switchTemplate`, `versions`; `withStore` error mapping.
- [ ] T5 — Server page `[siteId]/page.tsx`: access + parse + seeded history +
      unreadable-draft recovery card; metadata `noindex`.
- [ ] T6 — Editor chrome primitives + effects dialog + template switcher.
- [ ] T7 — Page tabs, section cards, block cards, add-block dialog.
- [ ] T8 — Preview pane and publish/history panel; wire the whole editor
      together with autosave.
- [ ] T9 — Full gate: `pnpm --filter @plink/web typecheck && lint && test`.
