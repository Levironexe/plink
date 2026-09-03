# Spike: CSS-only text effects (typewriter, glitch, wave)

**Date:** 2026-09-03 · **Feature:** `feat/effects-anywhere` · **Decision status:** settled

The effects contract requires typewriter and glitch to be CSS-only, applied by a single
class from the registry, with no content duplication, no broken selection, and content
fully visible under `prefers-reduced-motion` and without JS. Three recipes were weighed
per effect.

## Typewriter

| Approach | Verdict |
|---|---|
| Animate `width` + `overflow: hidden` + `steps()` (the classic) | **Rejected.** `width` animates layout (contract demands compositor/paint-cheap properties), needs `white-space: nowrap` (breaks wrapping headings), and the static `width: 0` start state hides the text entirely when `animation: none` applies. |
| JS: split into spans, reveal per character | **Rejected.** Needs markup the registry cannot inject, duplicates a11y text, and violates "typewriter implemented CSS-only". |
| Animate `clip-path: inset(0 100% 0 0 → 0 0 0 0)` with `steps(28)` | **Chosen.** Paint-only, no layout, works on wrapped text (reveals left-to-right through the whole block), and the hidden state lives *inside the keyframes* — with the animation disabled the element's natural `clip-path: none` shows the full text. |

Trade-off accepted: a fixed step count (28) means very long lines reveal in multi-char
chunks and there is no trailing caret (a caret cannot track a clip edge). Decorative
budget says fine.

## Glitch

| Approach | Verdict |
|---|---|
| Two pseudo-element copies via `content: attr(data-text)` (the Aceternity recipe) | **Rejected.** A registry class cannot supply `data-text`; the copies duplicate content (a11y hazard needing `aria-hidden`, which CSS cannot add) and sit in the `.pl-fx` pseudo layer already reserved for surface painting. |
| Canvas/JS scramble | **Rejected.** "Glitch implemented CSS-only" + zero-JS ambient rule. |
| Single element: `steps(1)` keyframes jittering `translate` with momentary `clip-path` band slices | **Chosen.** Real text throughout (selection intact), compositor-friendly (`translate`) plus paint-only `clip-path` flashes; resting frames are >90 % of the loop so the effect reads as an occasional signal dropout rather than constant noise. |

## Wave

Per-letter bobbing needs per-letter markup — same disqualification as the glitch copy
recipe. Chosen: whole-line bob via `translate` keyframes. Note: browsers ignore
transforms on non-replaced inline elements, so wave/glitch want block-level text (all
realistic consumers — headings, paragraphs — are). Documented in the spec; the picker
previews render block-level samples.

## Shared consequence

Every one-shot reveal (typewriter, blur-reveal, highlight) keeps its "before" state
exclusively in `@keyframes` and uses `animation-fill-mode: both`. That single pattern
makes reduced-motion and no-CSS-animation environments safe with no extra rules: kill
the animation and the natural, fully-visible style remains.
