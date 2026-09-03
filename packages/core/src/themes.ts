export type ThemeShape = {
  presetId: string;
  bgType: string;
  bgColor: string;
  bgColorTwo: string;
  bgImageUrl?: string | null;
  bgPattern: string;
  textColor: string;
  mutedColor: string;
  accentColor: string;
  buttonStyle: string;
  buttonRadius: string;
  buttonColor: string;
  buttonTextColor: string;
  /**
   * Effect ids from @plink/effects, one per target. "none" is the resting look
   * for all four, and an id belonging to another target resolves to nothing —
   * a stale row can never break a page.
   *
   * `buttonEffect` is the surface target and predates the rest, which is why it
   * keeps its original name.
   */
  buttonEffect: string;
  bgEffect: string;
  textEffect: string;
  entranceEffect: string;
  fontFamily: string;
  avatarShape: string;
  hideBranding: boolean;
};

/** The effect fields, which a preset never names and a caller always defaults. */
type ThemeEffectKeys = "buttonEffect" | "bgEffect" | "textEffect" | "entranceEffect";

/** Every effect target off, the state a theme starts in. */
const NO_EFFECTS: Record<ThemeEffectKeys, string> = {
  buttonEffect: "none",
  bgEffect: "none",
  textEffect: "none",
  entranceEffect: "none",
};

/** A preset may name a signature surface effect; leaving it out means no effect. */
export type ThemePreset = {
  id: string;
  name: string;
  group: "Signature" | "Minimal" | "Bold" | "Soft" | "Dark";
  values: Omit<ThemeShape, "presetId" | "hideBranding" | ThemeEffectKeys> & {
    buttonEffect?: string;
  };
};

const base = {
  bgImageUrl: null,
  bgPattern: "none",
  avatarShape: "circle",
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "moonlight",
    name: "Moonlight",
    group: "Signature",
    values: {
      buttonEffect: "glow-pulse",
      ...base,
      bgType: "gradient",
      bgColor: "#1b1032",
      bgColorTwo: "#3d1f6b",
      textColor: "#ffffff",
      mutedColor: "#c4b5fd",
      accentColor: "#8b5cf6",
      buttonStyle: "glass",
      buttonRadius: "full",
      buttonColor: "#ffffff",
      buttonTextColor: "#ffffff",
      fontFamily: "inter",
    },
  },
  {
    id: "sunbeam",
    name: "Sunbeam",
    group: "Signature",
    values: {
      ...base,
      bgType: "gradient",
      bgColor: "#ffd166",
      bgColorTwo: "#ff7a59",
      textColor: "#2d1500",
      mutedColor: "#7a4416",
      accentColor: "#ff5f1f",
      buttonStyle: "shadow",
      buttonRadius: "lg",
      buttonColor: "#ffffff",
      buttonTextColor: "#2d1500",
      fontFamily: "jakarta",
    },
  },
  {
    id: "bubblegum",
    name: "Bubblegum",
    group: "Signature",
    values: {
      buttonEffect: "breathe",
      ...base,
      bgType: "gradient",
      bgColor: "#ffe0f0",
      bgColorTwo: "#c9e4ff",
      textColor: "#2a1533",
      mutedColor: "#6c5479",
      accentColor: "#ff4fa3",
      buttonStyle: "shadow",
      buttonRadius: "full",
      buttonColor: "#ffffff",
      buttonTextColor: "#2a1533",
      fontFamily: "jakarta",
    },
  },
  {
    id: "matcha",
    name: "Matcha",
    group: "Soft",
    values: {
      ...base,
      bgType: "gradient",
      bgColor: "#e7f5d8",
      bgColorTwo: "#b9e3c6",
      textColor: "#12301c",
      mutedColor: "#3f6b4c",
      accentColor: "#2f855a",
      buttonStyle: "soft",
      buttonRadius: "lg",
      buttonColor: "#12301c",
      buttonTextColor: "#eefbe6",
      fontFamily: "inter",
    },
  },
  {
    id: "linen",
    name: "Linen",
    group: "Minimal",
    values: {
      ...base,
      bgType: "solid",
      bgColor: "#f6f2ec",
      bgColorTwo: "#f6f2ec",
      textColor: "#1c1a17",
      mutedColor: "#6b6459",
      accentColor: "#1c1a17",
      buttonStyle: "outline",
      buttonRadius: "sm",
      buttonColor: "#1c1a17",
      buttonTextColor: "#1c1a17",
      fontFamily: "serif",
    },
  },
  {
    id: "paper",
    name: "Paper",
    group: "Minimal",
    values: {
      ...base,
      bgType: "solid",
      bgColor: "#ffffff",
      bgColorTwo: "#ffffff",
      textColor: "#101010",
      mutedColor: "#6e6e6e",
      accentColor: "#101010",
      buttonStyle: "fill",
      buttonRadius: "md",
      buttonColor: "#101010",
      buttonTextColor: "#ffffff",
      fontFamily: "inter",
      avatarShape: "circle",
    },
  },
  {
    id: "noir",
    name: "Noir",
    group: "Dark",
    values: {
      ...base,
      bgType: "solid",
      bgColor: "#0b0b0d",
      bgColorTwo: "#0b0b0d",
      textColor: "#f7f7f8",
      mutedColor: "#8d8d96",
      accentColor: "#f7f7f8",
      buttonStyle: "outline",
      buttonRadius: "none",
      buttonColor: "#f7f7f8",
      buttonTextColor: "#f7f7f8",
      fontFamily: "mono",
      avatarShape: "square",
    },
  },
  {
    id: "midnight-neon",
    name: "Neon",
    group: "Dark",
    values: {
      buttonEffect: "neon",
      ...base,
      bgType: "gradient",
      bgColor: "#06060f",
      bgColorTwo: "#14213d",
      textColor: "#e9fbff",
      mutedColor: "#7fd7e8",
      accentColor: "#22d3ee",
      buttonStyle: "outline",
      buttonRadius: "md",
      buttonColor: "#22d3ee",
      buttonTextColor: "#22d3ee",
      fontFamily: "mono",
    },
  },
  {
    id: "citrus",
    name: "Citrus",
    group: "Bold",
    values: {
      buttonEffect: "lift",
      ...base,
      bgType: "solid",
      bgColor: "#c6ff4a",
      bgColorTwo: "#c6ff4a",
      textColor: "#10210a",
      mutedColor: "#3a5426",
      accentColor: "#10210a",
      buttonStyle: "fill",
      buttonRadius: "none",
      buttonColor: "#10210a",
      buttonTextColor: "#c6ff4a",
      fontFamily: "jakarta",
      avatarShape: "rounded",
    },
  },
  {
    id: "cobalt",
    name: "Cobalt",
    group: "Bold",
    values: {
      buttonEffect: "shimmer",
      ...base,
      bgType: "gradient",
      bgColor: "#2743ff",
      bgColorTwo: "#7c3aed",
      textColor: "#ffffff",
      mutedColor: "#d6dcff",
      accentColor: "#ffd166",
      buttonStyle: "fill",
      buttonRadius: "full",
      buttonColor: "#ffffff",
      buttonTextColor: "#2743ff",
      fontFamily: "jakarta",
    },
  },
  {
    id: "sandstone",
    name: "Sandstone",
    group: "Soft",
    values: {
      ...base,
      bgType: "gradient",
      bgColor: "#f8e3c9",
      bgColorTwo: "#e6b98f",
      textColor: "#3a220f",
      mutedColor: "#7d5738",
      accentColor: "#b45309",
      buttonStyle: "soft",
      buttonRadius: "full",
      buttonColor: "#3a220f",
      buttonTextColor: "#fdf3e7",
      fontFamily: "serif",
    },
  },
  {
    id: "arctic",
    name: "Arctic",
    group: "Minimal",
    values: {
      ...base,
      bgType: "gradient",
      bgColor: "#eef6ff",
      bgColorTwo: "#dbe9f7",
      textColor: "#0f2438",
      mutedColor: "#4d6a83",
      accentColor: "#0ea5e9",
      buttonStyle: "shadow",
      buttonRadius: "lg",
      buttonColor: "#ffffff",
      buttonTextColor: "#0f2438",
      fontFamily: "inter",
    },
  },
];

export const DEFAULT_THEME: ThemeShape = {
  presetId: "moonlight",
  hideBranding: false,
  ...THEME_PRESETS[0].values,
  // Last word, so a preset's signature effect never leaks into the fallback a
  // user gets before they have a Theme row. Mirrors the column defaults.
  ...NO_EFFECTS,
};

export const FONT_OPTIONS = [
  { id: "inter", name: "Inter", stack: "var(--font-inter), ui-sans-serif, system-ui, sans-serif" },
  { id: "jakarta", name: "Jakarta", stack: "var(--font-jakarta), ui-sans-serif, system-ui, sans-serif" },
  { id: "serif", name: "Serif", stack: "var(--font-fraunces), ui-serif, Georgia, serif" },
  { id: "mono", name: "Mono", stack: "var(--font-mono), ui-monospace, SFMono-Regular, monospace" },
];

export const BUTTON_STYLES = [
  { id: "fill", name: "Fill" },
  { id: "outline", name: "Outline" },
  { id: "soft", name: "Soft" },
  { id: "shadow", name: "Hard shadow" },
  { id: "glass", name: "Glass" },
];

export const BUTTON_RADII = [
  { id: "none", name: "Sharp", css: "0px" },
  { id: "sm", name: "Subtle", css: "6px" },
  { id: "md", name: "Rounded", css: "12px" },
  { id: "lg", name: "Soft", css: "18px" },
  { id: "full", name: "Pill", css: "999px" },
];

export const BG_PATTERNS = [
  { id: "none", name: "None" },
  { id: "dots", name: "Dots" },
  { id: "grid", name: "Grid" },
  { id: "waves", name: "Waves" },
  { id: "noise", name: "Grain" },
];

export function fontStack(id: string) {
  return FONT_OPTIONS.find((f) => f.id === id)?.stack ?? FONT_OPTIONS[0].stack;
}

export function radiusCss(id: string) {
  return BUTTON_RADII.find((r) => r.id === id)?.css ?? "999px";
}

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "").trim();
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const int = parseInt(full.slice(0, 6) || "000000", 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

export function rgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function isLight(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}

export function backgroundCss(theme: ThemeShape): React.CSSProperties {
  if (theme.bgType === "image" && theme.bgImageUrl) {
    return {
      backgroundImage: `linear-gradient(${rgba("#000000", 0.35)}, ${rgba("#000000", 0.55)}), url(${theme.bgImageUrl})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }
  if (theme.bgType === "gradient") {
    return { backgroundImage: `linear-gradient(160deg, ${theme.bgColor} 0%, ${theme.bgColorTwo} 100%)` };
  }
  return { backgroundColor: theme.bgColor };
}

export function patternCss(theme: ThemeShape): React.CSSProperties | undefined {
  const c = rgba(theme.textColor, 0.09);
  switch (theme.bgPattern) {
    case "dots":
      return { backgroundImage: `radial-gradient(${c} 1.4px, transparent 1.4px)`, backgroundSize: "18px 18px" };
    case "grid":
      return {
        backgroundImage: `linear-gradient(${c} 1px, transparent 1px), linear-gradient(90deg, ${c} 1px, transparent 1px)`,
        backgroundSize: "28px 28px",
      };
    case "waves":
      return {
        backgroundImage: `repeating-radial-gradient(circle at 0 0, transparent 0, ${c} 22px), repeating-linear-gradient(${rgba(theme.textColor, 0.04)}, ${rgba(theme.textColor, 0.02)})`,
      };
    case "noise":
      return {
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.35'/%3E%3C/svg%3E\")",
      };
    default:
      return undefined;
  }
}

export function buttonCss(theme: ThemeShape): React.CSSProperties {
  const radius = radiusCss(theme.buttonRadius);
  switch (theme.buttonStyle) {
    case "outline":
      return {
        borderRadius: radius,
        border: `2px solid ${theme.buttonColor}`,
        color: theme.buttonTextColor,
        background: "transparent",
      };
    case "soft":
      return {
        borderRadius: radius,
        border: "none",
        background: theme.buttonColor,
        color: theme.buttonTextColor,
        boxShadow: `0 10px 30px -12px ${rgba(theme.buttonColor, 0.75)}`,
      };
    case "shadow":
      return {
        borderRadius: radius,
        border: `2px solid ${theme.textColor}`,
        background: theme.buttonColor,
        color: theme.buttonTextColor,
        boxShadow: `4px 4px 0 0 ${theme.textColor}`,
      };
    case "glass":
      return {
        borderRadius: radius,
        border: `1px solid ${rgba(theme.buttonColor, 0.35)}`,
        background: rgba(theme.buttonColor, 0.12),
        color: theme.buttonTextColor,
        backdropFilter: "blur(12px)",
      };
    default:
      return {
        borderRadius: radius,
        border: "none",
        background: theme.buttonColor,
        color: theme.buttonTextColor,
      };
  }
}

/**
 * The variable contract consumed by @plink/effects.
 *
 * Effects are static CSS that must work for any creator, so the palette reaches
 * them as custom properties rather than being compiled per user. Alpha variants
 * are precomputed here instead of with color-mix() so the stylesheet needs no
 * colour maths and no recent-browser fallback.
 */
export function buttonEffectVars(theme: ThemeShape): React.CSSProperties {
  // Outline and glass buttons are see-through, so their effective content
  // colour is the one that actually reads against the page behind them.
  const foreground = theme.buttonTextColor;
  return {
    "--pl-bg": theme.buttonColor,
    "--pl-fg": foreground,
    "--pl-accent": theme.accentColor,
    "--pl-fg-12": rgba(foreground, 0.12),
    "--pl-fg-25": rgba(foreground, 0.25),
    "--pl-fg-45": rgba(foreground, 0.45),
    "--pl-accent-30": rgba(theme.accentColor, 0.3),
    "--pl-accent-60": rgba(theme.accentColor, 0.6),
  } as React.CSSProperties;
}

/**
 * The same variable contract, for effects that paint across the page rather
 * than on a button — the background and text targets.
 *
 * Provenance is the whole point. `buttonEffectVars` reads the button palette,
 * which is right for a shimmer on a link and wrong for a grid behind the page:
 * on the `citrus` preset `buttonTextColor` is the very same lime as `bgColor`,
 * so a background effect drawn from it would be invisible. Page-level effects
 * read the colours they actually sit against.
 */
export function pageEffectVars(theme: ThemeShape): React.CSSProperties {
  return {
    "--pl-bg": theme.bgColor,
    "--pl-fg": theme.textColor,
    "--pl-accent": theme.accentColor,
    "--pl-fg-12": rgba(theme.textColor, 0.12),
    "--pl-fg-25": rgba(theme.textColor, 0.25),
    "--pl-fg-45": rgba(theme.textColor, 0.45),
    "--pl-accent-30": rgba(theme.accentColor, 0.3),
    "--pl-accent-60": rgba(theme.accentColor, 0.6),
  } as React.CSSProperties;
}

export function avatarRadius(shape: string) {
  if (shape === "square") return "0px";
  if (shape === "rounded") return "22px";
  return "999px";
}

/**
 * A preset expanded into a full theme. The effect defaults come first so a
 * preset's signature `buttonEffect` still wins, while the three targets no
 * preset names — background, text, entrance — always land on "none".
 */
export function presetToTheme(preset: ThemePreset, hideBranding = false): ThemeShape {
  return {
    presetId: preset.id,
    hideBranding,
    ...NO_EFFECTS,
    ...preset.values,
  };
}
