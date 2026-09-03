# Spike — sanitising a whole website out of a language model

**Date:** 2026-09-03 · **Feature:** `feat/website-generator` (F) ·
**Files:** `packages/ai/src/site.ts`, `apps/web/tests/unit/ai-site.test.ts`

## Question

`sanitizeGeneratedPage` sanitises three fields (profile, theme, blocks). A
`SiteDocument` is a tree — pages of sections of blocks, each node carrying an
`EffectAssignment`, over a theme. What changes when the boundary has to walk a
tree instead of read three fields, and what did the frozen Wave 0 signature
force?

## Findings

### 1. The proposal schema and the sanitiser must be allowed to disagree

`siteProposalSchema` exists to shape the JSON schema the gateway sends. It is a
*hint*. `sanitizeSiteDocument` is the law, and it deliberately accepts input the
proposal schema never described, because it is also the re-validation gate for
anything that arrives claiming to be a document (a stale row, a hand-written
one, a server-action payload). Making the two identical would have been the
obvious move and the wrong one: the model-facing schema wants to be small so the
gateway's JSON schema stays cheap, and the sanitiser wants to be paranoid.

Concretely: the proposal schema does not mention `template`, `version` or any
`id` at all. Those are ours. The sanitiser still has to handle input that
contains all three, because a caller can hand it anything.

### 2. Drop the node, not the document

`sanitizeGeneratedBlocks` drops unknown block types and keeps going. A tree
needs the same rule at three levels, and the interesting question is what
"keep going" means when the parent becomes empty. The answer that fell out of
the schema: a page with zero sections is legal, a document with zero pages is
not (`pages: z.array(...).min(1)`). So the sanitiser drops relentlessly at every
level and only the final `safeParse` decides whether anything is left — which is
exactly the "return null only if the final parse fails after all coercion" rule,
arrived at from the schema rather than imposed on it.

### 3. Coerce paths, drop kinds

The two look similar and behave differently. A section `kind` outside
`SECTION_KINDS` is *meaningless* — there is no renderer for it, and guessing
which one the model meant would be inventing content. A page `path` of
`"Shop Page!"` is *malformed but unambiguous*; dropping the page over
punctuation loses real work. So kinds are dropped and paths are repaired
(lowercased, non-`[a-z0-9-/]` folded to dashes, slash-rooted, trailing slash
trimmed), with the page kind's canonical path as the floor.

Paths also get deduplicated, which the schema does not require: two pages on
`/shop` are both legal and one of them is unreachable through `buildSiteNav`.
Legal-but-broken is still broken.

### 4. Effect ids need the registry, and the registry lives in another package

The contract says "drop effect ids not present in the effects registry". The
frozen signature `sanitizeSiteDocument(raw, template)` has nowhere to inject the
id list, so `packages/ai` gained a workspace dependency on `packages/effects`.

Checked against Article V.1 (one-way `app → integrations → core`):
`effects` depends only on `@plink/core`, and `core` depends on nothing in the
workspace, so `ai → effects → core` is still a DAG with no new inbound edge on
`core` and no package reaching upward. `registry.ts` imports two types from
`@plink/core/site-schema` and nothing else — no React, no CSS, no DOM — so it is
safe to pull into a package that runs on the server and in `next build`.

The filter copies `applyEffects`'s rule rather than a looser one: an id survives
only when the registry knows it **and** the entry's `target` matches the key it
was filed under. `{ text: "bg-aurora" }` is dropped, because at render time it
would contribute nothing — and a document that stores decoration which silently
does nothing is a document that lies about what it is.

### 5. Two budgets, not one

The schema caps at 20 pages / 24 sections / 40 blocks. Those exist to stop a
malicious document. A *generated* site gets 6 / 10 / 14 (`SITE_AI_LIMITS`),
because the failure mode of a model is not malice, it is enumeration — asked for
a shop it will happily invent forty products. Both are enforced, the tighter one
first, and the schema ceiling remains the backstop for documents that did not
come from here.

## Decisions worth flagging

**An optional third parameter on the sanitiser.** The spec requires the brief's
`brandColors` as the hex fallback; the frozen signature has two parameters.
`sanitizeSiteDocument(raw, template, brandColors?)` keeps every existing call
site type-correct while letting the generator pass what it knows. The
alternative — merging brand colours into the raw input before sanitising — would
have moved a trust decision outside the boundary, which is worse.

**`buttonRadius` defaults to `md`, not the schema's `"rounded"`.** `"rounded"`
is not an id `BUTTON_RADII` ships, so `radiusCss` falls through to `999px` — the
schema's default silently means "pill". Generated themes pick from the real
radius ids, so a generated site gets the radius it names. Existing documents are
untouched; this only governs what the generator may produce.

**`fontFamily` is `sans | serif | mono`, not `FONT_OPTIONS`.** The site renderer
keeps its own three-entry font map (`siteFontStack`) because the profile fonts
resolve to CSS variables that exist only on profile themes. The generator is
constrained to the map the renderer actually reads.

## Consequences

- Every effect id in the prompt comes from `EFFECTS`, so Feature A's registry is
  the single place an effect is declared — including to the model.
- `sanitizeSiteDocument` is the only function in the feature that needs testing
  hard, and it needs no network: 53 unit tests, zero gateway calls.
- If effect ids are ever renamed, generated documents degrade to "no effect"
  rather than breaking — the same property `effectById` and `applyEffects`
  already have.
