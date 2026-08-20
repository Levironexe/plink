/**
 * AI page builder — schemas, model routing and the sanitisation boundary.
 *
 * Nothing in this module talks to a provider and nothing is constructed at
 * import time. Models are referenced as plain `"provider/model"` strings and
 * resolved by the Vercel AI Gateway (`AI_GATEWAY_API_KEY`) inside the route
 * handlers, so importing this file is always safe — including during
 * `next build`, when the key is typically absent.
 *
 * Everything a model returns is untrusted. `sanitizeGeneratedPage` is the one
 * place that decides what is allowed to reach the database or the DOM.
 */

import { z } from "zod";
import { BLOCK_LIBRARY, blockDefinition, type BlockType } from "@plink/core/blocks";
import {
  BG_PATTERNS,
  BUTTON_RADII,
  BUTTON_STYLES,
  FONT_OPTIONS,
  THEME_PRESETS,
  presetToTheme,
  type ThemeShape,
} from "@plink/core/themes";

/* ─────────────────────────────────────────────────────────────
   Gateway configuration
   ───────────────────────────────────────────────────────────── */

/** Page generation — the expensive, structure-heavy call. */
export const DEFAULT_MODEL = "anthropic/claude-sonnet-5";

/** Copy rewriting — short, cheap, latency-sensitive. */
export const FAST_MODEL = "anthropic/claude-haiku-4.5";

export type AiTask = "page" | "copy";

/**
 * Whether the gateway is configured. Read lazily on every call so a key added
 * to `.env.local` takes effect on the next request rather than a rebuild.
 * Never logs or returns the value itself.
 */
export function aiEnabled(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY?.trim());
}

/** Picks the cheapest model that can do the job. */
export function modelFor(task: AiTask): string {
  return task === "copy" ? FAST_MODEL : DEFAULT_MODEL;
}

/* ─────────────────────────────────────────────────────────────
   Limits — shared by the schema (what we ask for) and the
   sanitiser (what we accept). The sanitiser is authoritative.
   ───────────────────────────────────────────────────────────── */

export const AI_LIMITS = {
  /** Hard ceiling on generated blocks. A page longer than this is spam. */
  maxBlocks: 12,
  displayName: 60,
  bio: 300,
  category: 60,
  title: 120,
  subtitle: 240,
  url: 500,
  /** Longest string allowed anywhere inside a block `config`. */
  configString: 500,
  configKeys: 20,
  configItems: 12,
  configDepth: 3,
  /** Longest natural-language prompt we accept from a creator. */
  prompt: 1200,
  maxTitles: 12,
} as const;

/* ─────────────────────────────────────────────────────────────
   The contract — zod schemas handed to the model
   ───────────────────────────────────────────────────────────── */

/** Derived from the real libraries so the two can never drift apart. */
const BLOCK_TYPE_IDS = BLOCK_LIBRARY.map((b) => b.type);
const PRESET_IDS = THEME_PRESETS.map((p) => p.id);
const BUTTON_STYLE_IDS = BUTTON_STYLES.map((s) => s.id);
const BUTTON_RADIUS_IDS = BUTTON_RADII.map((r) => r.id);
const BG_PATTERN_IDS = BG_PATTERNS.map((p) => p.id);
const FONT_IDS = FONT_OPTIONS.map((f) => f.id);
const BG_TYPES = ["solid", "gradient"];
const AVATAR_SHAPES = ["circle", "rounded", "square"];

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const HTTP_URL = /^https?:\/\//i;
const URL_LIKE_KEY = /(^|[a-z])(url|href|src|link)$/i;
/** Control characters that can smuggle content past a naive renderer. */
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

const hexColor = z.string().regex(HEX_COLOR, "Use a #rrggbb hex colour");

export const generatedProfileSchema = z.object({
  displayName: z.string().min(1).max(AI_LIMITS.displayName),
  bio: z.string().max(AI_LIMITS.bio),
  category: z.string().max(AI_LIMITS.category),
});

export const generatedThemeSchema = z.object({
  /** Must name a real preset from `src/lib/themes.ts`. */
  presetId: z.enum(PRESET_IDS),
  bgType: z.enum(BG_TYPES).optional(),
  bgPattern: z.enum(BG_PATTERN_IDS).optional(),
  avatarShape: z.enum(AVATAR_SHAPES).optional(),
  /** Optional overrides on top of the preset. Hex only — no CSS expressions. */
  bgColor: hexColor.optional(),
  bgColorTwo: hexColor.optional(),
  textColor: hexColor.optional(),
  mutedColor: hexColor.optional(),
  accentColor: hexColor.optional(),
  buttonColor: hexColor.optional(),
  buttonTextColor: hexColor.optional(),
  buttonStyle: z.enum(BUTTON_STYLE_IDS),
  buttonRadius: z.enum(BUTTON_RADIUS_IDS),
  fontFamily: z.enum(FONT_IDS),
});

/**
 * The union of every `config` field the block library actually reads. Kept
 * explicit rather than a free-form record so the JSON schema stays small and
 * the model cannot invent structure the renderer will ignore.
 */
export const generatedBlockConfigSchema = z.object({
  buttonLabel: z.string().max(40).optional(),
  placeholder: z.string().max(60).optional(),
  currency: z.string().max(3).optional(),
  amounts: z.array(z.number().int().min(1).max(1000)).max(4).optional(),
  items: z
    .array(
      z.object({
        q: z.string().max(160).optional(),
        a: z.string().max(400).optional(),
        label: z.string().max(80).optional(),
        url: z.string().max(AI_LIMITS.url).optional(),
        imageUrl: z.string().max(AI_LIMITS.url).optional(),
      }),
    )
    .max(8)
    .optional(),
});

export const generatedBlockSchema = z.object({
  /** Constrained to the real `BlockType` union. */
  type: z.enum(BLOCK_TYPE_IDS),
  title: z.string().max(AI_LIMITS.title),
  subtitle: z.string().max(AI_LIMITS.subtitle),
  url: z.string().max(AI_LIMITS.url),
  config: generatedBlockConfigSchema.optional(),
});

export const generatedPageSchema = z.object({
  profile: generatedProfileSchema,
  theme: generatedThemeSchema,
  blocks: z.array(generatedBlockSchema).min(1).max(AI_LIMITS.maxBlocks),
});

export const generatedCopySchema = z.object({
  bio: z.string().max(AI_LIMITS.bio),
  titles: z.array(z.string().max(AI_LIMITS.title)).max(AI_LIMITS.maxTitles),
});

/* ─────────────────────────────────────────────────────────────
   Public types — what the client and `onApply` actually receive
   ───────────────────────────────────────────────────────────── */

export type GeneratedProfile = {
  displayName: string;
  bio: string;
  category: string;
};

export type GeneratedBlock = {
  /** Sequential, 0-based. Assigned by the sanitiser, never by the model. */
  position: number;
  type: BlockType;
  title: string;
  subtitle: string;
  url: string;
  config: Record<string, unknown>;
};

export type GeneratedPage = {
  profile: GeneratedProfile;
  /** A complete, renderable theme — the preset resolved plus safe overrides. */
  theme: ThemeShape;
  blocks: GeneratedBlock[];
};

export type GeneratedCopy = {
  bio: string;
  titles: string[];
};

/* ─────────────────────────────────────────────────────────────
   Sanitisation — the safety boundary. Pure, no I/O, no throwing.
   ───────────────────────────────────────────────────────────── */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Trims a model string to a sane length and strips control characters.
 * Anything that is not a string collapses to "".
 */
export function clampText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const cleaned = value.replace(CONTROL_CHARS, "").trim();
  return cleaned.length > max ? cleaned.slice(0, max).trim() : cleaned;
}

/**
 * Accepts http(s) URLs only. `javascript:`, `data:`, protocol-relative and
 * relative values are stripped to "" rather than repaired — a model has no
 * business inventing a scheme we did not ask for.
 */
export function safeHttpUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.replace(CONTROL_CHARS, "").trim();
  if (!trimmed || trimmed.length > AI_LIMITS.url) return "";
  if (!HTTP_URL.test(trimmed)) return "";
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
  } catch {
    return "";
  }
  // Return the original string, not `URL.toString()`, so a well-formed value
  // survives byte-for-byte.
  return trimmed;
}

function sanitizeConfigValue(value: unknown, key: string, depth: number): unknown {
  if (value === null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    return URL_LIKE_KEY.test(key) ? safeHttpUrl(value) : clampText(value, AI_LIMITS.configString);
  }
  if (Array.isArray(value)) {
    if (depth >= AI_LIMITS.configDepth) return [];
    return value
      .slice(0, AI_LIMITS.configItems)
      .map((item) => sanitizeConfigValue(item, key, depth + 1));
  }
  if (isPlainObject(value)) {
    if (depth >= AI_LIMITS.configDepth) return {};
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value).slice(0, AI_LIMITS.configKeys)) {
      if (v === undefined) continue;
      if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
      out[k] = sanitizeConfigValue(v, k, depth + 1);
    }
    return out;
  }
  // Functions, symbols, undefined — nothing a JSON payload should contain.
  return null;
}

/** Narrows a model `config` down to plain JSON with safe URLs and sane sizes. */
export function sanitizeBlockConfig(raw: unknown): Record<string, unknown> {
  if (!isPlainObject(raw)) return {};
  return sanitizeConfigValue(raw, "config", 0) as Record<string, unknown>;
}

export function sanitizeGeneratedProfile(raw: unknown): GeneratedProfile {
  const input = isPlainObject(raw) ? raw : {};
  return {
    displayName: clampText(input.displayName, AI_LIMITS.displayName),
    bio: clampText(input.bio, AI_LIMITS.bio),
    category: clampText(input.category, AI_LIMITS.category),
  };
}

function pickFrom(value: unknown, allowed: string[], fallback: string): string {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}

function pickHex(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return HEX_COLOR.test(trimmed) ? trimmed.toLowerCase() : fallback;
}

/**
 * Resolves a model theme against a real preset. Any field the model got wrong
 * falls back to the preset value, so the result is always renderable.
 * Background images and branding flags are never model-controlled.
 */
export function sanitizeGeneratedTheme(raw: unknown): ThemeShape {
  const input = isPlainObject(raw) ? raw : {};
  const preset =
    THEME_PRESETS.find((p) => p.id === input.presetId) ?? THEME_PRESETS[0];
  const base = presetToTheme(preset);

  return {
    ...base,
    bgType: pickFrom(input.bgType, BG_TYPES, base.bgType),
    bgPattern: pickFrom(input.bgPattern, BG_PATTERN_IDS, base.bgPattern),
    avatarShape: pickFrom(input.avatarShape, AVATAR_SHAPES, base.avatarShape),
    bgColor: pickHex(input.bgColor, base.bgColor),
    bgColorTwo: pickHex(input.bgColorTwo, base.bgColorTwo),
    textColor: pickHex(input.textColor, base.textColor),
    mutedColor: pickHex(input.mutedColor, base.mutedColor),
    accentColor: pickHex(input.accentColor, base.accentColor),
    buttonColor: pickHex(input.buttonColor, base.buttonColor),
    buttonTextColor: pickHex(input.buttonTextColor, base.buttonTextColor),
    buttonStyle: pickFrom(input.buttonStyle, BUTTON_STYLE_IDS, base.buttonStyle),
    buttonRadius: pickFrom(input.buttonRadius, BUTTON_RADIUS_IDS, base.buttonRadius),
    fontFamily: pickFrom(input.fontFamily, FONT_IDS, base.fontFamily),
    bgImageUrl: null,
    hideBranding: false,
  };
}

/**
 * Keeps the first `AI_LIMITS.maxBlocks` blocks whose type exists in the block
 * library, strips unsafe URLs and resequences positions from 0.
 */
export function sanitizeGeneratedBlocks(raw: unknown): GeneratedBlock[] {
  if (!Array.isArray(raw)) return [];

  const blocks: GeneratedBlock[] = [];
  for (const item of raw) {
    if (blocks.length >= AI_LIMITS.maxBlocks) break;
    if (!isPlainObject(item)) continue;

    const type = typeof item.type === "string" ? item.type.trim().toLowerCase() : "";
    // The block library is the only source of truth for what renders.
    if (!blockDefinition(type)) continue;

    blocks.push({
      position: blocks.length,
      type: type as BlockType,
      title: clampText(item.title, AI_LIMITS.title),
      subtitle: clampText(item.subtitle, AI_LIMITS.subtitle),
      url: safeHttpUrl(item.url),
      config: sanitizeBlockConfig(item.config),
    });
  }
  return blocks;
}

/**
 * The safety boundary between a language model and the creator's page.
 * Pure: same input, same output, no I/O, never throws. Anything unrecognised
 * is dropped rather than guessed at.
 */
export function sanitizeGeneratedPage(raw: unknown): GeneratedPage {
  const input = isPlainObject(raw) ? raw : {};
  return {
    profile: sanitizeGeneratedProfile(input.profile),
    theme: sanitizeGeneratedTheme(input.theme),
    blocks: sanitizeGeneratedBlocks(input.blocks),
  };
}

/** The smaller boundary used by the "improve my copy" endpoint. */
export function sanitizeGeneratedCopy(raw: unknown): GeneratedCopy {
  const input = isPlainObject(raw) ? raw : {};
  const titles = Array.isArray(input.titles) ? input.titles : [];
  return {
    bio: clampText(input.bio, AI_LIMITS.bio),
    titles: titles
      .slice(0, AI_LIMITS.maxTitles)
      .map((t) => clampText(t, AI_LIMITS.title))
      .filter((t) => t.length > 0),
  };
}

/* ─────────────────────────────────────────────────────────────
   Prompts — built from the real catalogues so the model is told
   about exactly the blocks and themes that exist today.
   ───────────────────────────────────────────────────────────── */

function blockCatalogue(): string {
  return BLOCK_LIBRARY.map((b) => `- ${b.type}: ${b.description}`).join("\n");
}

function themeCatalogue(): string {
  return THEME_PRESETS.map((p) => `- ${p.id} (${p.group}): ${p.name}`).join("\n");
}

/** System prompt for the full page builder. */
export function pageSystemPrompt(): string {
  return [
    "You design link-in-bio pages for Plink. Given a short description of a creator,",
    "return one complete page: a profile, a theme and an ordered list of blocks.",
    "",
    "Block types you may use (nothing else):",
    blockCatalogue(),
    "",
    "Theme presets you may reference by id (nothing else):",
    themeCatalogue(),
    "",
    "Rules:",
    `- Return between 4 and ${AI_LIMITS.maxBlocks} blocks, ordered the way a visitor should read them.`,
    "- Lead with the creator's single most important destination.",
    "- Only set `url` on blocks that genuinely need one (link, video, music, calendar).",
    "  Every url must start with http:// or https://. If you do not know the real",
    "  destination, return an empty string rather than inventing a domain.",
    "- Use `header` blocks to group a long page, and at most one `socials` block.",
    "- Titles are short and human — 2 to 5 words, sentence case, no emoji spam.",
    "- The bio is one or two sentences in the creator's own voice, never marketing filler.",
    "- Pick a preset that matches the creator's craft, then override colours only when",
    "  the description clearly calls for it. Colours must be #rrggbb hex.",
  ].join("\n");
}

/** System prompt for the smaller bio / titles rewrite. */
export function copySystemPrompt(): string {
  return [
    "You are a copy editor for Plink link-in-bio pages.",
    "Rewrite the creator's bio and their block titles so they sound like a person,",
    "not a brochure.",
    "",
    "Rules:",
    `- The bio is at most ${AI_LIMITS.bio} characters, one or two sentences, first person.`,
    "- Keep every title under 5 words and return them in the same order you received them.",
    "- Preserve meaning and any proper nouns. Never invent facts, prices, dates or URLs.",
    "- No emoji, no exclamation marks, no all-caps.",
  ].join("\n");
}
