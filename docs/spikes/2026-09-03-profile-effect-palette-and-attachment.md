# Spike — where a creator page's effects attach, and which palette they read

**Date:** 2026-09-03 · **Feature:** `profile-effects` · **Status:** decided

Three questions had to be answered before `bgEffect` / `textEffect` / `entranceEffect`
could reach `ProfileView`: which element wears each class, what happens when `.pl-fx`
lands on an element that already has absolutely positioned children, and which `--pl-*`
palette the page-level targets read.

---

## 1. Which element each target attaches to

`effects.css` gives every effect the same anatomy:

```css
.pl-fx            { position: relative; isolation: isolate; }
.pl-fx > *        { position: relative; z-index: 1; }
.pl-fx::before,
.pl-fx::after     { content: ""; position: absolute; inset: 0; z-index: 0;
                    border-radius: inherit; pointer-events: none; }
```

So an effect paints into the element's own box, behind its children, and never takes a
pointer event. That determines the attachment points directly.

**Background → the ProfileView root `<div>`.** It is already the element carrying
`backgroundCss(theme)`, it already spans the page (`min-h-full w-full`, and `min-h-dvh`
from the route), and it is already `relative`. Its `::before` covers exactly the painted
area; `.pl-fx > *` lifts both children (pattern overlay, content column) above it;
`pointer-events: none` means no link ever loses a click. No new element, no new stacking
question.

Rejected: a dedicated absolutely-positioned overlay div. It duplicates the layer the
theme background already is, and — see §2 — an element that is both `.pl-fx` and
`absolute` fights the cascade.

**Text → the display-name heading, and `header` blocks' `<h2>`.** Two reasons this is
the heading element and not the inner `<span>`:

- The registry's own note: *"Wave and glitch animate `translate`, which browsers ignore
  on non-replaced inline elements — apply them to block-level text."* The heading is
  `display: flex`; the span is inline.
- `background-clip: text` (gradient, shimmer) clips to the text of the element **and its
  inline descendants**, so putting it on the heading colours the name while the verified
  tick — a Lucide SVG painted with `stroke="currentColor"` and an explicit inline
  `color` — is untouched, because `-webkit-text-fill-color` affects fill of text, not an
  SVG stroke.

Body copy, link labels, the `@username` line and button text deliberately get nothing: a
typewriter or a glitch loop on every string is unreadable, and `text-typewriter` clips
its own box, which would truncate a wrapped paragraph mid-reveal.

**Entrance → block wrappers, except stagger.** See §4.

---

## 2. `.pl-fx > *` versus absolutely positioned children

`apps/web/src/app/globals.css` reads:

```css
@import "tailwindcss";
@import "@plink/effects/effects.css";
```

Tailwind v4's entrypoint sorts its own output into `@layer theme, base, components,
utilities`. `effects.css` is imported **unlayered**, and in the CSS cascade *unlayered
styles beat every layered style regardless of specificity*. `.pl-fx > *` and Tailwind's
`.absolute` are both one class (0,1,0) — the unlayered rule wins.

The root's pattern overlay is `<div className="pointer-events-none absolute inset-0">`.
The moment the root becomes `.pl-fx`, that overlay would be forced to
`position: relative`, collapse to zero height, and the creator's `bgPattern` would vanish
— but only for creators who chose *both* a pattern and a background effect, which is
exactly the combination nobody would test by hand.

**Decision:** move the overlay's positioning into its inline `style`. Inline declarations
outrank every stylesheet rule, layered or not, so the overlay is immune to `.pl-fx > *`
whether or not an effect is present. Rendering with no effect selected is unchanged.

Rejected: `!important` in JSX classnames (noise, and it spreads), reordering the imports
so effects.css lands inside `@layer utilities` (would silently weaken every effect
against unrelated utilities, and `packages/effects/**` is out of scope for this branch).

The same trap does not exist for the other attachment points: the display-name heading's
children are a `<span>` and an SVG, and an entrance wrapper's child is the block itself —
none of them absolutely positioned.

---

## 3. Which palette the page-level targets read

`buttonEffectVars(theme)` derives the eight-variable contract from the **button**
palette: `--pl-bg = buttonColor`, `--pl-fg = buttonTextColor`, and the `--pl-fg-12/25/45`
alphas from that foreground. Correct for a surface effect on a button; wrong for an
effect painting across the page.

The failure is concrete, not theoretical. In the `citrus` preset:

| | value |
| --- | --- |
| `bgColor` | `#c6ff4a` |
| `buttonTextColor` | `#c6ff4a` |
| `textColor` | `#10210a` |

`bg-grid` draws with `--pl-fg-12`. Under `buttonEffectVars` that is lime at 12 % opacity
**on a lime page** — an effect the creator picked and cannot see. Under the page palette
it is the page's own dark-green ink at 12 %, which is precisely the grid they previewed.

**Decision:** add `pageEffectVars(theme)` to `packages/core/src/themes.ts` — same eight
variables, same precomputed alphas, sourced from `bgColor` / `textColor` / `accentColor`.
Background and text targets read it in the renderer, and the Appearance picker passes the
same object as its `palette`, so the swatch and the page are driven by one value.

`buttonEffectVars` is untouched and still owns the surface target, so `buttonEffect`
behaviour on links and cards does not move.

> **Contract deviation, recorded deliberately.** The brief said to pass
> `buttonEffectVars(theme)` as the picker's `palette` "so swatches preview against their
> real colours". `pageEffectVars` serves that stated purpose strictly better for the two
> page-level targets, and keeps preview and render on one source. The surface section of
> the tab still uses `buttonEffectVars`, unchanged.

---

## 4. Stagger animates children; everything else animates itself

```css
.pl-fx-enter-fade-up[data-entered]        { animation: … }
.pl-fx-enter-stagger[data-entered] > *    { animation: …; animation-delay: …; }
```

Six of the seven entrance effects decorate the element they are on. `enter-stagger`
decorates its *children*, with per-`nth-child` delays. One structure cannot serve both:

- Wrap every block individually → stagger loses its cascade entirely. Every block is an
  only child, so every block animates at `0s` and "Stagger" renders identically to
  "Fade up". A promise the picker made and the page broke.
- Wrap the list once → stagger is perfect, but the other six animate the whole list as a
  single unit, and blocks below the fold finish animating before the reader ever reaches
  them. The tab's own copy ("as they scroll into view") would be false.

**Decision:** `entranceMode(id)` in `apps/web/src/components/profile/profile-effects.ts`
returns `"group"` for the one child-animating effect and `"item"` for the rest;
`"none"` for `none`, an unknown id, or an id belonging to another target. The renderer
reads the mode and picks the structure. The single piece of per-effect knowledge is a
named constant in one pure, unit-tested module rather than a string literal buried in
JSX — and if the registry ever gains a second group-style entrance effect, one list
grows and nothing else moves.

---

## 5. No-JS and reduced-motion, restated

Both guarantees were designed into `effects.css` and `EntranceGroup` by the
`effects-anywhere` work; this feature only has to not undermine them.

- **No JS.** Every entrance selector hangs off `[data-entered]`, an attribute only
  `EntranceGroup`'s effect sets. Without JavaScript the attribute never lands, no
  entrance rule ever matches, and every block sits at its natural, fully visible state.
  No "from" state exists outside a `@keyframes` block, so nothing can be left hidden.
  Background and text effects are pure CSS with legible resting states (`text-highlight`
  rests on the finished stroke; `text-typewriter` clips from a keyframe only).
- **Reduced motion.** The stylesheet's `@media (prefers-reduced-motion: reduce)` block
  kills `animation` and `transition` on `.pl-fx`, both pseudo-elements, and stagger
  children with `!important`. Independently, `EntranceGroup` checks the media query and
  sets `data-entered` immediately instead of constructing an IntersectionObserver, so
  nothing ever waits on a reveal that will not play. Either mechanism alone is
  sufficient; both are present.
