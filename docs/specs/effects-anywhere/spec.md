# Feature A: effects-anywhere — spec

**Branch:** `feat/effects-anywhere` · **Owner paths:** `packages/effects/**`, `apps/web/src/components/effects/**`, `apps/web/tests/unit/effects*.test.ts`, `docs/specs/effects-anywhere/**`, `docs/spikes/**`

## What

Extend the existing surface-effect engine (15 effects + "none", one `pl-fx-<id>` class each)
into an Aceternity/ReactBits-style system with three new effect targets — **text**,
**background**, and **entrance** — assignable per element via the `EffectAssignment`
shape already defined in `@plink/core/site-schema`.

## Why

The Creator Website OS plan (Feature A) needs any text, background, button, or block on a
generated site to carry any effect. The registry seam already proved out for surfaces
(registry entry → static CSS class → theme vars); this feature widens the vocabulary
without changing the architecture: effects stay data, CSS stays static, ambient effects
stay zero-JS.

## Public contract (other agents compile against this)

1. `EffectDefinition` gains `target: EffectTarget` (type-only import from
   `@plink/core/site-schema`). All 15 existing effects and `none` get `target: "surface"`.
2. New effect ids (final, never renamed):
   - text: `text-gradient`, `text-shimmer`, `text-typewriter`, `text-blur-reveal`,
     `text-wave`, `text-glitch`, `text-highlight`
   - background: `bg-aurora`, `bg-beams`, `bg-dot-grid`, `bg-grid`, `bg-mesh-drift`,
     `bg-noise`, `bg-gradient-flow`
   - entrance: `enter-fade-up`, `enter-fade-in`, `enter-zoom`, `enter-blur`,
     `enter-slide-left`, `enter-slide-right`, `enter-stagger` (staggers direct children)
3. New exports from `packages/effects/src/registry.ts`:
   - `effectsForTarget(target: EffectTarget): EffectDefinition[]` — excludes `none`.
   - `applyEffects(assignment: EffectAssignment): string` — `"pl-fx"` base + each
     resolved class, space-joined, emitted in `surface, text, background, entrance`
     order. Unknown or missing ids contribute nothing; an id assigned under the wrong
     target key resolves to nothing; returns `""` when nothing resolves.
4. **Backward compatibility (hard):** `EFFECT_GROUPS` and `effectsInGroup(group)` keep
   returning only surface-target effects exactly as today — the Appearance effects tab
   renders unchanged. New-target effects get their own group values (`"Text"`,
   `"Background"`, `"Entrance"`) that are *not* listed in `EFFECT_GROUPS`; they are
   reached via `effectsForTarget`.
5. Class naming: `pl-fx-<id>` in `packages/effects/src/effects.css`, matching the
   registry exactly (the drift test enforces both directions).
6. React components in `apps/web/src/components/effects/` (new directory):
   - `EffectPicker` — client component. Props
     `{ target: EffectTarget; value: string | undefined; onChange: (id: string | undefined) => void; palette?: React.CSSProperties }`.
     Swatch grid grouped like the existing Appearance effects tab; every swatch is a
     live element running the real effect; admin chrome uses DESIGN.md tokens only.
   - `EntranceGroup` — client component wrapping children. An IntersectionObserver sets
     a `data-entered` attribute once; entrance CSS animates only from `[data-entered]`;
     honors `prefers-reduced-motion` (attribute set immediately, and the CSS media block
     kills the animation anyway). Content is fully visible without JS.

## Acceptance criteria

- [ ] Registry: 37 entries (`none` + 15 surface + 21 new), unique ids, every entry has a
      valid `target`, name, description, group.
- [ ] `effectsForTarget` partitions all non-`none` effects across the four targets with
      no overlap; excludes `none`.
- [ ] `applyEffects` composes across targets, ignores unknown/mismatched ids, returns
      `""` for empty/unresolvable assignments, always prefixes `pl-fx` when anything
      resolves.
- [ ] `effectsInGroup` (all four legacy groups) and `EFFECT_GROUPS` return exactly what
      they returned before this feature; the Appearance effects tab is untouched.
- [ ] Every registry class has a rule in `effects.css` and every `pl-fx-*` class in the
      CSS is registered (drift test extended to the new effects).
- [ ] All new animation uses compositor-friendly properties (transform via
      `translate`/`scale`, `opacity`, `background-position`, `filter`, `clip-path` for the
      steps-based reveals); no layout properties animate.
- [ ] `text-typewriter` and `text-glitch` are CSS-only (steps + clip-path; no JS, no
      content duplication, no pseudo-element text copies).
- [ ] Text effects keep real DOM text: selection works, no `aria-hidden` duplication is
      needed because nothing is duplicated.
- [ ] Every ambient/entrance animation is disabled under
      `@media (prefers-reduced-motion: reduce)` (existing block extended, including the
      stagger children rule), and every effect's resting state shows content fully —
      one-shot reveals keep their hidden state inside keyframes only, so `animation: none`
      leaves the element visible.
- [ ] Entrance content is fully visible without JS and with reduced motion — never
      hidden by a static style.
- [ ] No new npm dependencies (the `@plink/core` workspace link is type-only).
- [ ] `pnpm --filter @plink/web typecheck && lint && test` green.

## Non-goals

- No renderer integration (Feature B), no studio editor integration (Feature E) — this
  feature only ships the engine + picker components they consume.
- No schema or Prisma changes; `EffectAssignment` already exists in core.
- No pointer-driven text/background/entrance effects — the pointer hook remains a
  surface-only seam.

## Notes on semantics

- `ambient` on new entries: continuous and one-shot self-running animations (text
  effects, animated backgrounds) are `ambient: true`; static patterns (`bg-dot-grid`,
  `bg-grid`, `bg-noise`) and all entrance effects (which run only once `data-entered`
  lands) are `ambient: false`.
- `text-wave` and `text-glitch` animate `translate`, which browsers ignore on
  non-replaced inline elements; consumers apply them to block-level text (headings,
  paragraphs) or set `inline-block` themselves. The picker preview renders block-level
  samples.
