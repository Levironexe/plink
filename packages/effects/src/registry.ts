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
 */

export type EffectGroup = "Ambient" | "Hover" | "Pointer" | "Bold";

export type EffectDefinition = {
  /** Stored in Theme.buttonEffect. Never change one — pages in the wild use it. */
  id: string;
  name: string;
  /** One line, shown under the swatch in the picker. */
  description: string;
  group: EffectGroup;
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
    className: "pl-fx-shimmer",
    needsPointer: false,
    ambient: true,
  },
  {
    id: "border-beam",
    name: "Border beam",
    description: "A bright segment travels around the edge.",
    group: "Ambient",
    className: "pl-fx-border-beam",
    needsPointer: false,
    ambient: true,
  },
  {
    id: "glow-pulse",
    name: "Glow pulse",
    description: "A soft halo breathes in and out.",
    group: "Ambient",
    className: "pl-fx-glow-pulse",
    needsPointer: false,
    ambient: true,
  },
  {
    id: "aurora",
    name: "Aurora",
    description: "Colour drifts slowly beneath the content.",
    group: "Ambient",
    className: "pl-fx-aurora",
    needsPointer: false,
    ambient: true,
  },
  {
    id: "breathe",
    name: "Breathe",
    description: "The surface swells and settles, barely.",
    group: "Ambient",
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
    className: "pl-fx-shine",
    needsPointer: false,
    ambient: false,
  },
  {
    id: "lift",
    name: "Lift",
    description: "Rises off the page with a deepening shadow.",
    group: "Hover",
    className: "pl-fx-lift",
    needsPointer: false,
    ambient: false,
  },
  {
    id: "fill-sweep",
    name: "Fill sweep",
    description: "Accent colour floods in from the left.",
    group: "Hover",
    className: "pl-fx-fill-sweep",
    needsPointer: false,
    ambient: false,
  },
  {
    id: "underline",
    name: "Underline",
    description: "A line draws itself along the bottom edge.",
    group: "Hover",
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
    className: "pl-fx-spotlight",
    needsPointer: true,
    ambient: false,
  },
  {
    id: "magnetic",
    name: "Magnetic",
    description: "The surface tilts toward the cursor.",
    group: "Pointer",
    className: "pl-fx-magnetic",
    needsPointer: true,
    ambient: false,
  },
  {
    id: "trace",
    name: "Trace",
    description: "The edge lights up nearest the cursor.",
    group: "Pointer",
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
    className: "pl-fx-neon",
    needsPointer: false,
    ambient: true,
  },
  {
    id: "scanline",
    name: "Scanline",
    description: "A CRT line rolls down the surface.",
    group: "Bold",
    className: "pl-fx-scanline",
    needsPointer: false,
    ambient: true,
  },
  {
    id: "grain",
    name: "Grain",
    description: "Fine film grain shifts over the surface.",
    group: "Bold",
    className: "pl-fx-grain",
    needsPointer: false,
    ambient: true,
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

export function effectsInGroup(group: EffectGroup): EffectDefinition[] {
  return EFFECTS.filter((effect) => effect.group === group && effect.id !== EFFECT_NONE);
}
