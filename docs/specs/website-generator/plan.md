# Plan — feat/website-generator

## Shape of the work

Three layers, each with its own trust level:

```
Brief (DB, already validated by C)
  → siteUserPrompt()            composed, stored verbatim on AiGeneration.prompt
  → gateway + siteProposalSchema  what we ASK for (a narrow JSON schema)
  → sanitizeSiteDocument()      what we ACCEPT   ← the only authority
  → SiteDocument                the studio previews, the human applies
  → saveDraft()                 Feature D's writer; never publishes
```

The proposal schema and the sanitiser deliberately disagree: the schema is a
hint to the model, the sanitiser is the law. Everything the schema permits the
sanitiser re-checks, and the sanitiser accepts input the schema never described
(a hand-written document, a stale row, a mangled fetch) because it is also the
re-validation gate for the server action path.

## Decisions

**D1 — mirror `generate.ts` exactly for the call.** `generateText` +
`Output.object` + `modelFor("page")`, not a bare `generateObject` import. One
call shape in the package means one place to change when the SDK moves.

**D2 — `packages/ai` gains a workspace dependency on `packages/effects`.** The
sanitiser's contract includes "drop effect ids not in the registry" and the
frozen signature has no room to inject the id list. `effects` depends only on
`@plink/core`, so `ai → effects → core` stays a DAG and Art. V's one-way
direction holds. Spike: `docs/spikes/2026-09-03-site-generator-sanitizer.md`.

**D3 — an optional third parameter on the sanitiser.**
`sanitizeSiteDocument(raw, template, brandColors?)`. The first two parameters
and the return type are exactly the Wave 0 stub's, so every existing caller
still typechecks; the optional third carries the brief's brand colours as the
hex fallback the spec requires. Deviation recorded in the final report.

**D4 — Apply re-reads the stored proposal.** The browser sends only
`{ siteId, generationId }`. A server action is a public endpoint, and the
cheapest way to make a tampered document impossible is never to accept one.
This also makes `finalApplied` provably equal to `output` in V1, which is what
lets the `ai_proposal_edited` path stay honest future work.

**D5 — Regenerate discards.** A standing proposal the operator regenerates past
is a discard, and the metric should say so rather than leaving orphan
`proposed` rows that look like unfinished work.

**D6 — Caps below the schema ceiling.** The schema allows 20 pages / 24 sections
/ 40 blocks; a *generated* site gets 6 / 10 / 14. The ceiling exists to stop
malicious documents; the generator budget exists to stop a model that starts
enumerating. Both are enforced, the tighter one first.

## Build order

1. Speckit artifacts (this directory) — commit.
2. `packages/ai/src/site.ts` + the `@plink/effects` dependency — the sanitiser
   first, the prompt and gateway call second. Commit.
3. `apps/web/tests/unit/ai-site.test.ts` — pure sanitiser tests, no network.
   Commit.
4. `apps/web/src/app/api/ai/site/route.ts`. Commit.
5. `/studio/[siteId]/generate` — server page, `actions.ts`, `GenerateFlow`.
   Commit.
6. Spike + verification gate. Commit.

## Risks

| Risk | Mitigation |
|---|---|
| Model returns a document that sanitises to zero pages | `siteDocumentSchema` requires ≥ 1 page, so the sanitiser returns null and the route answers 502 rather than saving an empty site |
| Long generation exceeds the function budget | `maxDuration = 60` on the route, 55 s gateway timeout, `maxRetries: 1`, coarse 502 |
| Feature E lands `/studio/[siteId]/layout.tsx` after me | My files live only in `generate/`; a layout wrapping them is additive |
| Effect ids renamed later | Ids are frozen by the plan's global constraints; unknown ids already degrade to "no effect" everywhere |
