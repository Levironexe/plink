# Tasks — feat/site-renderer

- [ ] T1 Process docs: spec.md, plan.md, tasks.md committed.
- [ ] T2 `components/site/site-model.ts` — `resolveSitePage`, `buildSiteNav`,
      `siteThemeVars`, `siteButtonCss`, `siteFontStack`, `fx`,
      `normalizeTemplateId`, `siteDescription`; pure, no React/Next imports.
- [ ] T3 `tests/unit/site-renderer.test.ts` — path resolution, nav model,
      theme vars, fx composition, template fallback; green under
      `pnpm --filter @plink/web test`.
- [ ] T4 `components/site/nav-link.tsx` (Link vs inert span),
      `components/site/pointer-surface.tsx` ("use client", reuses
      `usePointerEffect`), `components/site/blocks.tsx` (header, text, link,
      product, image, video/music, socials, divider, fallback; `safeUrl`
      everywhere; per-level `fx`).
- [ ] T5 `templates/editorial.tsx` — masthead + centered ruled nav, display
      hero, single prose column, list-row products.
- [ ] T6 `templates/storefront.tsx` — sticky top bar nav, boxed accent hero
      panel, carded sections, product card grid.
- [ ] T7 `templates/portfolio.tsx` — desktop sidebar nav (top bar on mobile),
      oversized asymmetric hero, numbered sections, minimal product rows.
- [ ] T8 `components/site/site-renderer.tsx` — template registry via
      `normalizeTemplateId`, root wrapper (theme vars, site-level fx,
      background/color/font), `mode` threading.
- [ ] T9 Routes: `app/s/[slug]/load-site.ts` (published version only),
      `app/s/[slug]/page.tsx`, `app/s/[slug]/[...path]/page.tsx`,
      `generateMetadata`, `notFound()` rules, `force-dynamic`.
- [ ] T10 Spikes in `docs/spikes/`; `typecheck` + `lint` + `test` green;
      tasks checked off; final commit.
