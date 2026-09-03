import { describe, expect, it } from "vitest";
import {
  EFFECTS, EFFECT_GROUPS, EFFECT_NONE, applyEffects, effectById, effectClass,
  effectNeedsPointer, effectsForTarget, effectsInGroup,
} from "@plink/effects/registry";
import { EFFECT_TARGETS } from "@plink/core/site-schema";
import { DEFAULT_THEME, buttonEffectVars, presetToTheme, THEME_PRESETS } from "@plink/core/themes";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const css = readFileSync(require.resolve("@plink/effects/effects.css"), "utf8");

describe("effect registry", () => {
  it("has a unique id per effect", () => {
    const ids = EFFECTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("always includes the none effect, and only it has no class", () => {
    const withoutClass = EFFECTS.filter((e) => e.className === "");
    expect(withoutClass.map((e) => e.id)).toEqual([EFFECT_NONE]);
  });

  it("gives every effect a name, a description and a known group", () => {
    // EFFECT_GROUPS deliberately stays the four legacy surface groups; the
    // new targets carry their own group labels outside that list.
    const knownGroups = [...EFFECT_GROUPS, "Text", "Background", "Entrance"];
    for (const effect of EFFECTS) {
      expect(effect.name.length, effect.id).toBeGreaterThan(0);
      expect(effect.description.length, effect.id).toBeGreaterThan(0);
      expect(knownGroups, effect.id).toContain(effect.group);
      if (effect.target === "surface") {
        expect(EFFECT_GROUPS, effect.id).toContain(effect.group);
      }
    }
  });

  it("falls back to none for unknown or missing ids", () => {
    expect(effectById("was-removed-in-v2").id).toBe(EFFECT_NONE);
    expect(effectById(undefined).id).toBe(EFFECT_NONE);
    expect(effectById(null).id).toBe(EFFECT_NONE);
    expect(effectClass("nonsense")).toBe("");
    expect(effectNeedsPointer("nonsense")).toBe(false);
  });

  it("omits none from the group listings the picker renders", () => {
    for (const group of EFFECT_GROUPS) {
      expect(effectsInGroup(group).map((e) => e.id)).not.toContain(EFFECT_NONE);
    }
  });

  it("lists every surface effect in exactly one legacy group", () => {
    const grouped = EFFECT_GROUPS.flatMap((g) => effectsInGroup(g)).map((e) => e.id);
    const expected = EFFECTS
      .filter((e) => e.target === "surface" && e.id !== EFFECT_NONE)
      .map((e) => e.id);
    expect(grouped.sort()).toEqual(expected.sort());
  });
});

describe("effect targets", () => {
  const SURFACE_IDS = [
    "shimmer", "border-beam", "glow-pulse", "aurora", "breathe",
    "shine", "lift", "fill-sweep", "underline",
    "spotlight", "magnetic", "trace",
    "neon", "scanline", "grain",
  ];
  const TEXT_IDS = [
    "text-gradient", "text-shimmer", "text-typewriter", "text-blur-reveal",
    "text-wave", "text-glitch", "text-highlight",
  ];
  const BACKGROUND_IDS = [
    "bg-aurora", "bg-beams", "bg-dot-grid", "bg-grid",
    "bg-mesh-drift", "bg-noise", "bg-gradient-flow",
  ];
  const ENTRANCE_IDS = [
    "enter-fade-up", "enter-fade-in", "enter-zoom", "enter-blur",
    "enter-slide-left", "enter-slide-right", "enter-stagger",
  ];

  it("gives every effect a known target", () => {
    for (const effect of EFFECTS) {
      expect(EFFECT_TARGETS, effect.id).toContain(effect.target);
    }
  });

  it("keeps none a surface effect so legacy fallbacks stay intact", () => {
    expect(effectById(EFFECT_NONE).target).toBe("surface");
  });

  it("ships the exact contract ids per target", () => {
    expect(effectsForTarget("surface").map((e) => e.id).sort()).toEqual([...SURFACE_IDS].sort());
    expect(effectsForTarget("text").map((e) => e.id)).toEqual(TEXT_IDS);
    expect(effectsForTarget("background").map((e) => e.id)).toEqual(BACKGROUND_IDS);
    expect(effectsForTarget("entrance").map((e) => e.id)).toEqual(ENTRANCE_IDS);
  });

  it("partitions every effect except none across the four targets", () => {
    const partitioned = EFFECT_TARGETS.flatMap((t) => effectsForTarget(t)).map((e) => e.id);
    const expected = EFFECTS.filter((e) => e.id !== EFFECT_NONE).map((e) => e.id);
    expect(partitioned.sort()).toEqual(expected.sort());
    expect(new Set(partitioned).size).toBe(partitioned.length);
  });

  it("never lists none for any target", () => {
    for (const target of EFFECT_TARGETS) {
      expect(effectsForTarget(target).map((e) => e.id)).not.toContain(EFFECT_NONE);
    }
  });

  it("names classes after ids, pl-fx-<id>, for every new-target effect", () => {
    for (const target of ["text", "background", "entrance"] as const) {
      for (const effect of effectsForTarget(target)) {
        expect(effect.className).toBe(`pl-fx-${effect.id}`);
      }
    }
  });

  it("keeps the pointer hook a surface-only seam", () => {
    for (const effect of EFFECTS) {
      if (effect.target === "surface") continue;
      expect(effect.needsPointer, effect.id).toBe(false);
    }
  });

  it("keeps EFFECT_GROUPS and effectsInGroup surface-only for the Appearance tab", () => {
    expect(EFFECT_GROUPS).toEqual(["Ambient", "Hover", "Pointer", "Bold"]);
    for (const group of EFFECT_GROUPS) {
      for (const effect of effectsInGroup(group)) {
        expect(effect.target, effect.id).toBe("surface");
      }
    }
    // Even called with a new-target group value, the legacy API yields nothing.
    expect(effectsInGroup("Text")).toEqual([]);
    expect(effectsInGroup("Background")).toEqual([]);
    expect(effectsInGroup("Entrance")).toEqual([]);
  });

  it("pins the legacy surface groups exactly as before this feature", () => {
    expect(effectsInGroup("Ambient").map((e) => e.id)).toEqual([
      "shimmer", "border-beam", "glow-pulse", "aurora", "breathe",
    ]);
    expect(effectsInGroup("Hover").map((e) => e.id)).toEqual([
      "shine", "lift", "fill-sweep", "underline",
    ]);
    expect(effectsInGroup("Pointer").map((e) => e.id)).toEqual([
      "spotlight", "magnetic", "trace",
    ]);
    expect(effectsInGroup("Bold").map((e) => e.id)).toEqual(["neon", "scanline", "grain"]);
  });
});

describe("applyEffects", () => {
  it("composes one class per assigned target, pl-fx first, in target order", () => {
    expect(
      applyEffects({
        surface: "shimmer",
        text: "text-gradient",
        background: "bg-grid",
        entrance: "enter-fade-up",
      }),
    ).toBe("pl-fx pl-fx-shimmer pl-fx-text-gradient pl-fx-bg-grid pl-fx-enter-fade-up");
  });

  it("applies a single assignment on its own", () => {
    expect(applyEffects({ text: "text-wave" })).toBe("pl-fx pl-fx-text-wave");
  });

  it("returns an empty string when nothing resolves", () => {
    expect(applyEffects({})).toBe("");
    expect(applyEffects({ surface: "none" })).toBe("");
    expect(applyEffects({ surface: "was-removed-in-v2" })).toBe("");
  });

  it("ignores unknown ids without dropping the rest", () => {
    expect(applyEffects({ surface: "nonsense", entrance: "enter-zoom" })).toBe(
      "pl-fx pl-fx-enter-zoom",
    );
  });

  it("ignores ids filed under the wrong target", () => {
    expect(applyEffects({ surface: "text-glitch" })).toBe("");
    expect(applyEffects({ text: "shimmer", background: "bg-noise" })).toBe(
      "pl-fx pl-fx-bg-noise",
    );
  });
});

describe("registry and stylesheet stay in step", () => {
  it("defines a rule for every registered class", () => {
    for (const effect of EFFECTS) {
      if (!effect.className) continue;
      expect(css, `${effect.id} has no CSS`).toContain(`.${effect.className}`);
    }
  });

  it("declares no effect class the registry does not know about", () => {
    const declared = new Set([...css.matchAll(/\.(pl-fx-[a-z-]+)/g)].map((m) => m[1]));
    const registered = new Set(EFFECTS.map((e) => e.className).filter(Boolean));
    for (const className of declared) {
      expect(registered, `${className} is orphaned CSS`).toContain(className);
    }
  });

  it("only reads pointer variables from effects that ask for them", () => {
    for (const effect of EFFECTS) {
      if (!effect.className || effect.needsPointer) continue;
      const block = css.split(`.${effect.className}`).slice(1).join("");
      const ownRules = block.split(/\n\.pl-fx-/)[0];
      expect(ownRules, `${effect.id} reads the pointer without declaring it`).not.toContain("--pl-mx");
    }
  });

  it("honours prefers-reduced-motion", () => {
    expect(css).toContain("prefers-reduced-motion: reduce");
  });

  it("keeps entrance effects inert until data-entered lands", () => {
    // Every selector naming an entrance class hangs off [data-entered], so
    // content is fully visible without JS and nothing is ever pre-hidden.
    for (const effect of effectsForTarget("entrance")) {
      const uses = [
        ...css.matchAll(new RegExp(`\\.${effect.className}(?![a-z-])(\\[data-entered\\])?`, "g")),
      ];
      expect(uses.length, `${effect.id} appears in the css`).toBeGreaterThan(0);
      for (const use of uses) {
        expect(use[1], `${effect.id} is styled without data-entered`).toBe("[data-entered]");
      }
    }
  });

  it("silences the stagger children under reduced motion", () => {
    const reduced = css.split("prefers-reduced-motion: reduce")[1] ?? "";
    expect(reduced).toContain(".pl-fx-enter-stagger[data-entered] > *");
  });
});

describe("buttonEffectVars", () => {
  it("emits the full variable contract the stylesheet relies on", () => {
    const vars = buttonEffectVars(DEFAULT_THEME) as Record<string, string>;
    for (const name of [
      "--pl-bg", "--pl-fg", "--pl-accent",
      "--pl-fg-12", "--pl-fg-25", "--pl-fg-45",
      "--pl-accent-30", "--pl-accent-60",
    ]) {
      expect(vars[name], name).toBeTruthy();
    }
  });

  it("defines every variable the stylesheet consumes", () => {
    const used = new Set(
      [...css.matchAll(/var\((--pl-[a-z0-9-]+)/g)].map((m) => m[1]),
    );
    const provided = new Set(Object.keys(buttonEffectVars(DEFAULT_THEME)));
    // Pointer variables are written by the hook at runtime, not by the theme.
    const runtime = new Set(["--pl-mx", "--pl-my", "--pl-dx", "--pl-dy", "--pl-angle"]);
    for (const name of used) {
      if (runtime.has(name)) continue;
      expect(provided, `${name} is used in CSS but never emitted`).toContain(name);
    }
  });

  it("derives alpha variants from the theme's own colours", () => {
    const vars = buttonEffectVars({
      ...DEFAULT_THEME,
      buttonTextColor: "#ffffff",
      accentColor: "#000000",
    }) as Record<string, string>;
    expect(vars["--pl-fg-25"]).toBe("rgba(255, 255, 255, 0.25)");
    expect(vars["--pl-accent-30"]).toBe("rgba(0, 0, 0, 0.3)");
  });
});

describe("themes carry an effect", () => {
  it("defaults to no effect", () => {
    expect(DEFAULT_THEME.buttonEffect).toBe(EFFECT_NONE);
  });

  it("resets the effect when a preset does not name one", () => {
    const plain = THEME_PRESETS.find((p) => p.values.buttonEffect === undefined)!;
    expect(presetToTheme(plain).buttonEffect).toBe(EFFECT_NONE);
  });

  it("only names effects that exist", () => {
    for (const preset of THEME_PRESETS) {
      const id = preset.values.buttonEffect;
      if (!id) continue;
      expect(effectById(id).id, `${preset.id} names a missing effect`).toBe(id);
    }
  });
});
