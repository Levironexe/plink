import { describe, expect, it } from "vitest";
import {
  BUTTON_RADII, DEFAULT_THEME, THEME_PRESETS, backgroundCss, buttonCss,
  buttonEffectVars, fontStack, isLight, pageEffectVars, presetToTheme, radiusCss, rgba,
} from "@plink/core/themes";

describe("theme presets", () => {
  it("has a unique id per preset", () => {
    const ids = THEME_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("produces a complete theme from any preset", () => {
    for (const preset of THEME_PRESETS) {
      const theme = presetToTheme(preset);
      for (const key of Object.keys(DEFAULT_THEME)) {
        expect(theme).toHaveProperty(key);
      }
      expect(theme.presetId).toBe(preset.id);
    }
  });
});

describe("effect defaults", () => {
  const PAGE_TARGETS = ["bgEffect", "textEffect", "entranceEffect"] as const;

  it("starts every page-level effect off", () => {
    for (const key of PAGE_TARGETS) {
      expect(DEFAULT_THEME[key], key).toBe("none");
    }
    expect(DEFAULT_THEME.buttonEffect).toBe("none");
  });

  it("leaves every page-level effect off for every preset", () => {
    // No preset names one, so applying a theme can never switch a creator's
    // background, text or entrance effect on behind their back.
    for (const preset of THEME_PRESETS) {
      const theme = presetToTheme(preset);
      for (const key of PAGE_TARGETS) {
        expect(theme[key], `${preset.id}.${key}`).toBe("none");
      }
    }
  });

  it("still lets a preset carry its signature surface effect", () => {
    const signature = THEME_PRESETS.find((p) => p.values.buttonEffect)!;
    expect(presetToTheme(signature).buttonEffect).toBe(signature.values.buttonEffect);

    const plain = THEME_PRESETS.find((p) => p.values.buttonEffect === undefined)!;
    expect(presetToTheme(plain).buttonEffect).toBe("none");
  });
});

describe("pageEffectVars", () => {
  const VAR_NAMES = [
    "--pl-bg", "--pl-fg", "--pl-accent",
    "--pl-fg-12", "--pl-fg-25", "--pl-fg-45",
    "--pl-accent-30", "--pl-accent-60",
  ];

  it("emits the same variable contract as the button palette", () => {
    // One contract, two provenances: effects.css reads these names and nothing
    // else, so a page-level effect must supply every one of them.
    expect(Object.keys(pageEffectVars(DEFAULT_THEME)).sort()).toEqual(
      Object.keys(buttonEffectVars(DEFAULT_THEME)).sort(),
    );
    const vars = pageEffectVars(DEFAULT_THEME) as Record<string, string>;
    for (const name of VAR_NAMES) expect(vars[name], name).toBeTruthy();
  });

  it("reads the page palette, not the button palette", () => {
    // The `citrus` case: a button foreground identical to the page background
    // would make a background effect invisible. Page effects read the ink.
    const theme = {
      ...DEFAULT_THEME,
      bgColor: "#c6ff4a",
      textColor: "#10210a",
      buttonColor: "#10210a",
      buttonTextColor: "#c6ff4a",
      accentColor: "#000000",
    };
    const vars = pageEffectVars(theme) as Record<string, string>;

    expect(vars["--pl-bg"]).toBe("#c6ff4a");
    expect(vars["--pl-fg"]).toBe("#10210a");
    expect(vars["--pl-fg-12"]).toBe(rgba("#10210a", 0.12));
    expect(vars["--pl-accent-30"]).toBe("rgba(0, 0, 0, 0.3)");

    const buttonVars = buttonEffectVars(theme) as Record<string, string>;
    expect(buttonVars["--pl-fg"]).toBe("#c6ff4a");
  });
});

describe("colour helpers", () => {
  it("expands shorthand hex values", () => {
    expect(rgba("#fff", 0.5)).toBe("rgba(255, 255, 255, 0.5)");
    expect(rgba("000000", 1)).toBe("rgba(0, 0, 0, 1)");
  });

  it("classifies light and dark colours", () => {
    expect(isLight("#ffffff")).toBe(true);
    expect(isLight("#0b0b10")).toBe(false);
  });
});

describe("css builders", () => {
  it("uses a gradient only for gradient backgrounds", () => {
    const gradient = backgroundCss({ ...DEFAULT_THEME, bgType: "gradient" });
    expect(gradient.backgroundImage).toContain("linear-gradient");

    const solid = backgroundCss({ ...DEFAULT_THEME, bgType: "solid", bgColor: "#123456" });
    expect(solid.backgroundColor).toBe("#123456");
    expect(solid.backgroundImage).toBeUndefined();
  });

  it("overlays an image background with a readability scrim", () => {
    const image = backgroundCss({
      ...DEFAULT_THEME,
      bgType: "image",
      bgImageUrl: "https://example.com/a.jpg",
    });
    expect(image.backgroundImage).toContain("https://example.com/a.jpg");
    expect(image.backgroundImage).toContain("linear-gradient");
  });

  it("gives every button style a radius and a colour", () => {
    for (const style of ["fill", "outline", "soft", "shadow", "glass"]) {
      const css = buttonCss({ ...DEFAULT_THEME, buttonStyle: style });
      expect(css.borderRadius).toBeTruthy();
      expect(css.color).toBeTruthy();
    }
  });

  it("maps every radius id and falls back for unknown ones", () => {
    for (const r of BUTTON_RADII) expect(radiusCss(r.id)).toBe(r.css);
    expect(radiusCss("nope")).toBe("999px");
  });

  it("falls back to the first font for unknown ids", () => {
    expect(fontStack("nope")).toBe(fontStack("inter"));
  });
});
