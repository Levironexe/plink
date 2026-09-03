# Spec — feat/proposal-edited-metric: an honest kept / edited / discarded ratio

Product Plan VI §6 (delivery metrics) and §8 (DoD: delivery metrics recorded).
Lands the `ai_proposal_edited` event reserved by
`docs/specs/website-generator/spec.md` (*Future work*).

## Problem

Today the generator records `ai_proposal_kept` the moment a human clicks
*Apply* — before they have looked at a single section in the editor. An
operator who applies a proposal, then rewrites every headline, deletes two
sections and adds a page, still shows up in the metrics as a clean "kept".
The kept/discarded ratio plan §6 asks for is therefore an *acceptance* ratio,
not a *quality* ratio: it measures whether the proposal was worth opening, not
whether it was worth shipping.

The missing signal is the human edit distance between what the model proposed
and what the operator actually published.

## Constitution constraints (binding)

- **III.4** — prompts, outputs *and human edits* of AI generations are
  recorded to improve the workflow. This feature is the "human edits" half.
- **III.3** — the metric is an observation, never a mutation of business
  state: it writes one `EventLog` row and nothing else. It must not be able
  to prevent or roll back the publish it observes.
- **II.3** — the Prisma schema is frozen. No new column, no migration; the
  bookkeeping this feature needs is derived from existing rows.
- **I.1** — the metric runs inside `publishSite`, after ownership has already
  been established; it introduces no new entry point and reads only rows
  scoped to the site being published.
- **V.1** — `@plink/core` stays pure and untouched; `diffDocuments` is
  consumed as-is.
- **VI.2** — behavior pinned by unit tests against a mocked `@plink/db`.

## Approach in one sentence

At publish time — the moment a human has finished editing and committed to a
result — diff the published document against the proposal that seeded it, and
record `ai_proposal_kept_verified` (byte-for-byte the model's work) or
`ai_proposal_edited` (with the real diff counts).

Why publish time and not an editor-session `generationId`: see
`docs/spikes/2026-09-03-proposal-edited-at-publish-time.md`.

## Contract

### `publishSite(siteId, note?)` — behavior added

After the version snapshot transaction commits (and only then), the store
attributes the published document to the AI proposal that seeded it:

1. **Find the generation.** The most recent `AiGeneration` with
   `siteId = <this site>`, `kind = "site"`, `status = "applied"` and
   `createdAt` at or before this publish. No such row → no event at all: a
   hand-built site must not emit an AI metric.
2. **Skip if already credited.** Each generation is measured exactly once.
   With the schema frozen there is no `creditedAt` column, so "already
   credited" is derived from the event store itself: an existing
   `ai_proposal_kept_verified` **or** `ai_proposal_edited` row for this site
   whose `data.generationId` equals the generation's id means the work has
   been counted, and the second publish is silent.
3. **Diff.** Both `AiGeneration.output` (the proposal) and the published
   document go through `safeParseSiteDocument`. If *either* fails to parse,
   no event: an unattributable publish is better than a guessed metric.
   Otherwise `diffDocuments(proposal, published)`.
4. **Classify.** An empty diff (`pagesAdded` and `pagesRemoved` empty,
   `sectionsChanged === 0`, `blocksChanged === 0`) →
   `ai_proposal_kept_verified`. Anything else → `ai_proposal_edited`.
5. **Record.** One `EventLog` row via the existing `logEvent`, carrying
   `{ generationId, pagesAdded, pagesRemoved, sectionsChanged, blocksChanged }`
   and the publishing user + site.

`publishSite`'s signature, result shape, transaction, audit row and `publish`
event are unchanged. The return value is unchanged.

### Failure policy (load-bearing)

The whole attribution lives in one private helper that **never throws**. A
failing metric — a dead read, a malformed row, a rejected insert — leaves the
publish successful and reports `{ ok: true, versionNumber }`. The helper runs
*outside* the publish transaction precisely so a telemetry write can never
roll back a version snapshot. Metrics must not break the product.

### Event types

| Event | Meaning | `data` |
|---|---|---|
| `ai_proposal_kept_verified` | published exactly what the model proposed | `{ generationId, pagesAdded: [], pagesRemoved: [], sectionsChanged: 0, blocksChanged: 0 }` |
| `ai_proposal_edited` | published a human-rewritten version of the proposal | `{ generationId, pagesAdded, pagesRemoved, sectionsChanged, blocksChanged }` |

The existing `ai_proposal_kept` (logged at *apply* time by
`studio/[siteId]/generate/actions.ts`) keeps its current meaning — "the
operator chose to work with this proposal" — and is not modified. Read
together: `kept` = accepted, `kept_verified` + `edited` = shipped, and
`edited / (kept_verified + edited)` is the human-effort ratio plan §6 wants.

## Out of scope

- Any change to `applyProposal` / `discardProposal` or the studio UI.
- Writing the edited document back into `AiGeneration.finalApplied` (a
  schema-owner concern; the event carries the same information without a
  write to a frozen model).
- Dashboard/reporting surfaces for the new events.
- Attributing a publish to more than one generation (regenerate-then-publish
  credits the latest applied proposal only).

## Acceptance

- `pnpm --filter @plink/web typecheck && lint && test` green.
- `apps/web/tests/unit/proposal-metric.test.ts` covers, with a mocked
  `@plink/db` and no database: no generation → no event; identical document →
  `ai_proposal_kept_verified` with a zero diff; edited document →
  `ai_proposal_edited` with real counts; a second publish of the same
  generation → no duplicate; `proposed`/`discarded` generations ignored;
  unparseable `output` → no event and a successful publish; a throwing metric
  → publish still returns `{ ok: true, versionNumber }`.
