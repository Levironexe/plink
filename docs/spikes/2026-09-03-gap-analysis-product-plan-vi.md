# Gap analysis — Technical Product Plan VI vs current app

Date: 2026-09-03 · Source: `docs/Technical_Product_Plan_VI.pdf` (vi) · App state: `main` @ ad46141 (+ #2 effects, #3 font/fix)

## The pivot in one sentence

The plan turns Plink from a **self-serve link-in-bio SaaS** into an **agency-first "Creator Website OS"**: operators run projects per client, intake a structured brief, generate a multi-page site (Bio + Shop + Blog) from a **site schema**, review, publish with **versioning and rollback**, and measure everything — with AI as an internal tool (generator, asset maker), never the owner of business state.

## Module-by-module gap

| # | Plan module (§4) | Current state | Gap |
|---|---|---|---|
| 1 | Tenant & Auth — workspace, operator/client roles | Single `User`, one page per account, no roles | **Full gap** |
| 2 | Site Schema — site → page → section → block, theme tokens, content refs | Flat `Block[]` + one `Theme` per user; block registry (14 types) exists | **Large** — no site/page/section layers, no content references |
| 3 | Renderer — schema → responsive site, decoupled from studio | `ProfileView` renders one bio page; coupled to profile types | **Large** — no multi-page, no "3 distinct templates from one schema" |
| 4 | Admin Studio — edit, preview, approve, publish, rollback | Live editor publishes instantly; no draft state | **Large** — no publish pipeline at all |
| 5 | Asset Pipeline — upload, transform, AI gen, moderation, metadata | Blob upload + MIME allowlist only | **Medium** — no AI images, no versions/metadata |
| 6 | Connector Layer (V2) | — | Deferred by plan §9 |
| 7 | Sync/Diff Engine (V2) | — | Deferred by plan §9 |
| 8 | Command Layer (V3) | Server actions exist but not an agent-safe registry | Deferred; existing actions are the seed |
| 9 | Event Store — views, clicks, publish events, delivery metrics | `PageView` + `ClickEvent` only | **Medium** — no publish/AI/delivery events (§6 wants these from day one) |
| 10 | Audit & Versions — who/what/when, before/after | None | **Full gap** |

## V0 feature checklist (plan §3)

| Feature | Status |
|---|---|
| Project/workspace per client | ✗ missing |
| Brief intake with clear schema | ✗ missing (AI builder prompt is unstructured) |
| Bio page (links, profile, CTA, social proof) | ✓ **strong** — keep |
| Shop/Services page → external checkout | ◐ products + Stripe Connect exist; not a standalone page in a site |
| Blog/content page | ✗ missing (text blocks only) |
| Template system: tokens, responsive, block registry | ◐ `BLOCK_LIBRARY` + `THEME_PRESETS` exist; no site-level templates |
| Preview, publish, rollback, version history | ✗ missing entirely |
| AI Asset Generator (hero/banner/thumbnail) | ✗ missing (AI is text/structure only) |
| Basic analytics: view, click, CTA | ✓ mostly (CTA events partial) |

**V1 Website Generator:** ◐ foundation exists — `@plink/ai` generate + sanitize + preview-before-apply for the bio page. Needs: structured brief input, site-level output, prompt/output/edit logging (§6).

**Definition of Done (§8) score today: 2 / 8** (AI review step ✓, no-code-per-client ◐; everything else ✗).

## Effects (user priority, pulled forward from V4)

Current: 15 surface effects, **one per theme** (`Theme.buttonEffect`), buttons/cards only. The engine seam (registry → CSS class + `--pl-*` vars, zero-JS ambient effects, pointer hook) is excellent and generalizes.

Target (Aceternity/ReactBits style): effect assignable **per element**, in new groups —
- **Text effects**: gradient, typewriter, blur-reveal, split/stagger, scramble, wave…
- **Background effects**: aurora, beams, particles, dot/grid, gradient mesh, noise…
- **Entrance animations**: fade/slide/zoom/blur in, with stagger
- Existing surface groups (Ambient/Hover/Pointer/Bold) retained per element

Gap: registry needs an element-target dimension; persistence moves from theme-level to per-block/per-element; picker UI in the editor; reduced-motion + SSR guarantees preserved.

## What is already strong — reuse, don't rebuild

Auth + sessions, Stripe (billing + Connect), Resend email, Vercel Blob storage, AI Gateway wiring with sanitize/preview/apply pattern, analytics ingestion, the block editor UX, theme presets, the effects engine seam, demo profiles/seeding, test culture (214 unit + 45 e2e), turborepo layering (app → integrations → core).

## Decisions (spike rationale)

1. **Additive evolution, not rewrite.** Existing user pages become the "Bio" page of a default Site owned by a personal Workspace. All migrations additive (contract §1); every existing public page keeps rendering unchanged.
2. **Defer V2/V3** (Content Sync, Management Agent) exactly as plan §9 orders — but ship the **Event Store fields now** (§6) so the §7 decision gates have data.
3. **Effects ship now** as engine + catalog (not V4 marketplace packaging) per explicit stakeholder instruction.
4. **Schema-first order** (§5): Site Schema → renderer + 3 templates → studio → generator → asset pipeline.
