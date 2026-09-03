# Feature A: effects-anywhere — plan

## Approach

Widen the registry seam, never replace it. An effect stays *data* (id + class name +
flags); the stylesheet stays static and palette-blind (only `--pl-*` vars); JS stays
opt-in (pointer hook for the three pointer surfaces, one IntersectionObserver in
`EntranceGroup` for entrance). The new `target` field is the only structural change to
`EffectDefinition`, and it is additive.

Key decisions (spike: `docs/spikes/2026-09-03-css-only-text-effects.md`):

- **Typewriter** — animate `clip-path: inset()` with `steps()`, one-shot, hidden state
  only inside the keyframes. Animating `width` (the classic recipe) forces layout and
  breaks when `animation: none`; clip-path is paint-only and degrades to fully-visible
  text under reduced motion.
- **Glitch** — single-element: `steps(1)` keyframes jittering `translate` + momentary
  `clip-path` slices. The pseudo-element double-copy recipe needs `attr(data-text)`
  (a class cannot supply it) and duplicates content.
- **Wave** — whole-line bob via `translate`, not per-letter (per-letter needs markup
  the registry cannot inject).
- **Entrance** — CSS-first: classes do nothing until `[data-entered]` lands, so content
  is visible without JS by construction. `EntranceGroup` sets the attribute once and
  disconnects; under reduced motion it sets the attribute immediately (and the CSS
  media block disables the animation anyway).
- **Wrong-target ids** — `applyEffects` requires the id's registry `target` to match the
  assignment key. A corrupt document degrades to "no effect", mirroring
  `effectById`'s unknown-id fallback.

## File map

| File | Change |
|---|---|
| `packages/effects/package.json` | add `@plink/core: workspace:*` dependency (type-only import) |
| `packages/effects/src/registry.ts` | `target` on `EffectDefinition`; `EffectGroup` gains `"Text" \| "Background" \| "Entrance"`; 21 new entries; `effectsForTarget`; `applyEffects`; `effectsInGroup` pinned to surface targets |
| `packages/effects/src/effects.css` | 21 new `pl-fx-<id>` rule sets + keyframes; reduced-motion block extended (incl. stagger children) |
| `apps/web/src/components/effects/effect-picker.tsx` | new — `EffectPicker` client component |
| `apps/web/src/components/effects/entrance-group.tsx` | new — `EntranceGroup` client component |
| `apps/web/src/components/effects/index.ts` | new — barrel re-export |
| `apps/web/tests/unit/effects.test.ts` | extend: target partition, `applyEffects`, back-compat pins, entrance-CSS shape; fix the "every effect in exactly one group" test to be surface-scoped |
| `docs/specs/effects-anywhere/*` | spec / plan / tasks |
| `docs/spikes/2026-09-03-css-only-text-effects.md` | approach spike |

Untouched on purpose: `apps/web/src/app/dashboard/appearance/_components/effects-tab.tsx`
(must render identically), `apps/web/src/app/globals.css`, everything outside the
ownership list.

## Test strategy

Vitest runs in node (`tests/unit/**/*.test.ts`), so tests pin the data layer and the
registry↔CSS contract, not React rendering (typecheck + lint cover the components):

1. Existing drift tests loop `EFFECTS`, so the 21 new classes are covered automatically;
   the orphan-class scan keeps the CSS honest in the other direction.
2. New: every effect's `target` is one of `EFFECT_TARGETS`; `effectsForTarget` partitions
   exactly (pinned id lists per target); `none` excluded.
3. New: `applyEffects` — composition order, unknown id, wrong-target id, `none`, empty.
4. Back-compat pins: `EFFECT_GROUPS` still equals the four legacy groups;
   `effectsInGroup` returns only `target: "surface"` entries and the exact pre-feature
   id sets.
5. CSS shape: entrance classes animate only from `[data-entered]`; reduced-motion block
   covers the stagger children.

## Risks

- The existing pointer-variable heuristic test splits the CSS on class-name substrings —
  verified no new class name collides as a substring of another (dots anchor the match).
- `background-clip: text` needs the `-webkit-` prefix; both are emitted.
- `steps()` typewriter uses a fixed step count (28) — long lines type in coarser chunks;
  acceptable for a decorative effect and documented in the registry description.
