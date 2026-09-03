# profile-effects — spec

**Branch:** `feat/profile-effects` ·
**Owner paths:** `packages/core/src/themes.ts`, `apps/web/src/app/dashboard/actions.ts`,
`apps/web/src/app/dashboard/appearance/_components/effects-tab.tsx`,
`apps/web/src/components/profile/**`, `packages/ai/src/index.ts`,
`apps/web/tests/unit/{themes,profile-effects,ai}.test.ts`,
`docs/specs/profile-effects/**`, `docs/spikes/**`

## What

A creator can choose a **background effect**, a **text effect** and an **entrance
animation** for their own link-in-bio page in `/dashboard/appearance` → Effects, and see
them on their public page at `/<username>`.

The `Theme` table already carries `bgEffect`, `textEffect` and `entranceEffect`
(`String @default("none")`, migrated). This feature makes those three columns real from
the picker to the rendered page, and teaches the AI page builder to write them safely.

## Why

The studio (`/studio/<siteId>`) already lets an operator put any of the 36 registry
effects on any element of a client website. The creator's own page was frozen at the
original 15 **surface** effects for backward compatibility. Same registry, same CSS,
same `--pl-*` seam — the creator surface simply never grew the other three targets.

## Public contract

### 1. `ThemeShape` (`packages/core/src/themes.ts`)

```ts
bgEffect: string;        // background-target effect id, or "none"
textEffect: string;      // text-target effect id, or "none"
entranceEffect: string;  // entrance-target effect id, or "none"
```

- `DEFAULT_THEME` and `presetToTheme()` supply `"none"` for all three. No preset names
  one, so a preset applied today behaves exactly as it did yesterday.
- `ThemePreset["values"]` continues to omit them (`Omit<…, "bgEffect" | …>`), so preset
  literals stay untouched.
- New export `pageEffectVars(theme)` — the same eight-variable `--pl-*` contract as
  `buttonEffectVars`, but derived from the **page** palette (`bgColor` / `textColor` /
  `accentColor`) rather than the button palette. Page-level targets (background, text)
  paint against the page, not against a button. See
  `docs/spikes/2026-09-03-profile-effect-palette-and-attachment.md`.
- `SiteTheme` (`packages/core/src/site-schema.ts`) is a different type and is **not**
  touched.

### 2. Server action (`apps/web/src/app/dashboard/actions.ts`)

- `themeSchema` gains `bgEffect`, `textEffect`, `entranceEffect`, each
  `z.string().max(40).optional()`.
- `DEFAULT_THEME_KEYS` gains the same three keys, so an accepted AI theme may write them.

### 3. Appearance → Effects tab

The existing surface section (driving `buttonEffect`) is unchanged, including its copy,
its "Clear" affordance and its four legacy groups. Three sections are appended below it:

| Section    | Target       | Column           | Copy                                              |
| ---------- | ------------ | ---------------- | ------------------------------------------------- |
| Background | `background` | `bgEffect`       | paints behind the whole page                      |
| Text       | `text`       | `textEffect`     | the display name and section headings             |
| Entrance   | `entrance`   | `entranceEffect` | blocks animate in as they scroll into view        |

Each uses `EffectPicker` with `palette={pageEffectVars(theme)}` plus the page's real
background, so every swatch previews in the creator's own colours. Admin chrome is
DESIGN.md tokens only (`border-line`, `bg-surface`, `text-ink`, `text-ink-muted`,
`shadow-soft`).

### 4. Renderer (`apps/web/src/components/profile/`)

New pure helper `profile-effects.ts`:

```ts
profileEffectClasses(theme): { background: string; text: string; entrance: string }
entranceMode(id): "none" | "group" | "item"
```

Attachment points (spike-backed):

- **background** → the ProfileView root `<div>`, the element that already carries
  `backgroundCss(theme)`. Effects paint on `::before` (`inset: 0`,
  `pointer-events: none`), so they sit behind every child and intercept nothing.
- **text** → the display-name heading (`<h1>` live, `<p>` in preview) and every
  `header` block's `<h2>`. Never body copy, links, or button labels.
- **entrance** → `enter-stagger` wraps the block **list** (its `> *` child delays are the
  cascade); every other entrance effect wraps **each block** so it animates as it scrolls
  into view. `EntranceGroup` sets `data-entered` via IntersectionObserver.

### 5. AI (`packages/ai/src/index.ts`)

`sanitizeGeneratedTheme` emits all three fields, validated against the registry **by
target**: an id whose `target` does not match the field is dropped to `"none"`, as is an
unknown id, a non-string, or an id for a different target. `generatedThemeSchema` gains
the three as optional enums of the real per-target ids, so the model is told what exists.

## Non-goals

- No schema change (frozen; `db:generate` only).
- No new top-level Appearance tab.
- No change to `buttonEffect` behaviour on links and cards.
- No touching `apps/web/src/app/studio/**`, `apps/web/src/components/site/**`,
  `packages/effects/**` (consumed only), `site-schema.ts`, `site-versioning.ts`.

## Acceptance

1. A theme whose three new columns are `"none"` renders byte-identical DOM to today.
2. Unknown ids and wrong-target ids are complete no-ops everywhere (picker, renderer,
   sanitizer).
3. With JavaScript disabled, every block is fully visible — entrance CSS is inert until
   `data-entered` lands.
4. Under `prefers-reduced-motion: reduce`, no effect animates (stylesheet `animation:
   none !important`) and `EntranceGroup` reveals immediately instead of observing.
5. `pnpm --filter @plink/web typecheck && lint && test`, `pnpm --filter @plink/core
   typecheck`, `pnpm --filter @plink/ai typecheck` all green.
