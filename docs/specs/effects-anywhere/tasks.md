# Feature A: effects-anywhere — tasks

- [x] T1. Spike: record CSS-only text-effect decisions in
      `docs/spikes/2026-09-03-css-only-text-effects.md`.
- [x] T2. Registry: add `target` to `EffectDefinition` (type-only `EffectTarget` import
      from `@plink/core/site-schema`; `@plink/core` workspace dep added to
      `packages/effects/package.json`), tag all 16 existing entries `surface`, widen
      `EffectGroup`, add the 21 new entries, export `effectsForTarget` + `applyEffects`,
      pin `effectsInGroup` to surface targets.
- [x] T3. CSS: 7 text effects (`pl-fx-text-*`) — gradient, shimmer, typewriter
      (clip-path steps), blur-reveal, wave, glitch (steps + clip), highlight.
- [x] T4. CSS: 7 background effects (`pl-fx-bg-*`) on the `::before` layer — aurora,
      beams, dot-grid, grid, mesh-drift, noise, gradient-flow.
- [x] T5. CSS: 7 entrance effects (`pl-fx-enter-*`) animating only from
      `[data-entered]`, including `enter-stagger` child delays; extend the
      reduced-motion block for the new selectors.
- [x] T6. Tests: extend `apps/web/tests/unit/effects.test.ts` — target partition,
      `applyEffects` behavior, back-compat pins for `EFFECT_GROUPS`/`effectsInGroup`,
      entrance-CSS shape, drift tests over the grown registry.
- [x] T7. Components: `EntranceGroup` in
      `apps/web/src/components/effects/entrance-group.tsx`.
- [x] T8. Components: `EffectPicker` in
      `apps/web/src/components/effects/effect-picker.tsx` + `index.ts` barrel.
- [x] T9. Verify: `pnpm --filter @plink/web typecheck && lint && test` green; confirm
      effects-tab untouched; commit trail clean.
