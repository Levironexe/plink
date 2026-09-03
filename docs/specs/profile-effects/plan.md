# profile-effects — plan

## Approach

Consume the registry seam, never widen it. `@plink/effects` already ships all 36 effects,
their CSS, `effectsForTarget`, `effectClass` and `applyEffects`; `EffectPicker` and
`EntranceGroup` already exist in `apps/web/src/components/effects/`. This feature is
therefore three thin wirings — column → schema → picker → renderer — plus one sanitizer.

Everything that decides *what class an element wears* lives in one pure module,
`apps/web/src/components/profile/profile-effects.ts`, so the rendering logic is unit
testable without a DOM, a database or a dev server.

## Key decisions

Recorded in `docs/spikes/2026-09-03-profile-effect-palette-and-attachment.md`:

1. **Which element each target attaches to.** Background goes on the ProfileView root —
   the element that already carries `backgroundCss(theme)` — because effects paint on
   `::before { inset: 0; pointer-events: none }` and `.pl-fx > *` lifts every child above
   them. Text goes on the display-name heading and on `header` blocks' `<h2>`, both
   block-level (the registry warns that `wave`/`glitch` animate `translate`, which is
   ignored on non-replaced inline elements). Entrance wraps blocks.

2. **`.pl-fx > *` vs. absolutely positioned children.** `effects.css` is imported
   *unlayered* after `@import "tailwindcss"`, so its `.pl-fx > * { position: relative }`
   outranks Tailwind's `.absolute` (which lives in `@layer utilities`). The root's
   `bgPattern` overlay is `absolute inset-0`; once the root becomes `.pl-fx` that overlay
   would collapse. Fix: give the overlay its positioning inline, where nothing in a
   stylesheet can outrank it. Rendering is unchanged when no effect is set.

3. **Page palette, not button palette.** `buttonEffectVars` derives `--pl-fg*` from
   `buttonTextColor`; on the `citrus` preset that is the same lime as the page
   background, so a background effect would be invisible. Page-level targets get
   `pageEffectVars(theme)` (`bgColor` / `textColor` / `accentColor`) instead — same eight
   variables, correct provenance — and the picker previews with the same vars so what a
   creator sees is what lands.

4. **Stagger is a group effect.** `.pl-fx-enter-stagger[data-entered] > *` animates
   *children*, every other entrance class animates *itself*. `entranceMode(id)` returns
   `"group"` for the former and `"item"` for the latter, so the renderer stays
   declarative and the one piece of per-effect knowledge is named, isolated and tested.

## Sequence

Core first (everything else compiles against `ThemeShape`), then the write path (action),
then the read path (renderer helper + renderer), then the UI, then AI, then tests. Commit
per task.

## Risks

| Risk | Mitigation |
| --- | --- |
| A new `ThemeShape` field breaks a construction site | `grep -rn "ThemeShape"` — only `themeFromRow`, `loadPublicProfile`, `demo-profiles`, `sanitizeGeneratedTheme` build one; all covered, all typechecked. |
| DOM drift on pages that opted out | Entrance wrappers render only when an entrance effect resolves; `cn("", x)` collapses to `x`, so an inert `EntranceGroup` emits the same `<div className="…">` as today. |
| An AI-smuggled effect id reaching the DB | `sanitizeGeneratedTheme` validates by target; `DEFAULT_THEME_KEYS` and `themeSchema` re-validate at the server boundary (Article I.2). |
| Motion shipped to someone who asked for none | Two independent guarantees: the stylesheet's `prefers-reduced-motion` block and `EntranceGroup`'s immediate reveal. Neither depends on the other. |

## Verification

`pnpm --filter @plink/web typecheck`, `lint`, `test`; `pnpm --filter @plink/core
typecheck`; `pnpm --filter @plink/ai typecheck`. No dev server, no e2e, no DB.
