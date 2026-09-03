# Tasks — feat/admin-studio

- [x] T1 — Spec, plan, tasks (`docs/specs/admin-studio/`) + spike on editor
      state and document algebra (`docs/spikes/2026-09-03-studio-editor-state.md`).
- [x] T2 — Pure algebra `apps/web/src/app/studio/[siteId]/_lib/document-ops.ts`:
      page add/remove/update + path uniqueness, section add/rename/move/remove,
      block add/update/move/remove, `readEffects` / `setEffect` by scope,
      `switchDocumentTemplate` validation, schema caps as total no-ops.
- [x] T3 — Unit tests `apps/web/tests/unit/studio-editor.test.ts` (32 cases)
      covering every op; the bracketed import path resolves under vitest.
- [x] T4 — Server actions `[siteId]/actions.ts`: `saveSiteDraft`, `publish`,
      `rollback`, `switchTemplate`, `versions`; `withStore` error mapping.
- [x] T5 — Server page `[siteId]/page.tsx`: access + parse + seeded history +
      unreadable-draft recovery card; `noindex` metadata; shell nav linking the
      brief, the sibling features' `generate` / `assets` routes and the live site.
- [x] T6 — Editor chrome primitives, effects dialog, template switcher.
- [x] T7 — Page tabs, section cards, block cards, block picker.
- [x] T8 — Preview pane and publish/history panel; editor wired together with
      serialised autosave.
- [x] T9 — Full gate: `pnpm --filter @plink/web typecheck && lint && test`
      green (371 tests, 18 files); `next build` compiles `/studio/[siteId]`.

## Deviations from the plan

- The block picker did not need a file of its own: page kind, section kind and
  block type are the same dialog with different options, so `ChoiceDialog` in
  `editor-chrome.tsx` serves all three.
- Autosave is a serialised promise chain around `useDebouncedSave` rather than
  a bare debounce. Awaiting it before a publish is what guarantees the snapshot
  is never older than the screen; a bare `flush()` returns `void` and cannot be
  awaited.
- The page path field commits on blur/Enter instead of on every keystroke —
  normalising per character swallowed separators mid-word.
