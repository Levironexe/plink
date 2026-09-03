/**
 * The effect registry — the one place an effect is declared.
 *
 * The Appearance picker, the public renderer and the tests all read this array,
 * so adding an effect means adding one entry here plus a class in effects.css.
 * Nothing else needs to change.
 *
 * An effect is data, never a component. It has to survive a round trip through a
 * database column and back out to the browser, and it has to compose with all
 * five button styles and all five corner radii without knowing about any of them.
 *
 * Since the Website OS work, an effect also names a `target` — the kind of
 * element it decorates. Surfaces keep the original vocabulary; text, background
 * and entrance effects join them, reached through `effectsForTarget` and applied
 * together through `applyEffects`. The legacy `EFFECT_GROUPS` / `effectsInGroup`
 * pair intentionally still speaks only about surfaces, so the existing
 * Appearance tab renders exactly as before.
 */

import type { EffectAssignment, EffectTarget } from "@plink/core/site-schema";

export type EffectGroup =
  | "Ambient"
  | "Hover"
  | "Pointer"
  | "Bold"
  | "Text"
  | "Background"
  | "Entrance";

export type EffectDefinition = {
  /** Stored in Theme.buttonEffect. Never change one — pages in the wild use it. */
  id: string;
  name: string;
  /** One line, shown under the swatch in the picker. */
  description: string;
  group: EffectGroup;
  /** The kind of element this effect decorates. */
  target: EffectTarget;
  /** The CSS class applied to the surface. Empty for `none`. */
  className: string;
  /**
   * Whether the effect reads pointer position from `--pl-mx` / `--pl-my`.
   * Surfaces only attach a pointermove listener when this is true, so the
   * common case costs nothing.
   */
  needsPointer: boolean;
  /**
   * Whether the effect animates on its own, without interaction. Used to hold
   * the picker's preview still until hover for hover-only effects, and to warn
   * in the editor when several ambient effects would compete for attention.
   */
  ambient: boolean;
};

export const EFFECT_NONE = "none";

export const EFFECTS: EffectDefinition[] = [
  {
    id: EFFECT_NONE,
    name: "None",
    description: "The plain surface, exactly as it is today.",
    group: "Ambient",
    target: "surface",
    className: "",
    needsPointer: false,
    ambient: false,
  },

  /* ---------------------------------------------------------------- ambient */
  {
    id: "shimmer",
    name: "Shimmer",
    description: "A band of light drifts across the surface.",
    group: "Ambient",
    target: "surface",
    className: "pl-fx-shimmer",
    needsPointer: false,
    ambient: true,
  },
  {
    id: "border-beam",
    name: "Border beam",
    description: "A bright segment travels around the edge.",
    group: "Ambient",
    target: "surface",
    className: "pl-fx-border-beam",
    needsPointer: false,
    ambient: true,
  },
  {
    id: "glow-pulse",
    name: "Glow pulse",
    description: "A soft halo breathes in and out.",
    group: "Ambient",
    target: "surface",
    className: "pl-fx-glow-pulse",
    needsPointer: false,
    ambient: true,
  },
  {
    id: "aurora",
    name: "Aurora",
    description: "Colour drifts slowly beneath the content.",
    group: "Ambient",
    target: "surface",
    className: "pl-fx-aurora",
    needsPointer: false,
    ambient: true,
  },
  {
    id: "breathe",
    name: "Breathe",
    description: "The surface swells and settles, barely.",
    group: "Ambient",
    target: "surface",
    className: "pl-fx-breathe",
    needsPointer: false,
    ambient: true,
  },

  /* ------------------------------------------------------------------ hover */
  {
    id: "shine",
    name: "Shine",
    description: "A single sweep of light on hover.",
    group: "Hover",
    target: "surface",
    className: "pl-fx-shine",
    needsPointer: false,
    ambient: false,
  },
  {
    id: "lift",
    name: "Lift",
    description: "Rises off the page with a deepening shadow.",
    group: "Hover",
    target: "surface",
    className: "pl-fx-lift",
    needsPointer: false,
    ambient: false,
  },
  {
    id: "fill-sweep",
    name: "Fill sweep",
    description: "Accent colour floods in from the left.",
    group: "Hover",
    target: "surface",
    className: "pl-fx-fill-sweep",
    needsPointer: false,
    ambient: false,
  },
  {
    id: "underline",
    name: "Underline",
    description: "A line draws itself along the bottom edge.",
    group: "Hover",
    target: "surface",
    className: "pl-fx-underline",
    needsPointer: false,
    ambient: false,
  },

  /* ---------------------------------------------------------------- pointer */
  {
    id: "spotlight",
    name: "Spotlight",
    description: "A pool of light follows the cursor.",
    group: "Pointer",
    target: "surface",
    className: "pl-fx-spotlight",
    needsPointer: true,
    ambient: false,
  },
  {
    id: "magnetic",
    name: "Magnetic",
    description: "The surface tilts toward the cursor.",
    group: "Pointer",
    target: "surface",
    className: "pl-fx-magnetic",
    needsPointer: true,
    ambient: false,
  },
  {
    id: "trace",
    name: "Trace",
    description: "The edge lights up nearest the cursor.",
    group: "Pointer",
    target: "surface",
    className: "pl-fx-trace",
    needsPointer: true,
    ambient: false,
  },

  /* ------------------------------------------------------------------- bold */
  {
    id: "neon",
    name: "Neon",
    description: "An accent outline that hums like a sign.",
    group: "Bold",
    target: "surface",
    className: "pl-fx-neon",
    needsPointer: false,
    ambient: true,
  },
  {
    id: "scanline",
    name: "Scanline",
    description: "A CRT line rolls down the surface.",
    group: "Bold",
    target: "surface",
    className: "pl-fx-scanline",
    needsPointer: false,
    ambient: true,
  },
  {
    id: "grain",
    name: "Grain",
    description: "Fine film grain shifts over the surface.",
    group: "Bold",
    target: "surface",
    className: "pl-fx-grain",
    needsPointer: false,
    ambient: true,
  },

  /* ------------------------------------------------------------------- text */
  {
    id: "text-gradient",
    name: "Gradient",
    description: "The letters wear a slowly drifting gradient.",
    group: "Text",
    target: "text",
    className: "pl-fx-text-gradient",
    needsPointer: false,
    ambient: true,
  },
  {
    id: "text-shimmer",
    name: "Shimmer",
    description: "A band of light sweeps through the letters.",
    group: "Text",
    target: "text",
    className: "pl-fx-text-shimmer",
    needsPointer: false,
    ambient: true,
  },
  {
    id: "text-typewriter",
    name: "Typewriter",
    description: "The line types itself out once, in steps.",
    group: "Text",
    target: "text",
    className: "pl-fx-text-typewriter",
    needsPointer: false,
    ambient: true,
  },
  {
    id: "text-blur-reveal",
    name: "Blur reveal",
    description: "Comes into focus from a soft blur.",
    group: "Text",
    target: "text",
    className: "pl-fx-text-blur-reveal",
    needsPointer: false,
    ambient: true,
  },
  {
    id: "text-wave",
    name: "Wave",
    description: "The line rides a gentle, endless swell.",
    group: "Text",
    target: "text",
    className: "pl-fx-text-wave",
    needsPointer: false,
    ambient: true,
  },
  {
    id: "text-glitch",
    name: "Glitch",
    description: "An occasional signal dropout jolts the line.",
    group: "Text",
    target: "text",
    className: "pl-fx-text-glitch",
    needsPointer: false,
    ambient: true,
  },
  {
    id: "text-highlight",
    name: "Highlight",
    description: "A marker stroke draws itself behind the words.",
    group: "Text",
    target: "text",
    className: "pl-fx-text-highlight",
    needsPointer: false,
    ambient: true,
  },

  /* ------------------------------------------------------------- background */
  {
    id: "bg-aurora",
    name: "Aurora",
    description: "Curtains of colour drift across the backdrop.",
    group: "Background",
    target: "background",
    className: "pl-fx-bg-aurora",
    needsPointer: false,
    ambient: true,
  },
  {
    id: "bg-beams",
    name: "Beams",
    description: "Diagonal beams of light cross slowly.",
    group: "Background",
    target: "background",
    className: "pl-fx-bg-beams",
    needsPointer: false,
    ambient: true,
  },
  {
    id: "bg-dot-grid",
    name: "Dot grid",
    description: "A quiet field of dots behind everything.",
    group: "Background",
    target: "background",
    className: "pl-fx-bg-dot-grid",
    needsPointer: false,
    ambient: false,
  },
  {
    id: "bg-grid",
    name: "Grid",
    description: "Fine graph-paper lines behind everything.",
    group: "Background",
    target: "background",
    className: "pl-fx-bg-grid",
    needsPointer: false,
    ambient: false,
  },
  {
    id: "bg-mesh-drift",
    name: "Mesh drift",
    description: "Pools of colour breathe in the corners.",
    group: "Background",
    target: "background",
    className: "pl-fx-bg-mesh-drift",
    needsPointer: false,
    ambient: true,
  },
  {
    id: "bg-noise",
    name: "Noise",
    description: "A whisper of film grain over the backdrop.",
    group: "Background",
    target: "background",
    className: "pl-fx-bg-noise",
    needsPointer: false,
    ambient: false,
  },
  {
    id: "bg-gradient-flow",
    name: "Gradient flow",
    description: "A wash of colour flows end to end.",
    group: "Background",
    target: "background",
    className: "pl-fx-bg-gradient-flow",
    needsPointer: false,
    ambient: true,
  },

  /* --------------------------------------------------------------- entrance */
  {
    id: "enter-fade-up",
    name: "Fade up",
    description: "Rises into place as it fades in.",
    group: "Entrance",
    target: "entrance",
    className: "pl-fx-enter-fade-up",
    needsPointer: false,
    ambient: false,
  },
  {
    id: "enter-fade-in",
    name: "Fade in",
    description: "Simply appears, unhurried.",
    group: "Entrance",
    target: "entrance",
    className: "pl-fx-enter-fade-in",
    needsPointer: false,
    ambient: false,
  },
  {
    id: "enter-zoom",
    name: "Zoom",
    description: "Settles in from slightly larger than life.",
    group: "Entrance",
    target: "entrance",
    className: "pl-fx-enter-zoom",
    needsPointer: false,
    ambient: false,
  },
  {
    id: "enter-blur",
    name: "Blur",
    description: "Sharpens out of a soft haze.",
    group: "Entrance",
    target: "entrance",
    className: "pl-fx-enter-blur",
    needsPointer: false,
    ambient: false,
  },
  {
    id: "enter-slide-left",
    name: "Slide left",
    description: "Glides in leftward from the right.",
    group: "Entrance",
    target: "entrance",
    className: "pl-fx-enter-slide-left",
    needsPointer: false,
    ambient: false,
  },
  {
    id: "enter-slide-right",
    name: "Slide right",
    description: "Glides in rightward from the left.",
    group: "Entrance",
    target: "entrance",
    className: "pl-fx-enter-slide-right",
    needsPointer: false,
    ambient: false,
  },
  {
    id: "enter-stagger",
    name: "Stagger",
    description: "Each child arrives a beat after the last.",
    group: "Entrance",
    target: "entrance",
    className: "pl-fx-enter-stagger",
    needsPointer: false,
    ambient: false,
  },
];

export const EFFECT_GROUPS: EffectGroup[] = ["Ambient", "Hover", "Pointer", "Bold"];

const BY_ID = new Map(EFFECTS.map((effect) => [effect.id, effect]));

/** Unknown ids fall back to `none` so a stale row can never break a page. */
export function effectById(id: string | null | undefined): EffectDefinition {
  return BY_ID.get(id ?? EFFECT_NONE) ?? BY_ID.get(EFFECT_NONE)!;
}

export function effectClass(id: string | null | undefined): string {
  return effectById(id).className;
}

export function effectNeedsPointer(id: string | null | undefined): boolean {
  return effectById(id).needsPointer;
}

/**
 * The legacy grouping API. It predates targets and every caller of it (the
 * Appearance effects tab) expects surfaces only, so it is pinned to them —
 * text / background / entrance effects are reached through `effectsForTarget`.
 */
export function effectsInGroup(group: EffectGroup): EffectDefinition[] {
  return EFFECTS.filter(
    (effect) =>
      effect.group === group && effect.target === "surface" && effect.id !== EFFECT_NONE,
  );
}

/** Every pickable effect for one target. `none` is a UI affordance, not an entry. */
export function effectsForTarget(target: EffectTarget): EffectDefinition[] {
  return EFFECTS.filter((effect) => effect.target === target && effect.id !== EFFECT_NONE);
}

const TARGET_ORDER: readonly EffectTarget[] = ["surface", "text", "background", "entrance"];

/**
 * Turns a per-element assignment into the class string that element wears.
 *
 * Forgiving by design, like `effectById`: an unknown id, an id filed under the
 * wrong target, or a bare `none` contributes nothing — a stale document can
 * never break a page. Returns `""` when nothing resolves, so callers can feed
 * the result straight into `cn(...)` without a guard.
 */
export function applyEffects(assignment: EffectAssignment): string {
  const classes: string[] = [];
  for (const target of TARGET_ORDER) {
    const id = assignment[target];
    if (!id) continue;
    const effect = BY_ID.get(id);
    if (!effect || effect.target !== target || !effect.className) continue;
    classes.push(effect.className);
  }
  return classes.length === 0 ? "" : ["pl-fx", ...classes].join(" ");
}
