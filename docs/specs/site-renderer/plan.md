# Plan — feat/site-renderer

Implementation strategy for `docs/specs/site-renderer/spec.md`.

## Architecture

```
app/s/[slug]/page.tsx ──┐
app/s/[slug]/[...path]/ ─┤→ load-site.ts (prisma, published version only)
                         │        │ safeParseSiteDocument
                         │        ▼
                         └→ <SiteRenderer document mode basePath>
                                   │ normalizeTemplateId → registry
                                   ▼
                templates/{editorial,storefront,portfolio}.tsx
                     │ TemplateProps { document, page, nav, mode }
                     ▼
        nav-link.tsx (Link vs inert)  ·  blocks.tsx (block visuals)
                     ▼
   site-model.ts — pure: resolveSitePage, buildSiteNav, siteThemeVars,
                   siteButtonCss, fx, normalizeTemplateId, font stacks
   pointer-surface.tsx — the only "use client" leaf (needsPointer effects)
```

Dependency direction honors Art. V: components consume `@plink/core` and
`@plink/effects`; routes additionally consume `@plink/db` (read-only). The
pure logic lives in `site-model.ts` with zero React/Next imports (types
excepted) so the unit tests need no DOM, database, or dev server.

## Key decisions

1. **`basePath` prop** — the stated `{ document, mode }` signature cannot
   place absolute hrefs for `/s/[slug]/...`; an optional `basePath` (default
   `""`) is the minimal extension. Preview may omit it since preview nav is
   inert. Recorded as a spike.
2. **Local theme/button helpers, no core edits** — `siteThemeVars` +
   `siteButtonCss` mirror `buttonEffectVars`/`buttonCss` for the narrower
   `SiteTheme`, and add `--pl-site-*` tokens templates style against.
   `rgba`/`radiusCss` are imported from core rather than duplicated.
3. **`fx()` never hardcodes classes** — every id goes through `effectClass`;
   unknown ids collapse to `""` today and resolve after feat/effects-anywhere
   merges. `pl-fx` is the one literal (the base-class contract).
4. **Distinctness is structural** — each template owns its nav placement,
   hero markup, section chrome and type scale; `blocks.tsx` provides shared
   block visuals parameterized by a `flavor` so products can be grid cards in
   storefront but list rows elsewhere without three copies of the safe-URL /
   embed / effect plumbing.
5. **Published snapshot only** — routes never read `Site.document`; the
   version row's `document` string is parsed and validated at the boundary.
6. **No analytics calls at all in v1** — there is no site-click endpoint yet
   (Feature D); `mode` is threaded through so live-only behavior (real
   anchors, future beacons) has one seam.

## Order of work

1. Specs + process docs (this file) — commit.
2. `site-model.ts` (pure logic) + unit tests — commit.
3. `blocks.tsx`, `nav-link.tsx`, `pointer-surface.tsx` — commit.
4. Three templates — commit (one commit per template is acceptable).
5. `site-renderer.tsx` (registry + root wrapper) — commit.
6. Routes `s/[slug]` + `s/[slug]/[...path]` + `load-site.ts` — commit.
7. Spikes, verification (`typecheck`, `lint`, `test`), fixes — final commit.

## Risks

- **Effects branch not merged** — mitigated by `fx()`'s pass-through design;
  seed documents referencing `text-gradient`, `bg-dot-grid`, `enter-fade-up`
  render as plain surfaces until then.
- **Next 16 conventions** — dynamic APIs are async; `params` is a Promise in
  pages and `generateMetadata` (verified against
  `node_modules/next/dist/docs/.../dynamic-routes.md` and the existing
  `[username]/page.tsx`).
- **Vitest + JSX** — avoided entirely: tests import only `site-model.ts`.
