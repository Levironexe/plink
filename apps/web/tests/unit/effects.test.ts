import { describe, expect, it } from "vitest";
import {
  EFFECTS, EFFECT_GROUPS, EFFECT_NONE, effectById, effectClass,
  effectNeedsPointer, effectsInGroup,
} from "@plink/effects/registry";
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
    for (const effect of EFFECTS) {
      expect(effect.name.length, effect.id).toBeGreaterThan(0);
      expect(effect.description.length, effect.id).toBeGreaterThan(0);
      expect(EFFECT_GROUPS, effect.id).toContain(effect.group);
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

  it("lists every effect in exactly one group", () => {
    const grouped = EFFECT_GROUPS.flatMap((g) => effectsInGroup(g)).map((e) => e.id);
    const expected = EFFECTS.filter((e) => e.id !== EFFECT_NONE).map((e) => e.id);
    expect(grouped.sort()).toEqual(expected.sort());
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
