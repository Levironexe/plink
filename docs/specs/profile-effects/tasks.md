# profile-effects — tasks

- [ ] T1. Spike: record the attachment-point, cascade and palette decisions in
      `docs/spikes/2026-09-03-profile-effect-palette-and-attachment.md`.
- [ ] T2. Core: extend `ThemeShape` with `bgEffect` / `textEffect` / `entranceEffect`;
      `"none"` from `DEFAULT_THEME` and `presetToTheme`; keep them out of
      `ThemePreset["values"]`; add `pageEffectVars(theme)`.
- [ ] T3. Read path: `themeFromRow` (dashboard) and `loadPublicProfile` (public page)
      carry the three columns through to `ThemeShape`.
- [ ] T4. Write path: `themeSchema` + `DEFAULT_THEME_KEYS` in
      `apps/web/src/app/dashboard/actions.ts`.
- [ ] T5. Renderer helper: `apps/web/src/components/profile/profile-effects.ts` —
      `profileEffectClasses(theme)` and `entranceMode(id)`.
- [ ] T6. Renderer: background on the ProfileView root (+ inline positioning for the
      pattern overlay), text on the display name and `header` blocks, entrance via
      `EntranceGroup` (group for stagger, per-block otherwise).
- [ ] T7. Appearance: append Background / Text / Entrance sections to the existing
      Effects tab using `EffectPicker`; surface section untouched.
- [ ] T8. AI: `sanitizeGeneratedTheme` emits the three fields validated by target;
      `generatedThemeSchema` advertises the real per-target ids.
- [ ] T9. Tests: `themes.test.ts` (defaults + `pageEffectVars`),
      `profile-effects.test.ts` (class helper + entrance mode), `ai.test.ts`
      (per-target sanitisation).
- [ ] T10. Verify: `pnpm --filter @plink/web typecheck && lint && test`,
      `pnpm --filter @plink/core typecheck`, `pnpm --filter @plink/ai typecheck`.
