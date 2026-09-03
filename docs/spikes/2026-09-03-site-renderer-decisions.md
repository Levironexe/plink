# Spike — site renderer decisions (feat/site-renderer)

Decisions made while implementing `docs/specs/site-renderer/spec.md` that go
beyond the letter of the stated contract, with why.

## 1. `SiteRenderer` gained two optional props: `basePath` and `path`

The stated signature is `SiteRenderer({ document, mode })`. That call still
works — both additions default so the root page renders standalone — but the
renderer cannot know two things from the document alone:

- **where the site is mounted** (`basePath`, default `""`): nav hrefs must be
  absolute (`/s/demo-linh-florals/shop`), and the mount point is the route's
  knowledge, not the document's. Previews may omit it; preview nav is inert.
- **which page is being rendered** (`path`, default `"/"`): one SiteDocument
  holds many pages, and the catch-all route resolves `/s/x/shop` to a page.
  The route 404s unknown paths *before* rendering; inside the renderer an
  unresolvable path falls back to the root page so an embedded preview can
  never crash on a stale path string.

## 2. The brand comes from the document, not a prop

Templates need a name for the masthead / top bar / sidebar, and `SiteDocument`
has no name field. Rather than widening the props further, `siteName()` reads
the root page's hero header title (the generator writes the business name
there — see `seed-sites.ts`) and falls back to the root page title. Routes use
the `Site.name` column for metadata only, so the renderer stays a pure
function of the document.

## 3. Card radii are `min(var(--pl-radius), N)`

`SiteTheme.buttonRadius` defaults to `"rounded"`, which core's `radiusCss`
maps to the 999px pill. Perfect for buttons, absurd for product cards, hero
panels and images — so non-button surfaces clamp the same token with CSS
`min()`. The creator's radius choice still flows everywhere (a `sharp` theme
squares the cards too); it just cannot turn a card into a capsule.

## 4. `BlockFlavor` *is* `SiteTemplateId`

The shared block layer is parameterized by flavor so products can be grid
cards in storefront and ruled list rows in editorial without three copies of
the safe-URL / embed / effects plumbing. There is exactly one flavor per
template, so the type is an alias — no fourth vocabulary to drift.

## 5. One client component, used only when needed

`pointer-surface.tsx` is the renderer's only `"use client"` file. Server code
consults `effectNeedsPointer` per assignment and swaps in the client wrapper
only for surfaces whose effect actually reads the cursor, and only in live
mode (previews never track, matching the profile renderer). A document with no
pointer effects ships zero extra client JavaScript.

## 6. Effects degrade by construction

`fx()` maps every assigned id through the registry's `effectClass`; the seed's
`text-gradient` / `bg-dot-grid` / `enter-fade-up` ids belong to
feat/effects-anywhere and resolve to `""` today, so they render as plain
surfaces and light up automatically when that branch merges. No effect class
string is hardcoded anywhere in the renderer; `pl-fx` is the one literal (the
base-class contract of `@plink/effects`).

## 7. Verification without a dev server

Branch rules forbid dev servers and e2e, and the committed unit tests are
pure logic by design (the app tsconfig keeps `jsx: preserve`, which vitest
cannot import). To still catch runtime wiring bugs, a throwaway
`renderToStaticMarkup` smoke test (all three templates × both modes, a
seed-shaped document with every supported block type plus an unknown one) was
run locally under a scratch vitest config with `oxc: { jsx }` enabled, then
deleted. All six renders passed: previews contained no anchors, live pages
linked nav and blocks correctly, unknown block types rendered nothing.
