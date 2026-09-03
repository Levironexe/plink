# Tasks — feat/asset-generator

- [x] T1 — Spike: the image API in the installed `ai` package, the gateway
      model id, and the degrade-never-crash policy
      (`docs/spikes/2026-09-03-ai-sdk-image-generation.md`).
- [x] T2 — Spec / plan / tasks under `docs/specs/asset-generator/`, including
      the sanctioned `GeneratedAsset` shape change.
- [x] T3 — `packages/ai/src/assets.ts`: `ASSET_KINDS`, `ASSET_PROMPT_MAX`,
      `ASSET_MIME_TYPES`, `DEFAULT_IMAGE_MODEL`, `isAssetKind`,
      `assetImageModel`, pure `composeAssetPrompt`, and `generateAssetImage`
      over the SDK's `generateImage`. `pnpm --filter @plink/ai typecheck` green.
- [x] T4 — `apps/web/tests/unit/ai-assets.test.ts`: prompt clamping and
      control-char stripping, kind prefixing, purity, `isAssetKind`,
      `assetImageModel` override, `GeneratedAsset` shape, unconfigured error
      path — `ai` SDK mocked, no network, no DB.
- [x] T5 — `apps/web/src/app/api/assets/route.ts`: POST (guards → generate →
      upload → `Asset` row → audit + event) and GET (list per site).
- [x] T6 — `/studio/[siteId]/assets`: server page + `_components/asset-studio.tsx`
      (kind picker, prompt form with pending state, gallery grid with kind
      badge / prompt / date / copy-URL, "not configured" state).
- [x] T7 — Full gate: `pnpm --filter @plink/web typecheck && lint && test` and
      `pnpm --filter @plink/ai typecheck`; tidy commits on
      `feat/asset-generator`.
