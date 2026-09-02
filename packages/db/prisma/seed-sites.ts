/**
 * Seeds the Creator Website OS demo: one agency workspace and three client
 * sites — one per template, rendered from the same SiteDocument shape — so the
 * renderer's "three distinct interfaces from one schema" claim (plan §8) has
 * live data behind it. Called from seed.ts; the demo user cascade-deletes the
 * workspace, so re-running stays clean.
 */
import {
  emptySiteDocument,
  newId,
  parseSiteDocument,
  type SiteDocument,
  type SiteSection,
  type SiteTemplateId,
} from "@plink/core/site-schema";
import { prisma } from "../src/index";

function section(kind: SiteSection["kind"], title: string, blocks: SiteSection["blocks"] = []): SiteSection {
  return { id: newId("sc"), kind, title, blocks, effects: {} };
}

function block(type: string, title: string, extra: Partial<SiteSection["blocks"][number]> = {}) {
  return {
    id: newId("bl"),
    type,
    title,
    subtitle: "",
    url: "",
    imageUrl: null,
    config: {},
    effects: {},
    ...extra,
  };
}

function demoDocument(template: SiteTemplateId, business: {
  name: string;
  tagline: string;
  accent: string;
  products: [string, string][];
  posts: [string, string][];
}): SiteDocument {
  const doc = emptySiteDocument(template);
  doc.theme.accentColor = business.accent;
  doc.effects = { background: "bg-dot-grid" };

  doc.pages[0].title = "Home";
  doc.pages[0].sections = [
    section("hero", business.name, [
      block("header", business.name, {
        subtitle: business.tagline,
        effects: { text: "text-gradient", entrance: "enter-fade-up" },
      }),
    ]),
    section("links", "Find us", [
      block("link", "Book a consultation", { url: "https://cal.com/example", effects: { surface: "shimmer" } }),
      block("link", "Follow on Instagram", { url: "https://instagram.com/example" }),
    ]),
  ];

  doc.pages.push({
    id: newId("pg"),
    kind: "shop",
    title: "Shop",
    path: "/shop",
    sections: [
      section(
        "products",
        "What we sell",
        business.products.map(([name, price]) =>
          block("product", name, { subtitle: price, url: "https://buy.stripe.com/example" }),
        ),
      ),
    ],
    effects: {},
  });

  doc.pages.push({
    id: newId("pg"),
    kind: "blog",
    title: "Journal",
    path: "/blog",
    sections: [
      section(
        "posts",
        "Latest notes",
        business.posts.map(([title, body]) => block("text", title, { subtitle: body })),
      ),
    ],
    effects: {},
  });

  // Round-trip through the schema so a seed bug fails here, not at render.
  return parseSiteDocument(JSON.parse(JSON.stringify(doc)));
}

const DEMO_SITES: { slug: string; name: string; template: SiteTemplateId; client: string; doc: SiteDocument }[] = [
  {
    slug: "demo-linh-florals",
    name: "Linh Florals",
    template: "editorial",
    client: "Linh Tran",
    doc: demoDocument("editorial", {
      name: "Linh Florals",
      tagline: "Seasonal arrangements from a Saigon studio.",
      accent: "#b45309",
      products: [
        ["Signature bouquet", "$45"],
        ["Weekly office subscription", "$120/mo"],
      ],
      posts: [
        ["Peonies are back", "The first crates arrived this week — here is how to keep them alive."],
        ["Behind the studio", "A morning in the cooler room, and why stems get cut twice."],
      ],
    }),
  },
  {
    slug: "demo-baseline-coffee",
    name: "Baseline Coffee",
    template: "storefront",
    client: "Duc Pham",
    doc: demoDocument("storefront", {
      name: "Baseline Coffee",
      tagline: "Small-batch roasts, shipped weekly.",
      accent: "#166534",
      products: [
        ["Ethiopia Guji, 250g", "$18"],
        ["Monthly roaster's pick", "$16/mo"],
        ["Brew course (online)", "$49"],
      ],
      posts: [["Why we roast lighter", "Sweetness survives when you stop before the second crack."]],
    }),
  },
  {
    slug: "demo-atlas-audio",
    name: "Atlas Audio",
    template: "portfolio",
    client: "Mai Nguyen",
    doc: demoDocument("portfolio", {
      name: "Atlas Audio",
      tagline: "Mixing and mastering for independent artists.",
      accent: "#5b21b6",
      products: [
        ["Single mix + master", "$220"],
        ["EP package (5 tracks)", "$900"],
      ],
      posts: [["Loudness is a choice", "What LUFS targets actually mean for your streaming release."]],
    }),
  },
];

export async function seedSites(ownerId: string): Promise<number> {
  const workspace = await prisma.workspace.create({
    data: { ownerId, name: "Plink Agency", slug: "plink-agency" },
  });

  for (const site of DEMO_SITES) {
    const document = JSON.stringify(site.doc);
    const created = await prisma.site.create({
      data: {
        workspaceId: workspace.id,
        name: site.name,
        slug: site.slug,
        template: site.template,
        status: "published",
        document,
        clientName: site.client,
        brief: { create: { status: "submitted", data: "{}" } },
        versions: { create: { number: 1, document, note: "Seeded first publish", createdById: ownerId } },
      },
      include: { versions: true },
    });
    await prisma.site.update({
      where: { id: created.id },
      data: { publishedVersionId: created.versions[0].id },
    });
    await prisma.auditLog.create({
      data: { userId: ownerId, siteId: created.id, action: "site.publish", after: `{"version":1}` },
    });
  }

  return DEMO_SITES.length;
}
