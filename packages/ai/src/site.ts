/**
 * AI Website Generator — brief → SiteDocument proposal.
 *
 * Same two rules as `index.ts`: nothing talks to a provider at import time, and
 * nothing a model returns is trusted. The difference is scale — a page is one
 * profile and a list of blocks; a site is pages of sections of blocks, each
 * carrying effect ids and a theme, so the sanitiser here is a tree walk rather
 * than three field reads.
 *
 * Two schemas describe the same data on purpose:
 * - `siteProposalSchema` is what we *ask* the model for. It exists to shape the
 *   JSON schema the gateway sends, so it stays small and forgiving.
 * - `sanitizeSiteDocument` is what we *accept*. It is the only authority, it
 *   re-checks everything the proposal schema permitted, and it also handles
 *   input the proposal schema never described (a stale row, a hand-written
 *   document, a tampered server-action payload).
 */

import { generateText, Output } from "ai";
import { z } from "zod";
import { BLOCK_LIBRARY, blockDefinition } from "@plink/core/blocks";
import { BUTTON_RADII } from "@plink/core/themes";
import {
  EFFECT_TARGETS,
  PAGE_KINDS,
  SECTION_KINDS,
  SITE_TEMPLATES,
  newId,
  siteDocumentSchema,
  type BriefData,
  type EffectAssignment,
  type EffectTarget,
  type SiteBlock,
  type SiteDocument,
  type SitePage,
  type SiteSection,
  type SiteTheme,
} from "@plink/core/site-schema";
import { EFFECTS, EFFECT_NONE } from "@plink/effects/registry";
import { AI_LIMITS, clampText, modelFor, safeHttpUrl, sanitizeBlockConfig } from "./index";

export type GenerateSiteInput = {
  brief: BriefData;
  /** Template the operator picked; the generator may not override it. */
  template: SiteDocument["template"];
};

/** Hex fallbacks for a theme the model got wrong — the brief's brand colours. */
export type SiteBrandColors = BriefData["brandColors"];

/* ─────────────────────────────────────────────────────────────
   Limits — a generated site's budget, always tighter than the
   schema's ceiling. The schema stops malicious documents; these
   stop a model that starts enumerating.
   ───────────────────────────────────────────────────────────── */

export const SITE_AI_LIMITS = {
  /** Schema allows 20. A brief names at most three page kinds. */
  maxPages: 6,
  /** Schema allows 24. */
  maxSectionsPerPage: 10,
  /** Schema allows 40. */
  maxBlocksPerSection: 14,
  pageTitle: 120,
  path: 120,
  sectionTitle: 200,
  blockTitle: 200,
  blockSubtitle: 300,
  imageUrl: 600,
} as const;

/* ─────────────────────────────────────────────────────────────
   Vocabularies — derived from the real catalogues wherever one
   exists, so the prompt, the schema and the sanitiser cannot
   drift apart.
   ───────────────────────────────────────────────────────────── */

const BLOCK_TYPE_IDS = BLOCK_LIBRARY.map((b) => b.type);
const BUTTON_RADIUS_IDS = BUTTON_RADII.map((r) => r.id);

/**
 * `siteButtonCss` in the renderer switches on these; anything it does not know
 * falls through to the solid fill, which is also the schema's default.
 */
const SITE_BUTTON_STYLES = ["solid", "fill", "outline", "soft", "shadow", "glass"];

/** `siteFontStack` maps exactly these three; everything else reads as sans. */
const SITE_FONT_IDS = ["sans", "serif", "mono"];

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
/** The schema's page-path shape, enforced here before it can fail a parse. */
const SAFE_PATH = /^\/[a-z0-9\-/]*$/;

const THEME_FALLBACKS = {
  bgColor: "#ffffff",
  textColor: "#171717",
  mutedColor: "#888888",
  accentColor: "#6d28d9",
  buttonColor: "#171717",
  buttonTextColor: "#ffffff",
  buttonStyle: "solid",
  buttonRadius: "md",
  fontFamily: "sans",
} as const;

/** A page kind always yields a usable title and path, however bad the input. */
const PAGE_DEFAULTS: Record<(typeof PAGE_KINDS)[number], { title: string; path: string }> = {
  bio: { title: "Home", path: "/" },
  shop: { title: "Shop", path: "/shop" },
  blog: { title: "Journal", path: "/blog" },
  custom: { title: "Page", path: "/page" },
};

/* ─────────────────────────────────────────────────────────────
   The contract handed to the model
   ───────────────────────────────────────────────────────────── */

const proposalEffectsSchema = z
  .object({
    surface: z.string().max(40).optional(),
    text: z.string().max(40).optional(),
    background: z.string().max(40).optional(),
    entrance: z.string().max(40).optional(),
  })
  .optional();

/**
 * The union of block `config` fields the site renderer actually reads, plus the
 * `items` shapes the block library documents. Kept explicit so the JSON schema
 * stays small; `sanitizeBlockConfig` is what makes it safe.
 */
const proposalBlockConfigSchema = z.object({
  buttonLabel: z.string().max(40).optional(),
  items: z
    .array(
      z.object({
        platform: z.string().max(30).optional(),
        label: z.string().max(80).optional(),
        url: z.string().max(AI_LIMITS.url).optional(),
        imageUrl: z.string().max(AI_LIMITS.url).optional(),
        q: z.string().max(160).optional(),
        a: z.string().max(400).optional(),
      }),
    )
    .max(10)
    .optional(),
});

const proposalBlockSchema = z.object({
  /** Constrained to the real block library. */
  type: z.enum(BLOCK_TYPE_IDS),
  title: z.string().max(SITE_AI_LIMITS.blockTitle),
  subtitle: z.string().max(SITE_AI_LIMITS.blockSubtitle).optional(),
  url: z.string().max(AI_LIMITS.url).optional(),
  imageUrl: z.string().max(AI_LIMITS.url).optional(),
  config: proposalBlockConfigSchema.optional(),
  effects: proposalEffectsSchema,
});

const proposalSectionSchema = z.object({
  kind: z.enum(SECTION_KINDS),
  title: z.string().max(SITE_AI_LIMITS.sectionTitle).optional(),
  blocks: z.array(proposalBlockSchema).max(SITE_AI_LIMITS.maxBlocksPerSection),
  effects: proposalEffectsSchema,
});

const proposalPageSchema = z.object({
  kind: z.enum(PAGE_KINDS),
  title: z.string().max(SITE_AI_LIMITS.pageTitle),
  /** Lowercase, slash-rooted. The sanitiser repairs anything else. */
  path: z.string().max(SITE_AI_LIMITS.path),
  sections: z.array(proposalSectionSchema).max(SITE_AI_LIMITS.maxSectionsPerPage),
  effects: proposalEffectsSchema,
});

const proposalThemeSchema = z.object({
  bgColor: z.string().max(30).optional(),
  textColor: z.string().max(30).optional(),
  mutedColor: z.string().max(30).optional(),
  accentColor: z.string().max(30).optional(),
  buttonColor: z.string().max(30).optional(),
  buttonTextColor: z.string().max(30).optional(),
  buttonStyle: z.enum(SITE_BUTTON_STYLES).optional(),
  buttonRadius: z.enum(BUTTON_RADIUS_IDS).optional(),
  fontFamily: z.enum(SITE_FONT_IDS).optional(),
});

/**
 * The whole proposal. `template` is deliberately absent — the operator picked
 * it when the site was created and the model does not get a vote.
 */
export const siteProposalSchema = z.object({
  theme: proposalThemeSchema,
  effects: proposalEffectsSchema,
  pages: z.array(proposalPageSchema).min(1).max(SITE_AI_LIMITS.maxPages),
});

/* ─────────────────────────────────────────────────────────────
   Sanitisation — the safety boundary. Pure, no I/O, no throwing.
   ───────────────────────────────────────────────────────────── */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickFrom(value: unknown, allowed: readonly string[], fallback: string): string {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}

function pickHex(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return HEX_COLOR.test(trimmed) ? trimmed.toLowerCase() : fallback;
}

/** Registry entries keyed by id — the only authority on what an effect is. */
const EFFECTS_BY_ID = new Map(EFFECTS.map((effect) => [effect.id, effect]));

/**
 * Keeps an effect id only when the registry knows it *and* the entry is filed
 * under the target it was assigned to — exactly the test `applyEffects` runs at
 * render time, applied early so a document never carries a decoration that
 * silently does nothing. `none` is a picker affordance, not an assignment.
 */
export function sanitizeEffectAssignment(raw: unknown): EffectAssignment {
  if (!isPlainObject(raw)) return {};

  const out: EffectAssignment = {};
  for (const target of EFFECT_TARGETS) {
    const id = raw[target];
    if (typeof id !== "string") continue;
    const trimmed = id.trim();
    if (!trimmed || trimmed === EFFECT_NONE) continue;
    const effect = EFFECTS_BY_ID.get(trimmed);
    if (!effect || effect.target !== target) continue;
    out[target as EffectTarget] = trimmed;
  }
  return out;
}

/**
 * A complete, renderable theme. Colours the model got wrong fall back to the
 * brief's brand colours where one is meaningful (accent, and the primary that
 * carries text and button fills) and to the schema's own defaults otherwise —
 * so a proposal always renders, and always renders on-brand.
 */
export function sanitizeSiteTheme(raw: unknown, brandColors?: SiteBrandColors): SiteTheme {
  const input = isPlainObject(raw) ? raw : {};
  const primary = pickHex(brandColors?.primary, THEME_FALLBACKS.textColor);
  const accent = pickHex(brandColors?.accent, THEME_FALLBACKS.accentColor);

  return {
    bgColor: pickHex(input.bgColor, THEME_FALLBACKS.bgColor),
    textColor: pickHex(input.textColor, primary),
    mutedColor: pickHex(input.mutedColor, THEME_FALLBACKS.mutedColor),
    accentColor: pickHex(input.accentColor, accent),
    buttonColor: pickHex(input.buttonColor, primary),
    buttonTextColor: pickHex(input.buttonTextColor, THEME_FALLBACKS.buttonTextColor),
    buttonStyle: pickFrom(input.buttonStyle, SITE_BUTTON_STYLES, THEME_FALLBACKS.buttonStyle),
    buttonRadius: pickFrom(input.buttonRadius, BUTTON_RADIUS_IDS, THEME_FALLBACKS.buttonRadius),
    fontFamily: pickFrom(input.fontFamily, SITE_FONT_IDS, THEME_FALLBACKS.fontFamily),
  };
}

/**
 * Coerces a model path into the schema's `^\/[a-z0-9\-/]*$` shape rather than
 * rejecting the page over punctuation. Anything left unusable falls back to the
 * page kind's canonical path.
 */
function sanitizePath(raw: unknown, kind: (typeof PAGE_KINDS)[number]): string {
  const fallback = PAGE_DEFAULTS[kind].path;
  if (typeof raw !== "string") return fallback;

  const cleaned = clampText(raw, SITE_AI_LIMITS.path)
    .toLowerCase()
    .replace(/[^a-z0-9\-/]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/^-+|-+$/g, "");
  if (!cleaned) return fallback;

  const rooted = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
  // Trailing slashes make `/shop` and `/shop/` two different nav entries.
  const trimmed = rooted.length > 1 ? rooted.replace(/\/+$/, "") : rooted;
  return SAFE_PATH.test(trimmed) && trimmed.length <= SITE_AI_LIMITS.path ? trimmed : fallback;
}

/** The block library is the only source of truth for what renders. */
function sanitizeBlock(raw: unknown): SiteBlock | null {
  if (!isPlainObject(raw)) return null;

  const type = typeof raw.type === "string" ? raw.type.trim().toLowerCase() : "";
  if (!blockDefinition(type)) return null;

  const imageUrl = safeHttpUrl(raw.imageUrl);
  return {
    id: newId("bl"),
    type,
    title: clampText(raw.title, SITE_AI_LIMITS.blockTitle),
    subtitle: clampText(raw.subtitle, SITE_AI_LIMITS.blockSubtitle),
    url: safeHttpUrl(raw.url),
    imageUrl: imageUrl && imageUrl.length <= SITE_AI_LIMITS.imageUrl ? imageUrl : null,
    config: sanitizeBlockConfig(raw.config),
    effects: sanitizeEffectAssignment(raw.effects),
  };
}

function sanitizeSection(raw: unknown): SiteSection | null {
  if (!isPlainObject(raw)) return null;

  const kind = typeof raw.kind === "string" ? raw.kind.trim().toLowerCase() : "";
  if (!(SECTION_KINDS as readonly string[]).includes(kind)) return null;

  const blocks: SiteBlock[] = [];
  if (Array.isArray(raw.blocks)) {
    for (const item of raw.blocks) {
      if (blocks.length >= SITE_AI_LIMITS.maxBlocksPerSection) break;
      const block = sanitizeBlock(item);
      if (block) blocks.push(block);
    }
  }

  return {
    id: newId("sc"),
    kind: kind as SiteSection["kind"],
    title: clampText(raw.title, SITE_AI_LIMITS.sectionTitle),
    blocks,
    effects: sanitizeEffectAssignment(raw.effects),
  };
}

function sanitizePage(raw: unknown, takenPaths: Set<string>): SitePage | null {
  if (!isPlainObject(raw)) return null;

  const kindInput = typeof raw.kind === "string" ? raw.kind.trim().toLowerCase() : "";
  if (!(PAGE_KINDS as readonly string[]).includes(kindInput)) return null;
  const kind = kindInput as (typeof PAGE_KINDS)[number];

  const sections: SiteSection[] = [];
  if (Array.isArray(raw.sections)) {
    for (const item of raw.sections) {
      if (sections.length >= SITE_AI_LIMITS.maxSectionsPerPage) break;
      const section = sanitizeSection(item);
      if (section) sections.push(section);
    }
  }

  // Two pages on one path would make the second unreachable through nav.
  let path = sanitizePath(raw.path, kind);
  if (takenPaths.has(path)) {
    let n = 2;
    let candidate = `${path === "/" ? "" : path}/${n}`;
    while (takenPaths.has(candidate) && n < 20) {
      n += 1;
      candidate = `${path === "/" ? "" : path}/${n}`;
    }
    path = candidate;
  }
  takenPaths.add(path);

  return {
    id: newId("pg"),
    kind,
    // The schema requires a non-empty title, so an empty one is not an option.
    title: clampText(raw.title, SITE_AI_LIMITS.pageTitle) || PAGE_DEFAULTS[kind].title,
    path,
    sections,
    effects: sanitizeEffectAssignment(raw.effects),
  };
}

/**
 * The safety boundary between a language model and a client's website.
 *
 * Pure: same input, same output (bar the fresh ids), no I/O, never throws.
 * Unknown page kinds, section kinds, block types and effect ids are dropped
 * rather than guessed at; every string is clamped, every URL must be http(s);
 * `version` and `template` are ours, not the model's. Returns null only when
 * the coerced result still fails `siteDocumentSchema` — in practice, when there
 * was not one usable page in the input.
 *
 * @param template forced onto the result; an unknown id degrades to editorial.
 * @param brandColors hex fallbacks from the brief, applied where a colour is
 *   missing or malformed. Optional so the two-argument contract still holds.
 */
export function sanitizeSiteDocument(
  raw: unknown,
  template: SiteDocument["template"],
  brandColors?: SiteBrandColors,
): SiteDocument | null {
  try {
    const input = isPlainObject(raw) ? raw : {};
    const safeTemplate = (SITE_TEMPLATES as readonly string[]).includes(template)
      ? template
      : "editorial";

    const pages: SitePage[] = [];
    const takenPaths = new Set<string>();
    if (Array.isArray(input.pages)) {
      for (const item of input.pages) {
        if (pages.length >= SITE_AI_LIMITS.maxPages) break;
        const page = sanitizePage(item, takenPaths);
        if (page) pages.push(page);
      }
    }

    const result = siteDocumentSchema.safeParse({
      version: 1,
      template: safeTemplate,
      theme: sanitizeSiteTheme(input.theme, brandColors),
      effects: sanitizeEffectAssignment(input.effects),
      pages,
    });
    return result.success ? result.data : null;
  } catch {
    // A sanitiser that throws is a sanitiser callers route around.
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────
   Prompts — built from the real catalogues, so the model is told
   about exactly the blocks, sections and effects that exist today.
   ───────────────────────────────────────────────────────────── */

function blockCatalogue(): string {
  return BLOCK_LIBRARY.map((b) => `- ${b.type}: ${b.description}`).join("\n");
}

function effectCatalogue(): string {
  return EFFECT_TARGETS.map((target) => {
    const ids = EFFECTS.filter((e) => e.target === target && e.id !== EFFECT_NONE).map(
      (e) => `${e.id} (${e.description})`,
    );
    return `- ${target}: ${ids.join("; ")}`;
  }).join("\n");
}

/** System prompt for the whole-site builder. */
export function siteSystemPrompt(): string {
  return [
    "You are a website designer for Plink. Given a structured client brief, you return",
    "one complete website as configuration — pages, sections, blocks, a theme and",
    "optional effects. You never write code, markup or CSS.",
    "",
    `Page kinds you may use (nothing else): ${PAGE_KINDS.join(", ")}.`,
    `Section kinds you may use (nothing else): ${SECTION_KINDS.join(", ")}.`,
    "",
    "Block types you may use (nothing else):",
    blockCatalogue(),
    "",
    "Effect ids you may assign, grouped by the target they decorate. An effect id is",
    "only valid under its own target, and every effect is optional:",
    effectCatalogue(),
    "",
    "Rules:",
    "- Build exactly the pages the brief asks for, in the order it lists them.",
    "  The first page is the home page and its path is `/`; other paths are lowercase",
    "  and slash-rooted, like `/shop` or `/blog`.",
    "- Every page opens with a `hero` section. After that, choose section kinds that",
    "  match the page: `links` and `contact` for bio, `products` for shop, `posts`",
    `  for blog. At most ${SITE_AI_LIMITS.maxSectionsPerPage} sections per page.`,
    "- A hero holds one `header` block and, at most, one `text` block. Never more.",
    "- Use the brief's real products, links and socials. Prices go in a product",
    "  block's `subtitle`. Socials go in one `socials` block whose config is",
    "  `{ items: [{ platform, url }] }`.",
    "- Every url must start with http:// or https://. Use only urls the brief gave",
    "  you; when you do not have a real one, leave it out rather than inventing a",
    "  domain. Never invent prices, dates or claims either.",
    "- Titles are short and human — 2 to 6 words, sentence case, no emoji.",
    "- Write in the tone the brief names, in the client's own voice.",
    "- Colours are #rrggbb hex, built around the brief's brand colours, with enough",
    "  contrast to read. Pick one font family: sans, serif or mono.",
    "- Effects are seasoning: at most one background effect for the site, one text",
    "  effect on a hero, and one entrance effect per section. A page where everything",
    "  moves is a page nobody reads.",
  ].join("\n");
}

function bulletList(label: string, items: string[]): string | null {
  if (items.length === 0) return null;
  return `${label}:\n${items.map((item) => `- ${item}`).join("\n")}`;
}

/**
 * The user half of the prompt, composed from the brief. Exported because the
 * route stores it verbatim on `AiGeneration.prompt` — the provenance record is
 * worthless if it is not the string the model actually saw (plan §6).
 */
export function siteUserPrompt(brief: BriefData, template: SiteDocument["template"]): string {
  const lines: (string | null)[] = [
    `Template: ${template}.`,
    `Business: ${brief.businessName || "unnamed"}.`,
    brief.tagline ? `Tagline: ${brief.tagline}` : null,
    brief.category ? `Category: ${brief.category}` : null,
    `Tone: ${brief.tone}.`,
    brief.description ? `What they do:\n${brief.description}` : null,
    `Pages to build, in order: ${brief.pages.length ? brief.pages.join(", ") : "bio"}.`,
    bulletList(
      "Products",
      brief.products.map((p) =>
        [p.name, p.price, p.description].filter(Boolean).join(" — "),
      ),
    ),
    bulletList(
      "Links",
      brief.links.map((l) => `${l.label}: ${l.url}`),
    ),
    bulletList(
      "Socials",
      brief.socials.map((s) => `${s.platform}: ${s.url}`),
    ),
    `Brand colours: primary ${brief.brandColors.primary}, accent ${brief.brandColors.accent}.`,
    brief.contactEmail ? `Contact email: ${brief.contactEmail}` : null,
  ];

  return lines.filter((line): line is string => Boolean(line)).join("\n\n");
}

/* ─────────────────────────────────────────────────────────────
   The call
   ───────────────────────────────────────────────────────────── */

/**
 * Generates a complete site configuration from a structured brief.
 *
 * The AI SDK is an implementation detail of this package — the caller passes a
 * brief and receives a sanitised `SiteDocument`, never a raw model response.
 * Callers gate on `aiEnabled()` first; this function assumes a configured
 * gateway and lets a failed call throw.
 */
export async function generateSiteDocument(input: GenerateSiteInput): Promise<SiteDocument> {
  const { brief, template } = input;

  const { output } = await generateText({
    model: modelFor("page"),
    system: siteSystemPrompt(),
    prompt: siteUserPrompt(brief, template),
    output: Output.object({
      schema: siteProposalSchema,
      name: "plink_site",
      description: "A complete website: a theme and an ordered list of pages, sections and blocks.",
    }),
    temperature: 0.7,
    maxRetries: 1,
    timeout: 55_000,
  });

  // Model output is untrusted, even when it validated against the schema.
  const document = sanitizeSiteDocument(output, template, brief.brandColors);
  if (!document) {
    throw new Error("SITE_PROPOSAL_INVALID: the generated site had no usable pages");
  }
  return document;
}
