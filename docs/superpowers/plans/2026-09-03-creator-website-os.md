# Creator Website OS — Master Implementation Plan

> **For agentic workers:** This is the coordination plan for a multi-agent build. Wave 0 executes inline in the coordinator session. Waves 1–2 fan out one subagent per feature via worktrees (`superpowers:subagent-driven-development` semantics apply per agent). Each feature agent runs the full speckit cycle manually — `docs/specs/<feature>/spec.md`, `plan.md`, `tasks.md`, then implement — per `docs/CONTRACT.md` §4/§5. Steps use checkbox syntax.

**Goal:** Implement the Product Plan VI "Creator Website OS": workspaces/projects per client, structured brief intake, a schema-driven multi-page site engine (Bio + Shop + Blog) with 3 distinct templates, preview/publish/rollback + audit, an AI website generator and AI asset generator — plus an Aceternity/ReactBits-style effects system where any text, background, button, or block can carry any effect/animation.

**Architecture:** Additive evolution of the existing turborepo (app → integrations → core). Site content is a **versioned JSON document** (`SiteDocument`, zod-validated in `@plink/core/site-schema`) stored per site; Prisma gains additive models (Workspace, Site, SiteVersion, Brief, Asset, AuditLog, EventLog, AiGeneration). The renderer consumes the document; the studio edits it; publish snapshots it; AI proposes it. Effects extend the existing registry seam (`pl-fx-<id>` class + `--pl-*` vars) with `target` (surface | text | background | entrance) and per-element assignment.

**Tech Stack:** Next.js 16 App Router, Prisma 7 + Neon Postgres (adapter-pg), zod, Tailwind v4 tokens per DESIGN.md, @plink/ai via AI Gateway, vitest + Playwright.

**Spec:** `docs/Technical_Product_Plan_VI.pdf` (§3 V0/V1, §4 modules, §5 order, §6 metrics, §8 DoD) · `docs/spikes/2026-09-03-gap-analysis-product-plan-vi.md` · `docs/constitution.md`

## Global Constraints (every task inherits these)

- Constitution articles I–VII are binding. Security > everything.
- Schema is **frozen after Wave 0**. Feature agents never edit `schema.prisma`, never run `prisma migrate`/`db push`; `pnpm db:generate` only. (Contract §1, shared Neon DB.)
- Never hardcode colors — DESIGN.md tokens (`--color-*`) in admin UI, `--pl-*` theme vars on creator surfaces.
- No new npm dependencies without a spike documenting why.
- Existing surfaces (bio pages, dashboard, store, checkout) must keep working untouched; all changes additive.
- Effect ids are globally unique across targets and never renamed once merged (DB rows reference them).
- `prefers-reduced-motion: reduce` fully disables every new animation.
- Verification gate per feature: `pnpm --filter @plink/web typecheck && lint && test` green. E2E runs only at coordinator merge checkpoints (shared demo DB — no parallel e2e).
- Each agent commits frequently on `feat/<feature>` in its own worktree; agents never edit files outside their ownership list.

## File ownership map (conflict prevention)

| Owner | Paths (exclusive) |
|---|---|
| Wave 0 (coordinator) | `packages/db/prisma/**`, `packages/core/src/site-schema.ts`, `packages/db/src/seed-sites.ts` (called from existing seed), `packages/ai/src/site.ts` + `assets.ts` (stubs), `packages/ai/src/index.ts`, `docs/**` |
| A effects-anywhere | `packages/effects/**`, `apps/web/src/components/effects/**`, `apps/web/tests/unit/effects*.test.ts` |
| B site-renderer | `apps/web/src/components/site/**`, `apps/web/src/app/s/**`, `apps/web/tests/unit/site-renderer.test.ts` |
| C workspaces-brief | `apps/web/src/app/studio/page.tsx` + `studio/_components/**` + `studio/actions.ts`, `apps/web/src/app/api/workspaces/**`, `apps/web/src/lib/workspace.ts`, `apps/web/tests/unit/workspace*.test.ts` |
| D versioning-audit | `packages/core/src/site-versioning.ts`, `apps/web/src/lib/site-store.ts`, `apps/web/src/app/api/sites/**`, `apps/web/tests/unit/versioning*.test.ts` |
| E admin-studio (wave 2) | `apps/web/src/app/studio/[siteId]/**` (except `generate/`, `assets/`), may edit `studio/_components/**` after C merges |
| F website-generator (wave 2) | `packages/ai/src/site.ts`, `apps/web/src/app/api/ai/site/**`, `apps/web/src/app/studio/[siteId]/generate/**`, `apps/web/tests/unit/ai-site.test.ts` |
| G asset-generator (wave 2) | `packages/ai/src/assets.ts`, `apps/web/src/app/api/assets/**`, `apps/web/src/app/studio/[siteId]/assets/**`, `apps/web/tests/unit/ai-assets.test.ts` |

Shared-file rules: `packages/ai/src/index.ts` re-exports are written in Wave 0 (stubs) so F/G never touch it. `packages/effects/src/effects.css` belongs to A alone. Nobody edits `globals.css` except via coordinator merge fixes.

---

# Wave 0 — Foundations (coordinator, sequential)

### Task 0.1: Site schema in `@plink/core`

**Files:** Create `packages/core/src/site-schema.ts`; Test `apps/web/tests/unit/site-schema.test.ts`

**Produces (exact, all agents consume):**

```ts
export const SITE_TEMPLATES = ["editorial", "storefront", "portfolio"] as const;
export type SiteTemplateId = (typeof SITE_TEMPLATES)[number];

export const EFFECT_TARGETS = ["surface", "text", "background", "entrance"] as const;
export type EffectTarget = (typeof EFFECT_TARGETS)[number];

// Every field optional; value is an effect id (string, validated against the
// registry at render time — unknown ids render as "none", never throw).
export const effectAssignmentSchema: z.ZodType<EffectAssignment>;
export type EffectAssignment = Partial<Record<EffectTarget, string>>;

export type SiteBlock = { id: string; type: string; title: string; subtitle: string; url: string; imageUrl: string | null; config: Record<string, unknown>; effects: EffectAssignment };
export type SiteSection = { id: string; kind: "hero" | "links" | "products" | "posts" | "gallery" | "faq" | "contact" | "custom"; title: string; blocks: SiteBlock[]; effects: EffectAssignment };
export type SitePage = { id: string; kind: "bio" | "shop" | "blog" | "custom"; title: string; path: string; sections: SiteSection[]; effects: EffectAssignment };
export type SiteTheme = { bgColor: string; textColor: string; mutedColor: string; accentColor: string; buttonColor: string; buttonTextColor: string; buttonStyle: string; buttonRadius: string; fontFamily: string };
export type SiteDocument = { version: 1; template: SiteTemplateId; theme: SiteTheme; effects: EffectAssignment; pages: SitePage[] };

export const siteDocumentSchema: z.ZodType<SiteDocument>; // .strict() at every level, max limits per plan (pages ≤ 20, sections/page ≤ 24, blocks/section ≤ 40, strings capped)
export function parseSiteDocument(raw: unknown): SiteDocument;      // throws ZodError
export function safeParseSiteDocument(raw: unknown): SiteDocument | null;
export function emptySiteDocument(template: SiteTemplateId): SiteDocument; // 1 bio page, hero + links sections
export function newId(prefix: "pg" | "sc" | "bl"): string;          // `${prefix}_` + 10 base36 chars

export const briefSchema: z.ZodType<BriefData>; // .strict()
export type BriefData = {
  businessName: string; tagline: string; description: string; category: string;
  tone: "friendly" | "professional" | "playful" | "bold" | "minimal";
  pages: ("bio" | "shop" | "blog")[];
  products: { name: string; price: string; description: string }[];   // ≤ 20
  links: { label: string; url: string }[];                            // ≤ 20
  socials: { platform: string; url: string }[];                      // ≤ 10
  brandColors: { primary: string; accent: string };                   // hex, regex-validated
  contactEmail: string;                                               // "" allowed
};
export function emptyBrief(): BriefData;
```

Steps: failing tests (valid doc round-trip; unknown key rejected by strict; limits enforced; `emptySiteDocument` parses; brief hex regex) → implement → tests pass → commit.

### Task 0.2: Prisma migration (via `/prisma-schema-safety` — MANDATORY gate)

**Files:** Modify `packages/db/prisma/schema.prisma`; migration via skill workflow.

Additive models (String JSON columns, matching existing convention):

```prisma
model Workspace { id String @id @default(cuid()); ownerId String; name String; slug String @unique
  createdAt DateTime @default(now()); updatedAt DateTime @updatedAt
  owner User @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  sites Site[]
  @@index([ownerId]) }

model Site { id String @id @default(cuid()); workspaceId String; name String; slug String @unique
  template String @default("editorial"); status String @default("draft")
  document String @default("{}")            // working draft SiteDocument JSON
  publishedVersionId String? @unique
  clientName String @default(""); clientEmail String @default("")
  createdAt DateTime @default(now()); updatedAt DateTime @updatedAt
  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  versions SiteVersion[]; brief Brief?; generations AiGeneration[]
  @@index([workspaceId]) }

model SiteVersion { id String @id @default(cuid()); siteId String; number Int
  document String; note String @default(""); createdById String?
  createdAt DateTime @default(now())
  site Site @relation(fields: [siteId], references: [id], onDelete: Cascade)
  @@unique([siteId, number]) }

model Brief { id String @id @default(cuid()); siteId String @unique
  data String @default("{}"); status String @default("draft") // draft | submitted | generated
  createdAt DateTime @default(now()); updatedAt DateTime @updatedAt
  site Site @relation(fields: [siteId], references: [id], onDelete: Cascade) }

model Asset { id String @id @default(cuid()); userId String; siteId String?
  kind String @default("upload") // upload | ai
  url String; mimeType String @default(""); prompt String @default("")
  meta String @default("{}"); createdAt DateTime @default(now())
  @@index([siteId]); @@index([userId]) }

model AuditLog { id String @id @default(cuid()); userId String?; siteId String?
  action String; before String @default(""); after String @default("")
  createdAt DateTime @default(now())
  @@index([siteId, createdAt]) }

model EventLog { id String @id @default(cuid()); userId String?; siteId String?
  type String; data String @default("{}")
  createdAt DateTime @default(now())
  @@index([siteId, type, createdAt]) }

model AiGeneration { id String @id @default(cuid()); userId String; siteId String?
  kind String // site | bio | asset
  prompt String; output String; finalApplied String @default("")
  status String @default("proposed") // proposed | applied | discarded
  createdAt DateTime @default(now())
  @@index([siteId, createdAt]) }
```

Plus one column: `Block.effects String @default("{}")` (per-block EffectAssignment for existing bio pages).
User relation additions: `workspaces Workspace[]`.

### Task 0.3: AI package stubs + seed

**Files:** Create `packages/ai/src/site.ts`, `packages/ai/src/assets.ts` (typed stubs that throw "not configured", exported from `index.ts` so F/G fill bodies without touching shared files). Create `packages/db/src/seed-sites.ts`: three demo `Site` rows — one per template, same structural document shapes, distinct themes — wired into the existing seed entry.

### Task 0.4: Merge foundation to main

Typecheck + unit tests green → commit → PR → merge. Waves branch from this.

---

# Wave 1 — Parallel feature agents (worktrees, branch from post-Wave-0 main)

### Feature A: `feat/effects-anywhere` — the Aceternity/ReactBits layer

**Owns:** see ownership map. **Consumes:** `EffectTarget`, `EffectAssignment` from core.
**Produces (exact):**
- `EffectDefinition` gains `target: EffectTarget` (existing 15 → `target: "surface"`).
- New registry entries (ids final): text — `text-gradient`, `text-shimmer`, `text-typewriter`, `text-blur-reveal`, `text-wave`, `text-glitch`, `text-highlight`; background — `bg-aurora`, `bg-beams`, `bg-dot-grid`, `bg-grid`, `bg-mesh-drift`, `bg-noise`, `bg-gradient-flow`; entrance — `enter-fade-up`, `enter-fade-in`, `enter-zoom`, `enter-blur`, `enter-slide-left`, `enter-slide-right`, `enter-stagger` (staggers children).
- `effectsForTarget(target: EffectTarget): EffectDefinition[]`
- `applyEffects(assignment: EffectAssignment): string` → space-joined classes (`pl-fx` base + per-target class), unknown ids ignored.
- Components in `apps/web/src/components/effects/`: `EffectPicker` (target-grouped swatch grid, live previews, DESIGN.md tokens), `EntranceGroup` (IntersectionObserver wrapper honoring reduced motion — CSS-first: sets `data-entered`).
- All CSS in `packages/effects/src/effects.css`, compositor-friendly properties only, reduced-motion block extended. Typewriter/glitch pure CSS (`steps()`, clip). No JS beyond existing pointer hook + `EntranceGroup`.
- Contract test: every new class referenced by the registry exists in effects.css and vice versa (extend PR #2's drift test pattern).

### Feature B: `feat/site-renderer` — schema → website, 3 templates

**Owns:** `apps/web/src/components/site/**`, `apps/web/src/app/s/[slug]/**`.
**Consumes:** `parseSiteDocument`, `SiteDocument` et al from core; `applyEffects`/`effectClass` (registry may still be v1 at branch time — call through a local `fx(assignment)` helper that tolerates unknown ids, so A's merge upgrades behavior with no renderer change).
**Produces:**
- `SiteRenderer({ document, mode }: { document: SiteDocument; mode: "live" | "preview" })` — server component; renders nav (multi-page), sections, blocks; reuses existing profile block visuals where types overlap.
- Three templates as layout strategies (`templates/editorial.tsx`, `storefront.tsx`, `portfolio.tsx`): distinct nav placement, hero treatment, section rhythm, type scale — same document.
- Route `/s/[slug]` + `/s/[slug]/[...path]`: loads published version (`Site.status === "published"` → snapshot document), 404 otherwise; draft never leaks.
- Fully responsive (DoD §8), themed via `--pl-*` vars (extend `buttonEffectVars` pattern locally — no core edits).

### Feature C: `feat/workspaces-brief` — tenancy + intake

**Owns:** studio shell + api/workspaces + lib/workspace.
**Consumes:** `briefSchema`, `emptyBrief`, `emptySiteDocument` from core; prisma models.
**Produces:**
- `requireWorkspace(workspaceId: string): Promise<{ workspace, userId }>` (throws UNAUTHENTICATED / not-owner) in `lib/workspace.ts`.
- Server actions in `studio/actions.ts`: `createWorkspace(name)`, `createSite(workspaceId, { name, template, clientName })` (slugified unique slug, document = `emptySiteDocument`), `saveBrief(siteId, data: BriefData)`, `submitBrief(siteId)`.
- `/studio` page: workspace + site list, create flows, brief intake form (all DESIGN.md tokens, `.field`/`.card` primitives), links to `/studio/[siteId]` (E's route — link only).
- AuditLog rows for create/submit via direct prisma writes (D's helper arrives later; write action strings identically: `workspace.create`, `site.create`, `brief.submit`).

### Feature D: `feat/versioning-audit` — publish pipeline + event store

**Owns:** core/site-versioning + lib/site-store + api/sites.
**Consumes:** site-schema; prisma.
**Produces (exact — E/F depend on these):**
- Core (pure): `nextVersionNumber(existing: number[]): number`, `diffDocuments(a, b): { pagesAdded: string[]; pagesRemoved: string[]; sectionsChanged: number; blocksChanged: number }`.
- `lib/site-store.ts`: `getSiteForUser(siteId): Promise<Site>` (ownership check through workspace), `saveDraft(siteId, document: SiteDocument)` (validates, writes `Site.document`, audit `site.save`), `publishSite(siteId, note?): Promise<{ versionNumber: number }>` (snapshot → SiteVersion, set `publishedVersionId`, status published, audit `site.publish`, event `publish`), `rollbackSite(siteId, versionNumber)` (copies snapshot to draft AND publishes it as a new version, audit `site.rollback`, event `rollback`), `listVersions(siteId)`, `writeAudit(entry)`, `logEvent(entry)`.
- API routes under `api/sites/[id]/`: `versions` (GET), `publish` (POST), `rollback` (POST `{ number }`) — all ownership-checked, used by studio UI and tests.

---

# Wave 2 — Parallel feature agents (branch from post-Wave-1 main)

### Feature E: `feat/admin-studio` — the operator editor

Glues everything: `/studio/[siteId]` editor — page tabs, section list (add/reorder/delete), block editing forms (reuse field patterns from dashboard `_components`), **EffectPicker integration per element** (site/page/section/block), live `SiteRenderer` preview (`mode: "preview"`), template switcher, publish/rollback UI with version history + diff summary (D's API), brief panel link, autosave via `saveDraft` (debounced like `useDebouncedSave`).

### Feature F: `feat/website-generator` — brief → site proposal

Fills `packages/ai/src/site.ts`: `generateSiteDocument(brief: BriefData, opts): Promise<SiteDocument>` via AI Gateway (same call-time key pattern as `generate.ts`), sanitizer `sanitizeSiteDocument(raw)` (drop unknown block/section kinds, non-http(s) URLs, unknown effect ids, clamp limits — mirror `sanitizeGeneratedPage`). Route `api/ai/site` (POST brief → proposal, records `AiGeneration` row). `/studio/[siteId]/generate` page: propose → review (rendered preview + editable) → apply (writes draft via `saveDraft`, marks generation applied, event `ai_proposal_kept`/`ai_proposal_edited`) or discard (event). Never auto-publishes (constitution III).

### Feature G: `feat/asset-generator` — hero/banner/thumbnail AI

Fills `packages/ai/src/assets.ts`: `generateAssetImage({ kind: "hero" | "banner" | "thumbnail", prompt, siteId })` via AI Gateway image model → uploads result through `@plink/storage` → `Asset` row (kind "ai", prompt, meta). Route `api/assets` (POST generate, GET list per site, ownership-checked). `/studio/[siteId]/assets` page: prompt form, kind picker, gallery of versions, "use as hero/banner" copies URL into the site document via targeted `saveDraft` patch. Moderation: reuse MIME/service constraints; AI output stored via storage package only.

---

# Verification & merge protocol (coordinator)

- [ ] After each agent reports: review diff, run `typecheck && lint && test` in their worktree, merge `feat/<x>` → main sequentially (A → B → C → D, then E → F → G), resolving conflicts myself.
- [ ] After each wave: full `pnpm test:all` minus e2e in main worktree; e2e serially with env; fix-forward.
- [ ] Final: DoD §8 checklist against the running app; delivery report + spikes index; push.

## DoD mapping (plan §8 → features)

| DoD item | Feature |
|---|---|
| Operator: project + brief + first draft | C + F |
| Works desktop & mobile | B (+ E preview) |
| AI content has review step | F (+ existing ai-builder) |
| Preview, publish, rollback | D + E |
| No per-client code | B templates + schema |
| ≥3 distinct interfaces, one schema | B |
| Audit log on important ops | D (+ C, F writes) |
| Delivery-effort metrics | D EventLog + F events (§6) |
