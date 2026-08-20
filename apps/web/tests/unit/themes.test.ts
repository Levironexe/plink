import { describe, expect, it } from "vitest";
import {
  BUTTON_RADII, DEFAULT_THEME, THEME_PRESETS, backgroundCss, buttonCss,
  fontStack, isLight, presetToTheme, radiusCss, rgba,
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
