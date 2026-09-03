# Tasks — feat/asset-apply

- [x] T1 — Spike: what the renderer actually paints, the hero rule and its
      rejected alternatives, block addressing, no-op identity, toast ownership
      (`docs/spikes/2026-09-03-asset-placement-targets.md`).
- [x] T2 — Spec / plan / tasks under `docs/specs/asset-apply/`, including the
      sanctioned hero-rule deviation.
- [x] T3 — `assets/_lib/apply-asset.ts`: `AssetTarget`, `AssetTargetOption`,
      `isAssetTarget`, `applyAssetToDocument`, `imageTargets` — pure, immutable,
      total, `LIMITS` reused from `_lib/document-ops.ts`.
- [x] T4 — `apps/web/tests/unit/asset-apply.test.ts`: every branch of the helper
      (hero into an image block, empty hero, header-only hero, missing hero
      section, deep block by id, unknown ids as reference-equal no-ops, both
      caps), the immutability and `parseSiteDocument` invariants on every
      result, and `imageTargets` filtering / labelling / ordering. No DB, no
      network.
- [x] T5 — `assets/actions.ts`: `applyAsset` — shape guard, http(s) + length
      guard, `getSiteForUser`, parse, apply, `saveDraft`, audit `asset.apply`,
      event `asset_applied`, `revalidatePath`. Draft only.
- [x] T6 — UI: `assets/page.tsx` passes `imageTargets(...)`;
      `_components/asset-studio.tsx` gains the "Place in site" select + button
      per card, a `ToastProvider`, and keeps copy-URL. Design tokens only.
- [x] T7 — Full gate: `pnpm --filter @plink/web typecheck && lint && test`;
      tidy commits on `feat/asset-apply`.
