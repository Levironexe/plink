# Spec — feat/site-renderer: schema → website, 3 templates

Feature B of the Creator Website OS plan
(`docs/superpowers/plans/2026-09-03-creator-website-os.md`). Turns one
`SiteDocument` into three visibly distinct, responsive, multi-page websites
(plan §8 DoD: "at least three distinct interfaces from the same schema").

## Problem

A published `Site` row holds a versioned `SiteDocument` (site → pages →
sections → blocks, theme tokens, per-element effect assignments). Nothing
renders it. The renderer must be a pure consumer of the schema (constitution
Art. III): no per-client code, template choice and theme fully data-driven.

## Public contract (exact)

- `SiteRenderer({ document, mode })` exported from
  `apps/web/src/components/site/site-renderer.tsx`. Server-renderable React.
  `mode: "live" | "preview"` — preview renders identically but records no
  analytics and opens no `<a target>` surprises (block links render as inert
  elements, the same `Tappable` rule the profile renderer uses).
  An optional `basePath` prop (e.g. `/s/demo-linh-florals`) prefixes nav
  hrefs; live routes always pass it, previews may omit it because preview nav
  never navigates. This is the one addition to the stated signature — without
  a base the renderer cannot know where the site is mounted (documented in
  `docs/spikes/2026-09-03-site-renderer-decisions.md`).
- Templates at `apps/web/src/components/site/templates/{editorial,storefront,portfolio}.tsx`.
  Same document in, structurally distinct layout out (see "Templates").
- Routes owned: `apps/web/src/app/s/[slug]/page.tsx` (path `/`) and
  `apps/web/src/app/s/[slug]/[...path]/page.tsx` (all other pages).
- Unit tests in `apps/web/tests/unit/site-renderer.test.ts`, pure logic only.

## Loading rule (routes)

1. `prisma.site.findUnique({ where: { slug } })` — read-only.
2. Require `status === "published"` AND `publishedVersionId`; else `notFound()`.
3. Load the published `SiteVersion` by id and render **its** `document`
   snapshot — never `Site.document`; drafts must not leak.
4. `JSON.parse` guarded, then `safeParseSiteDocument`; `null` → `notFound()`.
5. `generateMetadata` from the document + Site row: root page title is the
   site name; subpages `«page.title» · «site name»`; description from the
   first hero header block's subtitle (the tagline) when present.
6. `dynamic = "force-dynamic"` (same as the profile page): a re-publish must
   show immediately.

## Path resolution & nav

- `resolveSitePage(document, segments)` — `[]` → the page with path `/`;
  `["shop"]` → `/shop`; `["a","b"]` → `/a/b`; no match → `null` (route calls
  `notFound()`).
- `buildSiteNav(document, basePath, currentPath)` — one item per page, in
  document order: `{ id, title, path, href, current }`. Every page is listed;
  the current page is highlighted (`aria-current="page"`). Live nav uses
  next/link client-side navigation; preview nav renders inert spans.

## Theme → CSS custom properties

`siteThemeVars(theme: SiteTheme): React.CSSProperties` (local helper — core is
frozen for this branch) maps the document theme onto `--pl-*` vars:

- Effects contract vars, mirroring `buttonEffectVars`: `--pl-bg` (button
  surface), `--pl-fg` (button text), `--pl-accent`, `--pl-fg-12/25/45`,
  `--pl-accent-30/60` — so any `pl-fx` surface anywhere in the tree has its
  palette without per-element wiring.
- Site tokens for template CSS: `--pl-site-bg`, `--pl-site-fg`,
  `--pl-site-muted`, `--pl-site-accent`, `--pl-site-accent-10`,
  `--pl-site-fg-14`, `--pl-radius` (from `buttonRadius` via `radiusCss`),
  `--pl-font` (local stack map: `sans`/`serif`/`mono`, unknown → sans; the
  profile's `fontStack` references `--font-inter`/`--font-jakarta` variables
  this app never defines, so the site map resolves to fonts that exist).

Buttons and cards respect `buttonStyle` + `buttonRadius` through a local
`siteButtonCss(theme)` mirroring the profile renderer's five styles
(`fill`/`solid`, `outline`, `soft`, `shadow`, `glass`).

## Effects

`fx(assignment?: EffectAssignment): string` — for each of the four targets
(`surface`, `text`, `background`, `entrance`) call `effectClass` from
`@plink/effects`; join the non-empty results after the `pl-fx` base class;
return `""` when nothing resolves. Unknown ids (text/background/entrance ship
in feat/effects-anywhere) are no-ops **today** and light up automatically
after that branch merges — no effect class string is ever hardcoded here.

Applied at every level: document.effects on the site root, page.effects on
the page container, section.effects per section, block.effects per block.
Surface effects whose registry entry has `needsPointer` get a small
`"use client"` wrapper reusing `usePointerEffect` (Art. V: pointer effects
write style attributes, not React state); everything else stays server-only.

## Templates — structural distinctness

| | editorial | storefront | portfolio |
|---|---|---|---|
| Nav | centered under a masthead, hairline-ruled | sticky top bar: brand left, links right | left sidebar on desktop, top row on mobile |
| Hero | oversized serif-leaning display type, centered, generous air | boxed banner panel on the accent tint with CTA-weight title | huge left-aligned uppercase display, asymmetric |
| Section rhythm | single ~65ch prose column, small-caps kickers, wide vertical gaps | carded sections on a tinted surface, tight grid rhythm | numbered sections with heavy rules, offset two-column feel |
| Products | list rows, price right-aligned | responsive card grid with price badge | minimal media rows |
| Type scale | large display / relaxed body | medium, commerce-dense | extreme display / small labels |

Unknown `document.template` falls back to editorial (`normalizeTemplateId`).

## Blocks

Full visuals for the seed's types — `header`, `text`, `link`, `product` —
plus `image`, `video` (+ `music`, same embed path via `toEmbedUrl`),
`socials`, `divider`. Every other known `BLOCK_LIBRARY` type falls back to a
plain link (when it has a URL) or text presentation. Unknown types render
nothing. All URLs pass through `safeUrl`. Visual language borrows from
`profile-view` (which is read, never modified).

## Responsive

Mobile-first. Storefront top bar collapses to a wrapping/scrollable row;
portfolio sidebar becomes a top bar under `lg`; no horizontal page scroll —
wide content (embeds, grids) is contained. `prefers-reduced-motion` is
honored by the effects stylesheet, which the renderer only ever references by
class.

## Non-goals

- No analytics endpoint calls in either mode (the site click-event store is
  Feature D; the `mode` seam is where it will attach).
- No draft rendering, no editor UI (Feature E embeds `mode: "preview"`).
- No new dependencies, no prisma schema changes, no edits outside the
  ownership map.

## Acceptance

- `/s/demo-linh-florals`, `/s/demo-baseline-coffee`, `/s/demo-atlas-audio`
  render three structurally different sites from identical document shapes;
  `/shop` and `/blog` resolve on each; unknown paths and unpublished slugs 404.
- `pnpm --filter @plink/web typecheck && lint && test` green.
- Unit tests cover: path→page resolution, nav model, `siteThemeVars`, `fx`
  composition, template fallback.
