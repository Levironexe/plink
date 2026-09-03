# Tasks — feat/website-generator

- [x] T1 — Speckit artifacts: `spec.md`, `plan.md`, `tasks.md`. Commit.
- [x] T2 — `packages/ai/src/site.ts`: proposal schema built from the real
      catalogues, `sanitizeSiteDocument` (theme/effects/pages/sections/blocks,
      forced template, fresh ids, final `safeParse`), `siteSystemPrompt`,
      `siteUserPrompt`, `generateSiteDocument`. Add the `@plink/effects`
      workspace dependency. Commit.
- [x] T3 — `apps/web/tests/unit/ai-site.test.ts`: sanitiser only, no gateway.
      Round-trip, unknown kinds/types dropped, forced template, URL scheme
      stripping, effect id filtering, hex + brandColors defaults, null on
      hopeless input, id regeneration, caps. Commit with T2 green. (53 tests)
- [x] T4 — `apps/web/src/app/api/ai/site/route.ts`: auth → `aiEnabled` → rate
      limit → body → `requireSite` → brief → generate → `AiGeneration` row +
      `ai_proposal_created` event. Commit.
- [x] T5 — `/studio/[siteId]/generate/actions.ts`: `applyProposal`,
      `discardProposal` (ActionResult, audit + event writes). Commit.
- [x] T6 — `/studio/[siteId]/generate/page.tsx` + `_components/generate-flow.tsx`:
      not-configured / no-brief / ready states, page-tabbed `SiteRenderer`
      preview, Apply · Discard · Regenerate. Commit.
- [x] T7 — Spike `docs/spikes/2026-09-03-site-generator-sanitizer.md`. Commit.
- [x] T8 — Gate: `pnpm --filter @plink/web typecheck && lint && test` plus
      `pnpm --filter @plink/ai typecheck` green; tasks checked off; final commit.
