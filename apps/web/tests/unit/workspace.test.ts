import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyBrief } from "@plink/core/site-schema";

/**
 * Pure pieces + tenancy guards. The prisma tables and the session are tiny
 * in-memory stand-ins — no database and no network anywhere in this file.
 */

const store = vi.hoisted(() => ({
  session: null as string | null,
  workspaces: [] as { id: string; ownerId: string; name: string; slug: string }[],
  sites: [] as { id: string; workspaceId: string; name: string; slug: string }[],
}));

vi.mock("@/lib/auth", () => ({
  getSessionUserId: async () => store.session,
}));

vi.mock("@plink/db", () => ({
  prisma: {
    workspace: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        store.workspaces.find((w) => w.id === where.id) ?? null,
    },
    site: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const site = store.sites.find((s) => s.id === where.id);
        if (!site) return null;
        const workspace = store.workspaces.find((w) => w.id === site.workspaceId);
        return { ...site, workspace: workspace ? { ownerId: workspace.ownerId } : { ownerId: "" } };
      },
    },
  },
}));

const { baseSlug, uniqueSlug, resolveTemplate, validateBrief, parseBriefJson, requireWorkspace, requireSite } =
  await import("@/lib/workspace");

beforeEach(() => {
  store.session = null;
  store.workspaces = [];
  store.sites = [];
});

/* ------------------------------------------------------------------- slugs */

describe("baseSlug", () => {
  it("slugifies a human name", () => {
    expect(baseSlug("Marta's Ceramics Studio")).toBe("marta-s-ceramics-studio");
  });

  it("collapses symbol runs and trims edge dashes", () => {
    expect(baseSlug("  --Über // Cool!!  ")).toBe("ber-cool");
  });

  it("falls back when nothing usable remains", () => {
    expect(baseSlug("!!!")).toBe("site");
    expect(baseSlug("", "workspace")).toBe("workspace");
  });

  it("caps length without a trailing dash", () => {
    const slug = baseSlug("a".repeat(40) + " " + "b".repeat(40));
    expect(slug.length).toBeLessThanOrEqual(48);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("uniqueSlug", () => {
  it("returns the base when free", async () => {
    expect(await uniqueSlug("acme", () => false)).toBe("acme");
  });

  it("suffixes numerically on collision, starting at 2", async () => {
    const taken = new Set(["acme"]);
    expect(await uniqueSlug("acme", (s) => taken.has(s))).toBe("acme-2");
  });

  it("keeps counting past existing suffixes", async () => {
    const taken = new Set(["acme", "acme-2", "acme-3"]);
    expect(await uniqueSlug("acme", (s) => taken.has(s))).toBe("acme-4");
  });

  it("accepts an async probe", async () => {
    const taken = new Set(["acme"]);
    expect(await uniqueSlug("acme", async (s) => taken.has(s))).toBe("acme-2");
  });
});

/* --------------------------------------------------------------- templates */

describe("resolveTemplate", () => {
  it("passes known templates through", () => {
    expect(resolveTemplate("storefront")).toBe("storefront");
    expect(resolveTemplate("portfolio")).toBe("portfolio");
  });

  it("falls back to editorial for anything unknown", () => {
    expect(resolveTemplate("brutalist")).toBe("editorial");
    expect(resolveTemplate("")).toBe("editorial");
  });
});

/* ------------------------------------------------------------------- brief */

describe("validateBrief", () => {
  it("accepts an empty brief and fills defaults", () => {
    const result = validateBrief({});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.tone).toBe("friendly");
  });

  it("accepts a fully populated brief", () => {
    const result = validateBrief({
      ...emptyBrief(),
      businessName: "Marta Ceramics",
      pages: ["bio", "shop"],
      products: [{ name: "Mug", price: "$24", description: "Hand thrown" }],
      brandColors: { primary: "#171717", accent: "#6d28d9" },
      contactEmail: "hello@marta.example",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects unknown keys — the schema is strict", () => {
    expect(validateBrief({ hacked: true }).ok).toBe(false);
  });

  it("rejects a non-hex brand color with a pathed message", () => {
    const result = validateBrief({ brandColors: { primary: "red", accent: "#fff" } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("brandColors.primary");
  });

  it("rejects non-object payloads", () => {
    expect(validateBrief("nope").ok).toBe(false);
    expect(validateBrief(null).ok).toBe(false);
  });
});

describe("parseBriefJson", () => {
  it("round-trips stored brief JSON", () => {
    const brief = { ...emptyBrief(), businessName: "Acme" };
    expect(parseBriefJson(JSON.stringify(brief)).businessName).toBe("Acme");
  });

  it("never breaks on unusable rows", () => {
    expect(parseBriefJson("not json")).toEqual(emptyBrief());
    expect(parseBriefJson('{"hacked":true}')).toEqual(emptyBrief());
    expect(parseBriefJson(null)).toEqual(emptyBrief());
    expect(parseBriefJson("")).toEqual(emptyBrief());
  });
});

/* ------------------------------------------------------------------ guards */

const ws = { id: "ws_1", ownerId: "user_a", name: "Acme", slug: "acme" };
const site = { id: "site_1", workspaceId: "ws_1", name: "Acme Shop", slug: "acme-shop" };

describe("requireWorkspace", () => {
  it("throws UNAUTHENTICATED without a session", async () => {
    store.workspaces = [ws];
    await expect(requireWorkspace("ws_1")).rejects.toThrow("UNAUTHENTICATED");
  });

  it("throws FORBIDDEN for another tenant's workspace", async () => {
    store.session = "user_b";
    store.workspaces = [ws];
    await expect(requireWorkspace("ws_1")).rejects.toThrow("FORBIDDEN");
  });

  it("throws FORBIDDEN for a missing workspace — no existence leak", async () => {
    store.session = "user_a";
    await expect(requireWorkspace("ws_missing")).rejects.toThrow("FORBIDDEN");
  });

  it("returns the workspace and userId for the owner", async () => {
    store.session = "user_a";
    store.workspaces = [ws];
    await expect(requireWorkspace("ws_1")).resolves.toEqual({ workspace: ws, userId: "user_a" });
  });
});

describe("requireSite", () => {
  it("throws UNAUTHENTICATED without a session", async () => {
    store.workspaces = [ws];
    store.sites = [site];
    await expect(requireSite("site_1")).rejects.toThrow("UNAUTHENTICATED");
  });

  it("throws FORBIDDEN when the workspace belongs to someone else", async () => {
    store.session = "user_b";
    store.workspaces = [ws];
    store.sites = [site];
    await expect(requireSite("site_1")).rejects.toThrow("FORBIDDEN");
  });

  it("throws FORBIDDEN for a missing site", async () => {
    store.session = "user_a";
    await expect(requireSite("site_missing")).rejects.toThrow("FORBIDDEN");
  });

  it("resolves ownership through site.workspace.ownerId", async () => {
    store.session = "user_a";
    store.workspaces = [ws];
    store.sites = [site];
    const result = await requireSite("site_1");
    expect(result.userId).toBe("user_a");
    expect(result.site.id).toBe("site_1");
  });
});
