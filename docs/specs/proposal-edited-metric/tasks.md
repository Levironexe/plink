# Tasks — feat/proposal-edited-metric

- [x] T1 — Contract artifacts: `spec.md`, `plan.md`, `tasks.md` under
      `docs/specs/proposal-edited-metric/` (constitution VII.1).
- [x] T2 — Spike: why the signal fires at publish time rather than through an
      editor-session `generationId`, and how "measured exactly once" is
      derived from `EventLog` with the schema frozen
      (`docs/spikes/2026-09-03-proposal-edited-at-publish-time.md`).
- [x] T3 — Store: private `recordAiProposalOutcome` helper in
      `apps/web/src/lib/site-store.ts` — latest applied `site` generation,
      EventLog-derived idempotency, `safeParseSiteDocument` on both sides,
      `diffDocuments`, `ai_proposal_kept_verified` / `ai_proposal_edited`.
      Never throws.
- [x] T4 — Wire it into `publishSite` after the snapshot transaction commits;
      publish result unchanged.
- [x] T5 — Unit tests `apps/web/tests/unit/proposal-metric.test.ts` (mocked
      `@plink/db`, no database): no generation; identical document →
      `ai_proposal_kept_verified` + zero diff; edited → `ai_proposal_edited`
      + real counts; second publish → no duplicate; `proposed`/`discarded`
      ignored; unparseable output → no event, publish ok; metric write
      rejects → publish still `{ ok: true, versionNumber }`.
- [x] T6 — One-line update to `docs/specs/website-generator/spec.md`
      *Future work*, pointing `ai_proposal_edited` at what shipped.
- [x] T7 — Full gate: `pnpm --filter @plink/web typecheck && lint && test`.
