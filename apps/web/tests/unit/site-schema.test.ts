import { describe, expect, it } from "vitest";
import {
  EFFECT_TARGETS,
  SITE_TEMPLATES,
  briefSchema,
  effectAssignmentSchema,
  emptyBrief,
  emptySiteDocument,
  newId,
  parseSiteDocument,
  safeParseSiteDocument,
  siteDocumentSchema,
} from "@plink/core/site-schema";

describe("site document schema", () => {
  it("round-trips an empty document for every template", () => {
    for (const template of SITE_TEMPLATES) {
      const doc = emptySiteDocument(template);
      const parsed = parseSiteDocument(JSON.parse(JSON.stringify(doc)));
      expect(parsed.template).toBe(template);
      expect(parsed.version).toBe(1);
      expect(parsed.pages.length).toBeGreaterThanOrEqual(1);
      expect(parsed.pages[0].kind).toBe("bio");
      expect(parsed.pages[0].path).toBe("/");
    }
  });

  it("rejects unknown keys at every level (strict)", () => {
    const doc = emptySiteDocument("editorial");
    expect(safeParseSiteDocument({ ...doc, extra: 1 })).toBeNull();
    const withPageExtra = {
      ...doc,
      pages: [{ ...doc.pages[0], sneaky: true }],
    };
    expect(safeParseSiteDocument(withPageExtra)).toBeNull();
  });

  it("rejects an unknown template and enforces version literal", () => {
    const doc = emptySiteDocument("portfolio");
    expect(safeParseSiteDocument({ ...doc, template: "brutalist" })).toBeNull();
    expect(safeParseSiteDocument({ ...doc, version: 2 })).toBeNull();
  });

  it("enforces page path shape and per-site page limit", () => {
    const doc = emptySiteDocument("editorial");
    const badPath = {
      ...doc,
      pages: [{ ...doc.pages[0], path: "no-leading-slash" }],
    };
    expect(safeParseSiteDocument(badPath)).toBeNull();

    const page = doc.pages[0];
    const tooMany = {
      ...doc,
      pages: Array.from({ length: 21 }, (_, i) => ({
        ...page,
        id: newId("pg"),
        path: i === 0 ? "/" : `/p${i}`,
      })),
    };
    expect(safeParseSiteDocument(tooMany)).toBeNull();
  });

  it("effect assignments accept only known targets", () => {
    expect(effectAssignmentSchema.safeParse({ surface: "shimmer", text: "text-gradient" }).success).toBe(true);
    expect(effectAssignmentSchema.safeParse({ hologram: "x" }).success).toBe(false);
    expect(EFFECT_TARGETS).toEqual(["surface", "text", "background", "entrance"]);
  });

  it("parseSiteDocument throws on garbage while safeParse returns null", () => {
    expect(() => parseSiteDocument("nope")).toThrow();
    expect(safeParseSiteDocument("nope")).toBeNull();
    expect(safeParseSiteDocument(null)).toBeNull();
  });

  it("schema object is exported for composition", () => {
    expect(siteDocumentSchema.safeParse(emptySiteDocument("storefront")).success).toBe(true);
  });

  it("newId is prefixed and unique enough", () => {
    const a = newId("bl");
    const b = newId("bl");
    expect(a).toMatch(/^bl_[a-z0-9]{10}$/);
    expect(a).not.toBe(b);
  });
});

describe("brief schema", () => {
  it("accepts the empty brief", () => {
    expect(briefSchema.safeParse(emptyBrief()).success).toBe(true);
  });

  it("validates brand colors as hex", () => {
    const brief = { ...emptyBrief(), brandColors: { primary: "#1a2b3c", accent: "#fff" } };
    expect(briefSchema.safeParse(brief).success).toBe(true);
    const bad = { ...emptyBrief(), brandColors: { primary: "red", accent: "#fff" } };
    expect(briefSchema.safeParse(bad).success).toBe(false);
  });

  it("caps list sizes and rejects unknown tone", () => {
    const many = {
      ...emptyBrief(),
      products: Array.from({ length: 21 }, (_, i) => ({ name: `p${i}`, price: "$1", description: "" })),
    };
    expect(briefSchema.safeParse(many).success).toBe(false);
    expect(briefSchema.safeParse({ ...emptyBrief(), tone: "sarcastic" }).success).toBe(false);
  });

  it("allows empty contact email but rejects invalid non-empty", () => {
    expect(briefSchema.safeParse({ ...emptyBrief(), contactEmail: "" }).success).toBe(true);
    expect(briefSchema.safeParse({ ...emptyBrief(), contactEmail: "not-an-email" }).success).toBe(false);
    expect(briefSchema.safeParse({ ...emptyBrief(), contactEmail: "a@b.co" }).success).toBe(true);
  });
});
