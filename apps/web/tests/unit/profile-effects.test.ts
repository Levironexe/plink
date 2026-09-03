import { describe, expect, it } from "vitest";
import { entranceMode, profileEffectClasses } from "@/components/profile/profile-effects";
import { effectsForTarget } from "@plink/effects/registry";
import { DEFAULT_THEME } from "@plink/core/themes";

/**
 * The rendering decisions a creator's theme makes, pinned without a DOM.
 * `profileEffectClasses` says what each element wears; `entranceMode` says
 * which shape the block list takes.
 */

const theme = (over: Partial<typeof DEFAULT_THEME> = {}) => ({ ...DEFAULT_THEME, ...over });

describe("profileEffectClasses", () => {
  it("returns nothing for a theme that has not opted in", () => {
    // The public page must render identically to a page from before effects.
    expect(profileEffectClasses(DEFAULT_THEME)).toEqual({
      background: "",
      text: "",
      entrance: "",
    });
  });

  it("wears pl-fx plus the effect's own class, per target", () => {
    expect(
      profileEffectClasses(
        theme({
          bgEffect: "bg-aurora",
          textEffect: "text-gradient",
          entranceEffect: "enter-fade-up",
        }),
      ),
    ).toEqual({
      background: "pl-fx pl-fx-bg-aurora",
      text: "pl-fx pl-fx-text-gradient",
      entrance: "pl-fx pl-fx-enter-fade-up",
    });
  });

  it("resolves every id the picker can offer for its target", () => {
    for (const effect of effectsForTarget("background")) {
      expect(profileEffectClasses(theme({ bgEffect: effect.id })).background).toBe(
        `pl-fx ${effect.className}`,
      );
    }
    for (const effect of effectsForTarget("text")) {
      expect(profileEffectClasses(theme({ textEffect: effect.id })).text).toBe(
        `pl-fx ${effect.className}`,
      );
    }
    for (const effect of effectsForTarget("entrance")) {
      expect(profileEffectClasses(theme({ entranceEffect: effect.id })).entrance).toBe(
        `pl-fx ${effect.className}`,
      );
    }
  });

  it("makes an unknown id a complete no-op", () => {
    const classes = profileEffectClasses(
      theme({
        bgEffect: "was-removed-in-v2",
        textEffect: "",
        entranceEffect: "enter-teleport",
      }),
    );
    expect(classes).toEqual({ background: "", text: "", entrance: "" });
  });

  it("drops an id belonging to another target", () => {
    // `text-glitch` is real, but nothing designed it to paint a page
    // background — and `shimmer` is a surface effect, not a text one.
    const classes = profileEffectClasses(
      theme({
        bgEffect: "text-glitch",
        textEffect: "shimmer",
        entranceEffect: "bg-grid",
      }),
    );
    expect(classes).toEqual({ background: "", text: "", entrance: "" });
  });

  it("keeps a valid target when a sibling is junk", () => {
    const classes = profileEffectClasses(
      theme({ bgEffect: "nonsense", textEffect: "text-wave", entranceEffect: "none" }),
    );
    expect(classes.background).toBe("");
    expect(classes.text).toBe("pl-fx pl-fx-text-wave");
    expect(classes.entrance).toBe("");
  });
});

describe("entranceMode", () => {
  it("renders the untouched list for none, unknown and wrong-target ids", () => {
    for (const id of ["none", "", "enter-teleport", "bg-grid", null, undefined]) {
      expect(entranceMode(id), String(id)).toBe("none");
    }
  });

  it("wraps each block for an effect that animates itself", () => {
    for (const id of [
      "enter-fade-up", "enter-fade-in", "enter-zoom", "enter-blur",
      "enter-slide-left", "enter-slide-right",
    ]) {
      expect(entranceMode(id), id).toBe("item");
    }
  });

  it("wraps the whole list for stagger, whose CSS animates its children", () => {
    expect(entranceMode("enter-stagger")).toBe("group");
  });

  it("classifies every entrance effect the picker offers", () => {
    for (const effect of effectsForTarget("entrance")) {
      expect(["group", "item"], effect.id).toContain(entranceMode(effect.id));
    }
  });

  it("agrees with the class helper about what resolves", () => {
    // A mode of "none" must mean no class, and vice versa — otherwise the
    // renderer could wrap blocks in a group wearing nothing, or the reverse.
    for (const id of [
      "none", "nonsense", "bg-grid", "enter-zoom", "enter-stagger", "text-wave",
    ]) {
      const hasClass = profileEffectClasses(theme({ entranceEffect: id })).entrance !== "";
      expect(entranceMode(id) !== "none", id).toBe(hasClass);
    }
  });
});
