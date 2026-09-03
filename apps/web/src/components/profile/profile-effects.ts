import { applyEffects } from "@plink/effects/registry";
import type { ThemeShape } from "@plink/core/themes";

/**
 * What a creator's theme means for the page's markup.
 *
 * Kept pure and free of React so the rendering decisions — which class each
 * element wears, and which shape the block list takes — can be pinned by unit
 * tests without a DOM, a database or a dev server.
 *
 * Validation is `applyEffects`', not ours: an unknown id, an id filed under a
 * different target and a bare "none" all contribute nothing, so a stale row or
 * a theme written before an effect was retired can never break a page.
 */

export type ProfileEffectClasses = {
  /** Goes on the element carrying the theme background. */
  background: string;
  /** Goes on the display name and on section headings. Never on body copy. */
  text: string;
  /** Goes on whatever `entranceMode` says should wear it. */
  entrance: string;
};

export function profileEffectClasses(
  theme: Pick<ThemeShape, "bgEffect" | "textEffect" | "entranceEffect">,
): ProfileEffectClasses {
  return {
    background: applyEffects({ background: theme.bgEffect }),
    text: applyEffects({ text: theme.textEffect }),
    entrance: applyEffects({ entrance: theme.entranceEffect }),
  };
}

/**
 * The one entrance effect that animates its *children* rather than itself:
 * `.pl-fx-enter-stagger[data-entered] > *` carries the per-child delays that
 * make the cascade. Everything else animates the element it lands on.
 *
 * A list, not a literal, so a second child-animating effect is one entry away.
 */
const GROUP_ENTRANCE_IDS = new Set(["enter-stagger"]);

export type EntranceMode =
  /** No entrance effect resolves — render exactly as a page without one. */
  | "none"
  /** The effect wraps the whole block list and animates its children. */
  | "group"
  /** The effect wraps each block, which animates as it scrolls into view. */
  | "item";

export function entranceMode(id: string | null | undefined): EntranceMode {
  // Round-tripping through applyEffects means the mode agrees with the class:
  // anything that would paint nothing is "none" here too.
  if (!id || !applyEffects({ entrance: id })) return "none";
  return GROUP_ENTRANCE_IDS.has(id) ? "group" : "item";
}
