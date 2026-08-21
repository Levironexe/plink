# Surface effects

**Status:** implemented on `animation-component`
**Date:** 2026-08-21

## The problem

Appearance offered five button styles — Fill, Outline, Soft, Hard shadow, Glass.
They can only ever be flat, and the reason is structural rather than stylistic:
`buttonCss()` returns a `React.CSSProperties` object that is spread inline onto
each surface, and an inline style cannot express `:hover`, `::before`, or
`@keyframes`. No amount of new entries in `BUTTON_STYLES` escapes that ceiling.

## The shape of the fix

Effects are a **second axis**, not a replacement. A surface keeps its style and
its corner radius, and gains an effect on top, so fourteen effects multiply
against the existing five styles and five radii rather than adding fourteen
flat options.

An effect is **data, never a component**. It has to survive a round trip through
a database column, and it has to compose with styles it knows nothing about.

```
Theme.buttonEffect ──▶ registry lookup ──▶ CSS class
Theme colours      ──▶ buttonEffectVars ──▶ --pl-* custom properties
```

The custom properties are the seam. They matter because the two halves of a
button's appearance grow on completely different axes:

| | changes with | lives in |
| --- | --- | --- |
| the creator's palette | every user | the database |
| the effect | every release | one static stylesheet |

Welding them together — generating CSS per creator — would make the byte cost
scale with *users × effects* and defeat caching entirely. Keeping them apart
means the stylesheet never learns about users, the database never learns about
CSS, and either can be rewritten without touching the other.

## Layout

```
packages/effects/
  src/registry.ts            every effect declared once
  src/effects.css            keyframes and classes, written only against --pl-*
  src/use-pointer-effect.ts  the only JavaScript in the system
```

Adding an effect is one registry entry plus one CSS rule. The picker, the public
renderer and the tests all read the registry, so nothing else changes — the
marginal cost of the twentieth effect is the same as the second.

## The variable contract

`buttonEffectVars(theme)` emits `--pl-bg`, `--pl-fg`, `--pl-accent`, three alpha
variants of the foreground, and two of the accent. Alphas are precomputed in TS
rather than with `color-mix()` so the stylesheet needs no colour maths and no
browser fallback. A unit test asserts that every `var(--pl-*)` appearing in the
CSS is either emitted here or written by the pointer hook — the contract cannot
silently drift.

## Rendering

Effects paint on `::before` / `::after`, which sit behind content at `z-index: 0`
with `pointer-events: none`. That is what makes "every surface" viable: a beam
can wrap the email-capture card without intercepting clicks on the input inside
it. An E2E test types into that input with an effect running, precisely because
this is the property most likely to regress.

Animation is confined to `background-position`, `opacity`, `scale`, `translate`
and a registered `--pl-angle`, all compositor-friendly. `scale` and `translate`
are used in preference to `transform` so effects never clobber the Tailwind
hover transforms already on these elements.

## Decisions worth recording

**Effects apply to every themed surface**, links and cards alike, so a page
reads as one piece.

**`prefers-reduced-motion` disables all of it.** Motion here is decoration and
every effect has a good resting state, so honouring the preference costs the
creator nothing.

**Pointer tracking is opt-in per effect.** Only the three effects that declare
`needsPointer` attach a listener, it writes to the style attribute rather than
React state so a mousemove never triggers a render, and it is skipped entirely
on coarse pointers. Everything else costs zero JavaScript.

**Effects are free, not Pro-gated.** Reversible if that turns out to be wrong.

**`DEFAULT_THEME.buttonEffect` is `none`**, set after the preset spread, so a
preset's signature effect cannot leak into the fallback a user gets before they
have a Theme row. This mirrors the column default; a unit test pins it.

## What was rejected

**Server-generated per-creator CSS.** Uncacheable, bloats every page, fights the
CSP header, and buys nothing that custom properties do not already give.

**A motion library.** Framer Motion would give real spring physics, but at
30–50KB on the one page whose entire job is to open instantly on a phone from
an Instagram bio. If a single effect ever genuinely needs springs, it can opt
into a small helper without disturbing the rest.

**A public `/effects` gallery.** Worth building on top of the registry later;
it is a second surface to maintain and makes no creator's page better today.
