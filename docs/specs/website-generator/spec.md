# Spec — feat/website-generator

Brief → a complete `SiteDocument` proposal, reviewed by a human before a single
byte reaches the site's draft. Feature F of the Creator Website OS
(`docs/superpowers/plans/2026-09-03-creator-website-os.md`).

## Problem

Wave 1 gave the operator a brief (`Brief.data`, Feature C), a schema
(`@plink/core/site-schema`, Wave 0), a renderer (Feature B) and a publish
pipeline (Feature D). Nothing yet turns the brief into a first draft — the
operator still assembles pages by hand, which is exactly the "per-client code"
the product plan exists to abolish.

## Users and scope

- **Operator** — the authenticated Plink user who owns the workspace that owns
  the site. Every read and write is scoped through `requireSite` (Art. I).
- In scope: model call, sanitiser, `POST /api/ai/site`, `/studio/[siteId]/generate`
  (propose → review → apply | discard | regenerate), `AiGeneration` provenance
  rows and `EventLog` metrics.
- Out of scope: editing the proposal before applying (the `ai_proposal_edited`
  path — see *Future work*), asset generation (Feature G), the editor shell
  (`/studio/[siteId]`, Feature E), publishing (Feature D — applying writes the
  **draft** only, never the live site).

## Principles this feature is bound by

- **Art. III.2** — AI produces *site configuration conforming to the schema*,
  never source code, and never writes to the database on its own. It proposes;
  a human applies.
- **Art. I.2** — model output is untrusted even after it validates against the
  schema we handed the model. `sanitizeSiteDocument` is the one boundary that
  decides what may reach the database or the DOM.
- **Art. III.4** — the prompt, the raw proposal and what the human actually
  applied are all recorded (plan §6).

## Functional requirements

### FR1 — `packages/ai/src/site.ts`

**`generateSiteDocument({ brief, template }): Promise<SiteDocument>`**

- Builds the system prompt from the *real* catalogues, never a hand-copied list:
  `BLOCK_LIBRARY` (`@plink/core/blocks`), `SECTION_KINDS` / `PAGE_KINDS`
  (`@plink/core/site-schema`), and `EFFECTS` grouped by `target`
  (`@plink/effects/registry`). Same construction as `pageSystemPrompt()`.
- Calls the AI Gateway with `generateText` + `Output.object` and
  `modelFor("page")` — the exact call shape of `packages/ai/src/generate.ts`.
  No key is read at import time; `aiEnabled()` is the caller's gate.
- Passes the raw output through `sanitizeSiteDocument(raw, template, brief.brandColors)`
  and throws `Error("SITE_PROPOSAL_INVALID")` when the sanitiser returns null.

**`sanitizeSiteDocument(raw, template, brandColors?): SiteDocument | null`**

Pure, no I/O, never throws. Rules, in order:

1. `version` is forced to `1`; `template` is forced to the **argument**, never
   whatever the model or the caller's JSON says (an unknown template argument
   degrades to `"editorial"` rather than failing).
2. Theme colours must be `#rgb`/`#rrggbb`; anything else falls back — accent to
   `brandColors.accent`, text/button fill to `brandColors.primary`, the rest to
   the schema's own defaults. `buttonStyle`, `buttonRadius` and `fontFamily` are
   picked from fixed vocabularies the renderer understands.
3. Effect ids survive only when the registry has that exact id **and** the entry's
   `target` matches the key it was filed under, and it is not `none` — the same
   rule `applyEffects` enforces at render time. Everything else is dropped.
4. Pages with a `kind` outside `PAGE_KINDS` are dropped; sections outside
   `SECTION_KINDS` are dropped; blocks whose `type` is not in `BLOCK_LIBRARY`
   are dropped (`blockDefinition` is the only authority).
5. Every string is passed through `clampText` (control characters stripped,
   length capped); every URL through `safeHttpUrl` (http/https only — no
   `javascript:`, `data:`, protocol-relative or relative values); every block
   `config` through `sanitizeBlockConfig`.
6. Page paths are coerced to the schema's `^\/[a-z0-9\-/]*$` shape, deduplicated,
   and derived from the page kind when unusable.
7. Collections are capped below the schema's ceilings: ≤ 6 pages, ≤ 10 sections
   per page, ≤ 14 blocks per section.
8. Every `id` is minted fresh with `newId()` — the model never chooses an id.
9. The result is re-validated with `siteDocumentSchema.safeParse`. `null` is
   returned **only** when that final parse fails after all coercion.

### FR2 — `POST /api/ai/site`

Body `{ siteId }`. Mirrors `api/ai/page/route.ts` conventions in order:

| Step | Failure |
|---|---|
| `getSessionUserId()` | 401 `Not signed in` |
| `aiEnabled()` | 503 `{ code: "ai_disabled" }` |
| `rateLimit("ai:site:<userId>", 6, 1h)` | 429 with `Retry-After` |
| body parse | 422 |
| `requireSite(siteId)` | 401/403 via `storeErrorResponse` |
| `Brief` row present and non-empty | 400 `{ code: "no_brief" }` |
| `generateSiteDocument` | 502 (coarse — the prompt and the key are never logged) |

On success it creates one `AiGeneration` row (`kind: "site"`, `prompt` = the
composed user prompt, `output` = the sanitised proposal JSON, `status: "proposed"`),
logs the `ai_proposal_created` event and returns `{ generationId, document, remaining }`.
Nothing else is written — the site's draft is untouched until a human applies.

### FR3 — `/studio/[siteId]/generate`

Server page: `requireSite` (foreign or missing site → 404, no existence leak),
a brief summary, and three states —

- **AI not configured** (`!aiEnabled()`): the dashboard's `AI_GATEWAY_API_KEY`
  panel, copied in tone and wording.
- **No brief yet**: an `EmptyState` linking to `/studio/brief/[siteId]`.
- **Ready**: the client `GenerateFlow`.

`GenerateFlow` (client): Generate → `POST /api/ai/site` → the proposal rendered
through `SiteRenderer` with `mode="preview"` and page tabs, plus a structure
summary. Three exits:

- **Apply** — server action `applyProposal(siteId, generationId)`. Nothing about
  the document travels back from the browser: the action re-reads the stored
  `AiGeneration.output`, re-validates it, `saveDraft`s it, marks the row
  `applied` with `finalApplied`, moves the brief to `generated`, writes the
  `ai.site.apply` audit row and logs `ai_proposal_kept`.
- **Discard** — `discardProposal(siteId, generationId)`: row `discarded`, audit
  `ai.site.discard`, event `ai_proposal_discarded`.
- **Regenerate** — discards the standing proposal first (so metrics stay honest)
  and calls the API again.

Applying **never publishes** (Art. III). The operator publishes from Feature E's
editor when they are ready.

## Non-functional requirements

- No new npm dependencies. One new *workspace* edge — `@plink/ai` → `@plink/effects`
  — recorded in `docs/spikes/2026-09-03-site-generator-sanitizer.md`.
- Studio UI uses DESIGN.md tokens only; the preview is the creator surface and
  stays `--pl-*` driven (the renderer already owns that).
- `packages/db/prisma/**` untouched; no prisma commands beyond `db:generate`.

## §6 metrics wiring

| Record | Where | Carries |
|---|---|---|
| `AiGeneration` (`kind: "site"`) | route + actions | `prompt`, `output`, `finalApplied`, `status` (`proposed` → `applied` \| `discarded`), `userId`, `siteId`, `createdAt` |
| `EventLog ai_proposal_created` | `POST /api/ai/site` | `{ generationId, template, pages, sections, blocks }` |
| `EventLog ai_proposal_kept` | `applyProposal` | `{ generationId, pages, sections, blocks }` |
| `EventLog ai_proposal_discarded` | `discardProposal` | `{ generationId }` |
| `AuditLog ai.site.apply` | `applyProposal` | `after: { generationId, pages }` |
| `AuditLog ai.site.discard` | `discardProposal` | `after: { generationId }` |
| `AuditLog site.save` | `saveDraft` (Feature D) | the draft diff summary |

Time from `brief.submit` (audit) to `ai_proposal_created` to `ai_proposal_kept`
is the delivery-effort figure plan §8 asks for; the kept/discarded ratio is the
quality figure.

## Future work

- ~~**`ai_proposal_edited`**~~ — shipped at publish time instead of through an edit session, alongside `ai_proposal_kept_verified` (`docs/specs/proposal-edited-metric/spec.md`).
- Streaming the proposal (the call is 20–60 s behind a spinner today).
- Per-section regeneration instead of whole-document regeneration.

## Acceptance

- `sanitizeSiteDocument` unit tests cover: valid round-trip, unknown block types
  and section kinds dropped, forced template, non-http URLs stripped, unknown
  effect ids dropped while registry ids survive, hex enforcement with
  `brandColors` defaults, `null` on hopeless input, ids regenerated.
- No test touches the gateway.
- `pnpm --filter @plink/web typecheck && lint && test` and
  `pnpm --filter @plink/ai typecheck` green.
