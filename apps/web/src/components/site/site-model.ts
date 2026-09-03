/**
 * The pure brain of the site renderer — no React, no Next, no database.
 *
 * Everything a template needs that can be computed from the document alone
 * lives here so it can be unit-tested in a bare node environment: which page
 * a URL resolves to, the nav model, the theme → CSS custom property mapping,
 * effect-class composition, and the template fallback rule.
 */

import type * as React from "react";
import {
  EFFECT_TARGETS,
  SITE_TEMPLATES,
  type EffectAssignment,
  type SiteDocument,
  type SitePage,
  type SiteSection,
  type SiteTemplateId,
  type SiteTheme,
} from "@plink/core/site-schema";
import { radiusCss, rgba } from "@plink/core/themes";
import { effectClass } from "@plink/effects/registry";

/** Preview renders identically but never records analytics or navigates. */
export type SiteRenderMode = "live" | "preview";

/* ------------------------------------------------------------ templates */

/**
 * The registry's lookup rule: a stale or hand-edited document naming a
 * template we do not ship renders as editorial rather than crashing.
 */
export function normalizeTemplateId(id: string | null | undefined): SiteTemplateId {
  return (SITE_TEMPLATES as readonly string[]).includes(id ?? "")
    ? (id as SiteTemplateId)
    : "editorial";
}

/* ----------------------------------------------------------------- paths */

/** `["shop","fall"]` → `/shop/fall`; `[]` → `/`. Segments are decoded. */
export function pathFromSegments(segments: readonly string[]): string {
  const cleaned = segments
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    })
    .filter(Boolean);
  return `/${cleaned.join("/")}`;
}

/**
 * Resolve a URL (as catch-all segments) to a page of the document, or null —
 * the routes turn null into `notFound()`. Trailing slashes are forgiven on
 * both sides so `/shop/` in a document still matches `/shop`.
 */
export function resolveSitePage(
  document: SiteDocument,
  segments: readonly string[],
): SitePage | null {
  const wanted = normalizePath(pathFromSegments(segments));
  return document.pages.find((page) => normalizePath(page.path) === wanted) ?? null;
}

function normalizePath(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

/* ------------------------------------------------------------------- nav */

export type SiteNavItem = {
  id: string;
  title: string;
  path: string;
  /** basePath-prefixed href for live <Link> navigation. */
  href: string;
  current: boolean;
};

/**
 * One item per page, in document order — every page is reachable from the
 * nav. `basePath` is the mount point (`/s/<slug>`); the root page maps to the
 * bare basePath so `/s/foo` is canonical rather than `/s/foo/`.
 */
export function buildSiteNav(
  document: SiteDocument,
  basePath: string,
  currentPath: string,
): SiteNavItem[] {
  const base = basePath.replace(/\/+$/, "");
  const current = normalizePath(currentPath);
  return document.pages.map((page) => {
    const path = normalizePath(page.path);
    return {
      id: page.id,
      title: page.title,
      path,
      href: path === "/" ? base || "/" : `${base}${path}`,
      current: path === current,
    };
  });
}

/**
 * The one contract every template implements: same document in, structurally
 * distinct layout out. `page` is already resolved and `nav` already built so a
 * template contains zero routing logic.
 */
export type SiteTemplateProps = {
  document: SiteDocument;
  page: SitePage;
  nav: SiteNavItem[];
  mode: SiteRenderMode;
};

/* ----------------------------------------------------------------- theme */

/**
 * Site fonts resolve to variables this app actually defines (the root layout
 * loads Google Sans and Geist Mono). The profile `fontStack` helper points at
 * `--font-inter`-style vars that exist only on profile themes, so the site
 * renderer keeps its own small map. Unknown ids read as sans.
 */
const SITE_FONT_STACKS: Record<string, string> = {
  sans: "var(--font-google-sans), ui-sans-serif, system-ui, sans-serif",
  serif: "ui-serif, Georgia, 'Times New Roman', serif",
  mono: "var(--font-geist-mono), ui-monospace, 'SFMono-Regular', Menlo, monospace",
};

export function siteFontStack(id: string): string {
  return SITE_FONT_STACKS[id] ?? SITE_FONT_STACKS.sans;
}

/**
 * The document theme as CSS custom properties, set once on the site root.
 *
 * Two vocabularies ride together:
 * - the effects contract (`--pl-bg`, `--pl-fg`, `--pl-accent` + alpha steps),
 *   mirroring core's `buttonEffectVars` so any `pl-fx` surface in the tree
 *   finds its palette without per-element wiring;
 * - `--pl-site-*` tokens the templates style against, so template CSS never
 *   hardcodes a colour (constitution Art. IV).
 */
export function siteThemeVars(theme: SiteTheme): React.CSSProperties {
  return {
    // Effects contract — identical shape to buttonEffectVars(theme).
    "--pl-bg": theme.buttonColor,
    "--pl-fg": theme.buttonTextColor,
    "--pl-accent": theme.accentColor,
    "--pl-fg-12": rgba(theme.buttonTextColor, 0.12),
    "--pl-fg-25": rgba(theme.buttonTextColor, 0.25),
    "--pl-fg-45": rgba(theme.buttonTextColor, 0.45),
    "--pl-accent-30": rgba(theme.accentColor, 0.3),
    "--pl-accent-60": rgba(theme.accentColor, 0.6),
    // Template tokens.
    "--pl-site-bg": theme.bgColor,
    "--pl-site-fg": theme.textColor,
    "--pl-site-muted": theme.mutedColor,
    "--pl-site-accent": theme.accentColor,
    "--pl-site-accent-10": rgba(theme.accentColor, 0.1),
    "--pl-site-fg-08": rgba(theme.textColor, 0.08),
    "--pl-site-fg-14": rgba(theme.textColor, 0.14),
    "--pl-radius": radiusCss(theme.buttonRadius),
    "--pl-font": siteFontStack(theme.fontFamily),
  } as React.CSSProperties;
}

/**
 * Button/card chrome for the five button styles, keyed off the narrower
 * SiteTheme (core's `buttonCss` wants the full profile ThemeShape, which is
 * frozen for this branch). `solid` is SiteTheme's default and renders as fill.
 */
export function siteButtonCss(theme: SiteTheme): React.CSSProperties {
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
    default: // "solid", "fill", anything unknown
      return {
        borderRadius: radius,
        border: "none",
        background: theme.buttonColor,
        color: theme.buttonTextColor,
      };
  }
}

/* --------------------------------------------------------------- effects */

/**
 * An EffectAssignment as a class string: `effectClass` per target (the
 * registry is the only authority — ids for targets that ship in
 * feat/effects-anywhere resolve to "" today and light up after its merge),
 * non-empty results joined behind the `pl-fx` base class. Nothing assigned —
 * or nothing known — yields "" so resting markup carries no effect scaffolding.
 */
export function fx(assignment?: EffectAssignment): string {
  if (!assignment) return "";
  const classes = EFFECT_TARGETS.map((target) => effectClass(assignment[target])).filter(Boolean);
  return classes.length === 0 ? "" : ["pl-fx", ...classes].join(" ");
}

/* -------------------------------------------------------------- metadata */

/**
 * A description for `generateMetadata`: the hero header's subtitle is the
 * document's own one-liner (the seed writes the business tagline there).
 */
export function siteDescription(document: SiteDocument): string {
  for (const page of document.pages) {
    for (const section of page.sections) {
      if (section.kind !== "hero") continue;
      for (const block of section.blocks) {
        if (block.subtitle) return block.subtitle;
      }
    }
  }
  return "";
}

/**
 * The brand a template puts in its masthead / top bar / sidebar. The document
 * has no name field of its own — the generator writes the business name into
 * the root page's hero header — so that block is the source of truth, with the
 * root page title as the fallback for hand-rolled documents.
 */
export function siteName(document: SiteDocument): string {
  const root = document.pages[0];
  for (const section of root.sections) {
    if (section.kind !== "hero") continue;
    for (const block of section.blocks) {
      if (block.type === "header" && block.title) return block.title;
    }
  }
  return root.title;
}

/* -------------------------------------------------------------- sections */

/**
 * Templates give the first hero section a bespoke treatment (masthead display
 * type, banner panel, oversized headline) and render everything else through
 * their regular section rhythm — this is that split.
 */
export function splitHero(page: SitePage): { hero: SiteSection | null; rest: SiteSection[] } {
  const hero = page.sections.find((section) => section.kind === "hero") ?? null;
  return { hero, rest: page.sections.filter((section) => section !== hero) };
}
