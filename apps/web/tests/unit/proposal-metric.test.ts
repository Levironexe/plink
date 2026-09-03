import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  emptySiteDocument,
  newId,
  parseSiteDocument,
  type SiteBlock,
  type SiteDocument,
} from "@plink/core/site-schema";

/* ────────────────────────────────────────────────────────────────────────────
   Feature: the honest kept / edited / discarded ratio
   (docs/specs/proposal-edited-metric/spec.md). `publishSite` attributes the
   document it just froze to the AI proposal that seeded it and records
   `ai_proposal_kept_verified` or `ai_proposal_edited`.

   Same testing seam as `versioning.test.ts`: in-memory stand-ins for the
   Site / SiteVersion / AuditLog / EventLog tables, hoisted so the `vi.mock`
   factories can reach them, plus an `AiGeneration` table. No database and no
   network anywhere in this file.
   ──────────────────────────────────────────────────────────────────────── */

type WorkspaceRow = { id: string; ownerId: string };
type SiteRow = {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  template: string;
  status: string;
  document: string;
  publishedVersionId: string | null;
};
type VersionRow = {
  id: string;
  siteId: string;
  number: number;
  document: string;
  note: string;
  createdById: string | null;
  createdAt: Date;
};
type AuditRow = {
  id: string;
  userId: string | null;
  siteId: string | null;
  action: string;
  before: string;
  after: string;
};
type EventRow = {
  id: string;
  userId: string | null;
  siteId: string | null;
  type: string;
  data: string;
};
type GenerationRow = {
  id: string;
  userId: string;
  siteId: string | null;
  kind: string;
  prompt: string;
  output: string;
  finalApplied: string;
  status: string;
  createdAt: Date;
};

const db = vi.hoisted(() => ({
  workspaces: [] as WorkspaceRow[],
  sites: [] as SiteRow[],
  versions: [] as VersionRow[],
  audits: [] as AuditRow[],
  events: [] as EventRow[],
  generations: [] as GenerationRow[],
  /** Event types whose insert should blow up — the "metrics must not break
   *  the product" fault injection. */
  rejectEventTypes: [] as string[],
  /** Makes the generation lookup itself fail, the other half of that fault. */
  rejectGenerationReads: false,
  seq: 0,
}));

const session = vi.hoisted(() => ({ user: null as { id: string } | null }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => session.user }));

vi.mock("@plink/db", () => {
  function pick<T extends object>(row: T, select?: Partial<Record<keyof T, boolean>>): Partial<T> {
    if (!select) return { ...row };
    const out: Partial<T> = {};
    for (const key of Object.keys(select) as Array<keyof T>) {
      if (select[key]) out[key] = row[key];
    }
    return out;
  }

  const prisma = {
    site: {
      findUnique: async (args: { where: { id: string }; include?: { workspace?: boolean } }) => {
        const site = db.sites.find((s) => s.id === args.where.id);
        if (!site) return null;
        if (!args.include?.workspace) return { ...site };
        const workspace = db.workspaces.find((w) => w.id === site.workspaceId) ?? null;
        return { ...site, workspace };
      },
      update: async (args: { where: { id: string }; data: Partial<SiteRow> }) => {
        const site = db.sites.find((s) => s.id === args.where.id);
        if (!site) throw new Error("Record to update not found");
        Object.assign(site, args.data);
        return { ...site };
      },
    },
    siteVersion: {
      findMany: async (args: {
        where: { siteId: string };
        select?: Partial<Record<keyof VersionRow, boolean>>;
      }) => db.versions.filter((v) => v.siteId === args.where.siteId).map((r) => pick(r, args.select)),
      create: async (args: { data: Omit<VersionRow, "id" | "createdAt"> }) => {
        const row: VersionRow = { id: `ver_${++db.seq}`, createdAt: new Date(), ...args.data };
        db.versions.push(row);
        return { ...row };
      },
    },
    auditLog: {
      create: async (args: { data: Omit<AuditRow, "id"> }) => {
        const row: AuditRow = { id: `aud_${++db.seq}`, ...args.data };
        db.audits.push(row);
        return { ...row };
      },
    },
    eventLog: {
      create: async (args: { data: Omit<EventRow, "id"> }) => {
        if (db.rejectEventTypes.includes(args.data.type)) {
          throw new Error(`event store unavailable for ${args.data.type}`);
        }
        const row: EventRow = { id: `evt_${++db.seq}`, ...args.data };
        db.events.push(row);
        return { ...row };
      },
      findMany: async (args: {
        where: { siteId?: string; type?: { in: string[] } };
        select?: Partial<Record<keyof EventRow, boolean>>;
      }) => {
        const rows = db.events.filter(
          (e) =>
            (args.where.siteId === undefined || e.siteId === args.where.siteId) &&
            (args.where.type === undefined || args.where.type.in.includes(e.type)),
        );
        return rows.map((row) => pick(row, args.select));
      },
    },
    aiGeneration: {
      findFirst: async (args: {
        where: {
          siteId?: string;
          kind?: string;
          status?: string;
          createdAt?: { lte?: Date; lt?: Date };
        };
        orderBy?: { createdAt?: "asc" | "desc" };
        select?: Partial<Record<keyof GenerationRow, boolean>>;
      }) => {
        if (db.rejectGenerationReads) throw new Error("generation store unavailable");
        const { where } = args;
        let rows = db.generations.filter(
          (g) =>
            (where.siteId === undefined || g.siteId === where.siteId) &&
            (where.kind === undefined || g.kind === where.kind) &&
            (where.status === undefined || g.status === where.status) &&
            (where.createdAt?.lte === undefined || g.createdAt <= where.createdAt.lte) &&
            (where.createdAt?.lt === undefined || g.createdAt < where.createdAt.lt),
        );
        if (args.orderBy?.createdAt === "desc") {
          rows = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        if (args.orderBy?.createdAt === "asc") {
          rows = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        }
        const row = rows[0];
        return row ? pick(row, args.select) : null;
      },
    },
    $transaction: async (arg: unknown) => {
      if (typeof arg === "function") {
        return (arg as (tx: typeof prisma) => Promise<unknown>)(prisma);
      }
      return Promise.all(arg as Array<Promise<unknown>>);
    },
  };

  return { prisma };
});

const { publishSite, saveDraft } = await import("@/lib/site-store");

/* ─────────────────────────────────────────────────────────────── fixtures */

const OWNER = "user_1";
const KEPT_VERIFIED = "ai_proposal_kept_verified";
const EDITED = "ai_proposal_edited";

function seedSite(document: SiteDocument, id = "site_1"): SiteRow {
  if (!db.workspaces.length) db.workspaces.push({ id: "ws_1", ownerId: OWNER });
  const site: SiteRow = {
    id,
    workspaceId: "ws_1",
    name: "Test site",
    slug: id,
    template: "editorial",
    status: "draft",
    document: JSON.stringify(document),
    publishedVersionId: null,
  };
  db.sites.push(site);
  return site;
}

function seedGeneration(
  overrides: Partial<GenerationRow> & { output: string },
): GenerationRow {
  const row: GenerationRow = {
    id: `gen_${++db.seq}`,
    userId: OWNER,
    siteId: "site_1",
    kind: "site",
    prompt: "A portfolio for a ceramicist",
    finalApplied: overrides.output,
    status: "applied",
    createdAt: new Date(2026, 8, 3, 10, 0, 0),
    ...overrides,
  };
  db.generations.push(row);
  return row;
}

function makeBlock(id: string, title = ""): SiteBlock {
  return { id, type: "link", title, subtitle: "", url: "", imageUrl: null, config: {}, effects: {} };
}

function withExtraPage(base: SiteDocument, path: string): SiteDocument {
  return parseSiteDocument({
    ...base,
    pages: [
      ...base.pages,
      {
        id: newId("pg"),
        kind: "custom",
        title: "Extra",
        path,
        sections: [{ id: newId("sc"), kind: "custom", title: "", blocks: [makeBlock(newId("bl"))] }],
      },
    ],
  });
}

/** Every AI outcome event recorded, in insertion order. */
function outcomeEvents(): EventRow[] {
  return db.events.filter((e) => e.type === KEPT_VERIFIED || e.type === EDITED);
}

beforeEach(() => {
  db.workspaces.length = 0;
  db.sites.length = 0;
  db.versions.length = 0;
  db.audits.length = 0;
  db.events.length = 0;
  db.generations.length = 0;
  db.rejectEventTypes.length = 0;
  db.rejectGenerationReads = false;
  db.seq = 0;
  session.user = { id: OWNER };
});

/* ══════════════════════════════════════════════════ nothing to attribute to */

describe("publishSite AI attribution — when no proposal seeded the site", () => {
  it("emits no AI event for a hand-built site", async () => {
    seedSite(emptySiteDocument("editorial"));

    const result = await publishSite("site_1", "First release");

    expect(result).toEqual({ ok: true, versionNumber: 1 });
    expect(db.events.map((e) => e.type)).toEqual(["publish"]);
  });

  it("ignores a proposal that is still awaiting review", async () => {
    const document = emptySiteDocument("editorial");
    seedSite(document);
    seedGeneration({ output: JSON.stringify(document), status: "proposed" });

    await publishSite("site_1");

    expect(outcomeEvents()).toHaveLength(0);
  });

  it("ignores a discarded proposal", async () => {
    const document = emptySiteDocument("editorial");
    seedSite(document);
    seedGeneration({ output: JSON.stringify(document), status: "discarded" });

    await publishSite("site_1");

    expect(outcomeEvents()).toHaveLength(0);
  });

  it("ignores generations of another kind", async () => {
    const document = emptySiteDocument("editorial");
    seedSite(document);
    seedGeneration({ output: JSON.stringify(document), kind: "bio" });

    await publishSite("site_1");

    expect(outcomeEvents()).toHaveLength(0);
  });

  it("never credits another site's proposal", async () => {
    const document = emptySiteDocument("editorial");
    seedSite(document);
    seedGeneration({ output: JSON.stringify(document), siteId: "site_2" });

    await publishSite("site_1");

    expect(outcomeEvents()).toHaveLength(0);
  });
});

/* ════════════════════════════════════════════════ kept verbatim vs rewritten */

describe("publishSite AI attribution — kept vs edited", () => {
  it("records ai_proposal_kept_verified with a zero diff when the proposal shipped verbatim", async () => {
    const document = emptySiteDocument("editorial");
    seedSite(document);
    const generation = seedGeneration({ output: JSON.stringify(document) });

    const result = await publishSite("site_1", "Ship it");

    expect(result).toEqual({ ok: true, versionNumber: 1 });
    const events = outcomeEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: KEPT_VERIFIED, userId: OWNER, siteId: "site_1" });
    expect(JSON.parse(events[0].data)).toEqual({
      generationId: generation.id,
      pagesAdded: [],
      pagesRemoved: [],
      sectionsChanged: 0,
      blocksChanged: 0,
    });
  });

  it("records ai_proposal_edited carrying the real diff after a human rewrite", async () => {
    const proposal = emptySiteDocument("editorial");
    seedSite(proposal);
    const generation = seedGeneration({ output: JSON.stringify(proposal) });

    // The operator retitles a section, edits a block and adds a whole page.
    const edited = withExtraPage(proposal, "/shop");
    edited.pages[0].sections[0].title = "Welcome";
    edited.pages[0].sections[1].blocks.push(makeBlock("bl_added", "New link"));
    await saveDraft("site_1", edited);

    const result = await publishSite("site_1");

    expect(result).toEqual({ ok: true, versionNumber: 1 });
    const events = outcomeEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: EDITED, userId: OWNER, siteId: "site_1" });
    expect(JSON.parse(events[0].data)).toEqual({
      generationId: generation.id,
      pagesAdded: ["/shop"],
      pagesRemoved: [],
      sectionsChanged: 2,
      blocksChanged: 1,
    });
  });

  it("credits the most recent applied proposal after a regenerate", async () => {
    const document = emptySiteDocument("editorial");
    seedSite(document);
    seedGeneration({
      output: JSON.stringify(withExtraPage(document, "/old")),
      createdAt: new Date(2026, 8, 3, 9, 0, 0),
    });
    const latest = seedGeneration({
      output: JSON.stringify(document),
      createdAt: new Date(2026, 8, 3, 11, 0, 0),
    });

    await publishSite("site_1");

    const events = outcomeEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe(KEPT_VERIFIED);
    expect(JSON.parse(events[0].data).generationId).toBe(latest.id);
  });
});

/* ═════════════════════════════════════════════════ measured exactly once */

describe("publishSite AI attribution — idempotency", () => {
  it("does not credit the same generation twice across republishes", async () => {
    const document = emptySiteDocument("editorial");
    seedSite(document);
    seedGeneration({ output: JSON.stringify(document) });

    expect(await publishSite("site_1", "v1")).toEqual({ ok: true, versionNumber: 1 });
    expect(outcomeEvents()).toHaveLength(1);

    expect(await publishSite("site_1", "v2")).toEqual({ ok: true, versionNumber: 2 });
    expect(outcomeEvents()).toHaveLength(1);
  });

  it("stays silent on a later publish even after the human edits more", async () => {
    const proposal = emptySiteDocument("editorial");
    seedSite(proposal);
    seedGeneration({ output: JSON.stringify(proposal) });

    await publishSite("site_1", "v1");
    expect(outcomeEvents().map((e) => e.type)).toEqual([KEPT_VERIFIED]);

    await saveDraft("site_1", withExtraPage(proposal, "/blog"));
    await publishSite("site_1", "v2");

    // Still one verdict: the generation was measured when it shipped.
    expect(outcomeEvents().map((e) => e.type)).toEqual([KEPT_VERIFIED]);
  });
});

/* ══════════════════════════════════════════════ never at the publish's cost */

describe("publishSite AI attribution — a metric may never break a publish", () => {
  it("writes no event when the stored proposal no longer parses, and still publishes", async () => {
    const document = emptySiteDocument("editorial");
    seedSite(document);
    seedGeneration({ output: "{}" });

    const result = await publishSite("site_1");

    expect(result).toEqual({ ok: true, versionNumber: 1 });
    expect(outcomeEvents()).toHaveLength(0);
    expect(db.versions).toHaveLength(1);
  });

  it("writes no event when the stored proposal is not even JSON, and still publishes", async () => {
    const document = emptySiteDocument("editorial");
    seedSite(document);
    seedGeneration({ output: "<html>sorry</html>" });

    expect(await publishSite("site_1")).toEqual({ ok: true, versionNumber: 1 });
    expect(outcomeEvents()).toHaveLength(0);
  });

  it("publishes successfully when the metric's event write throws", async () => {
    const document = emptySiteDocument("editorial");
    seedSite(document);
    seedGeneration({ output: JSON.stringify(document) });
    db.rejectEventTypes.push(KEPT_VERIFIED, EDITED);

    const result = await publishSite("site_1", "Ship it");

    expect(result).toEqual({ ok: true, versionNumber: 1 });
    expect(outcomeEvents()).toHaveLength(0);
    // The publish itself is intact: version, live pointer, audit and event.
    expect(db.versions).toHaveLength(1);
    expect(db.sites[0].publishedVersionId).toBe(db.versions[0].id);
    expect(db.sites[0].status).toBe("published");
    expect(db.audits.some((a) => a.action === "site.publish")).toBe(true);
    expect(db.events.map((e) => e.type)).toEqual(["publish"]);
  });

  it("publishes successfully when the generation lookup throws", async () => {
    const document = emptySiteDocument("editorial");
    seedSite(document);
    seedGeneration({ output: JSON.stringify(document) });
    db.rejectGenerationReads = true;

    expect(await publishSite("site_1")).toEqual({ ok: true, versionNumber: 1 });
    expect(outcomeEvents()).toHaveLength(0);
    expect(db.versions).toHaveLength(1);
  });
});
