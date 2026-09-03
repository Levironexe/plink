# Tasks — feat/website-generator

- [ ] T1 — Speckit artifacts: `spec.md`, `plan.md`, `tasks.md`. Commit.
- [ ] T2 — `packages/ai/src/site.ts`: proposal schema built from the real
      catalogues, `sanitizeSiteDocument` (theme/effects/pages/sections/blocks,
      forced template, fresh ids, final `safeParse`), `siteSystemPrompt`,
      `siteUserPrompt`, `generateSiteDocument`. Add the `@plink/effects`
      workspace dependency. Commit.
- [ ] T3 — `apps/web/tests/unit/ai-site.test.ts`: sanitiser only, no gateway.
      Round-trip, unknown kinds/types dropped, forced template, URL scheme
      stripping, effect id filtering, hex + brandColors defaults, null on
      hopeless input, id regeneration, caps. Commit with T2 green.
- [ ] T4 — `apps/web/src/app/api/ai/site/route.ts`: auth → `aiEnabled` → rate
      limit → body → `requireSite` → brief → generate → `AiGeneration` row +
      `ai_proposal_created` event. Commit.
- [ ] T5 — `/studio/[siteId]/generate/actions.ts`: `applyProposal`,
      `discardProposal` (ActionResult, audit + event writes). Commit.
- [ ] T6 — `/studio/[siteId]/generate/page.tsx` + `_components/generate-flow.tsx`:
      not-configured / no-brief / ready states, page-tabbed `SiteRenderer`
      preview, Apply · Discard · Regenerate. Commit.
- [ ] T7 — Spike `docs/spikes/2026-09-03-site-generator-sanitizer.md`. Commit.
- [ ] T8 — Gate: `pnpm --filter @plink/web typecheck && lint && test` plus
      `pnpm --filter @plink/ai typecheck` green; tasks checked off; final commit.
