/**
 * The Site Schema — the single source of truth for a generated website.
 *
 * A site is a JSON document (validated here, stored as a string column,
 * snapshotted per version) rather than relational rows: publish, rollback and
 * diff are document operations, and the renderer, studio, generator and
 * versioning layer all consume this one shape. See
 * docs/superpowers/plans/2026-09-03-creator-website-os.md.
 *
 * Rules that keep the wild data safe:
 * - `.strict()` at every level — unknown keys are rejected, never smuggled.
 * - Every collection is capped, every string bounded.
 * - Effect values are plain ids; the effects registry decides at render time
 *   whether an id is real, so a stale document can never break a page.
 */

import { z } from "zod";
import { nanoid } from "nanoid";

/* ------------------------------------------------------------- templates */

export const SITE_TEMPLATES = ["editorial", "storefront", "portfolio"] as const;
export type SiteTemplateId = (typeof SITE_TEMPLATES)[number];

/* --------------------------------------------------------------- effects */

export const EFFECT_TARGETS = ["surface", "text", "background", "entrance"] as const;
export type EffectTarget = (typeof EFFECT_TARGETS)[number];

const effectId = z.string().min(1).max(40);

export const effectAssignmentSchema = z
  .object({
    surface: effectId.optional(),
    text: effectId.optional(),
    background: effectId.optional(),
    entrance: effectId.optional(),
  })
  .strict();

export type EffectAssignment = z.infer<typeof effectAssignmentSchema>;

/* ---------------------------------------------------------------- pieces */

const id = z.string().min(1).max(40);

export const siteBlockSchema = z
  .object({
    id,
    type: z.string().min(1).max(30),
    title: z.string().max(200).default(""),
    subtitle: z.string().max(300).default(""),
    url: z.string().max(2000).default(""),
    imageUrl: z.string().max(600).nullable().default(null),
    config: z.record(z.string(), z.unknown()).default({}),
    effects: effectAssignmentSchema.default({}),
  })
  .strict();

export type SiteBlock = z.infer<typeof siteBlockSchema>;

export const SECTION_KINDS = [
  "hero",
  "links",
  "products",
  "posts",
  "gallery",
  "faq",
  "contact",
  "custom",
] as const;

export const siteSectionSchema = z
  .object({
    id,
    kind: z.enum(SECTION_KINDS),
    title: z.string().max(200).default(""),
    blocks: z.array(siteBlockSchema).max(40).default([]),
    effects: effectAssignmentSchema.default({}),
  })
  .strict();

export type SiteSection = z.infer<typeof siteSectionSchema>;

export const PAGE_KINDS = ["bio", "shop", "blog", "custom"] as const;

export const sitePageSchema = z
  .object({
    id,
    kind: z.enum(PAGE_KINDS),
    title: z.string().min(1).max(120),
    path: z
      .string()
      .max(120)
      .regex(/^\/[a-z0-9\-/]*$/, "Paths are lowercase, slash-rooted"),
    sections: z.array(siteSectionSchema).max(24).default([]),
    effects: effectAssignmentSchema.default({}),
  })
  .strict();

export type SitePage = z.infer<typeof sitePageSchema>;

export const siteThemeSchema = z
  .object({
    bgColor: z.string().max(30).default("#ffffff"),
    textColor: z.string().max(30).default("#171717"),
    mutedColor: z.string().max(30).default("#888888"),
    accentColor: z.string().max(30).default("#6d28d9"),
    buttonColor: z.string().max(30).default("#171717"),
    buttonTextColor: z.string().max(30).default("#ffffff"),
    buttonStyle: z.string().max(20).default("solid"),
    buttonRadius: z.string().max(20).default("rounded"),
    fontFamily: z.string().max(20).default("sans"),
  })
  .strict();

export type SiteTheme = z.infer<typeof siteThemeSchema>;

/* -------------------------------------------------------------- document */

export const siteDocumentSchema = z
  .object({
    version: z.literal(1),
    template: z.enum(SITE_TEMPLATES),
    theme: siteThemeSchema,
    effects: effectAssignmentSchema.default({}),
    pages: z.array(sitePageSchema).min(1).max(20),
  })
  .strict();

export type SiteDocument = z.infer<typeof siteDocumentSchema>;

/** Throws ZodError. Use at trust boundaries where a bad document is a bug. */
export function parseSiteDocument(raw: unknown): SiteDocument {
  return siteDocumentSchema.parse(raw);
}

/** Null on any failure. Use where a stale row must never break a page. */
export function safeParseSiteDocument(raw: unknown): SiteDocument | null {
  const result = siteDocumentSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export function newId(prefix: "pg" | "sc" | "bl"): string {
  return `${prefix}_${nanoid(10).toLowerCase().replace(/[^a-z0-9]/g, "0")}`;
}

/** A fresh site: one bio page with a hero and an empty links section. */
export function emptySiteDocument(template: SiteTemplateId): SiteDocument {
  return siteDocumentSchema.parse({
    version: 1,
    template,
    theme: {},
    effects: {},
    pages: [
      {
        id: newId("pg"),
        kind: "bio",
        title: "Home",
        path: "/",
        sections: [
          { id: newId("sc"), kind: "hero", title: "", blocks: [], effects: {} },
          { id: newId("sc"), kind: "links", title: "", blocks: [], effects: {} },
        ],
        effects: {},
      },
    ],
  });
}

/* ----------------------------------------------------------------- brief */

export const BRIEF_TONES = ["friendly", "professional", "playful", "bold", "minimal"] as const;

const hexColor = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Use a hex color");

export const briefSchema = z
  .object({
    businessName: z.string().max(120).default(""),
    tagline: z.string().max(200).default(""),
    description: z.string().max(2000).default(""),
    category: z.string().max(60).default(""),
    tone: z.enum(BRIEF_TONES).default("friendly"),
    pages: z.array(z.enum(["bio", "shop", "blog"])).max(3).default(["bio"]),
    products: z
      .array(
        z
          .object({
            name: z.string().max(120),
            price: z.string().max(30),
            description: z.string().max(500).default(""),
          })
          .strict(),
      )
      .max(20)
      .default([]),
    links: z
      .array(z.object({ label: z.string().max(80), url: z.string().max(2000) }).strict())
      .max(20)
      .default([]),
    socials: z
      .array(z.object({ platform: z.string().max(30), url: z.string().max(2000) }).strict())
      .max(10)
      .default([]),
    brandColors: z
      .object({ primary: hexColor, accent: hexColor })
      .strict()
      .default({ primary: "#171717", accent: "#6d28d9" }),
    contactEmail: z.union([z.literal(""), z.string().email()]).default(""),
  })
  .strict();

export type BriefData = z.infer<typeof briefSchema>;

export function emptyBrief(): BriefData {
  return briefSchema.parse({});
}
