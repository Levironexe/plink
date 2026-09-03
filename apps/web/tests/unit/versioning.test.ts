import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  emptySiteDocument,
  newId,
  parseSiteDocument,
  type SiteBlock,
  type SiteDocument,
} from "@plink/core/site-schema";
import { diffDocuments, nextVersionNumber } from "@plink/core/site-versioning";

/* ────────────────────────────────────────────────────────────────────────────
   In-memory stand-ins for the Site / SiteVersion / AuditLog / EventLog
   tables. Hoisted so the `vi.mock` factories below can reach them — no
   database and no network anywhere in this file.
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

const db = vi.hoisted(() => ({
  workspaces: [] as WorkspaceRow[],
  sites: [] as SiteRow[],
  versions: [] as VersionRow[],
  audits: [] as AuditRow[],
  events: [] as EventRow[],
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
        orderBy?: { number?: "asc" | "desc" };
        select?: Partial<Record<keyof VersionRow, boolean>>;
      }) => {
        let rows = db.versions.filter((v) => v.siteId === args.where.siteId);
        if (args.orderBy?.number === "desc") rows = [...rows].sort((a, b) => b.number - a.number);
        if (args.orderBy?.number === "asc") rows = [...rows].sort((a, b) => a.number - b.number);
        return rows.map((row) => pick(row, args.select));
      },
      findFirst: async (args: { where: { siteId: string; number: number } }) =>
        db.versions.find((v) => v.siteId === args.where.siteId && v.number === args.where.number) ??
        null,
      create: async (args: { data: Omit<VersionRow, "id" | "createdAt"> }) => {
        // Mirrors @@unique([siteId, number]) — the store must never violate it.
        if (db.versions.some((v) => v.siteId === args.data.siteId && v.number === args.data.number)) {
          throw new Error("Unique constraint failed on siteId_number");
        }
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
        const row: EventRow = { id: `evt_${++db.seq}`, ...args.data };
        db.events.push(row);
        return { ...row };
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

const {
  getSiteForUser,
  listVersions,
  logEvent,
  publishSite,
  rollbackSite,
  saveDraft,
  writeAudit,
} = await import("@/lib/site-store");

/* ─────────────────────────────────────────────────────────────── fixtures */

const OWNER = "user_1";
const STRANGER = "user_2";

function seedSite(overrides: Partial<SiteRow> & { ownerId?: string } = {}): SiteRow {
  const { ownerId = OWNER, ...siteOverrides } = overrides;
  db.workspaces.push({ id: "ws_1", ownerId });
  const site: SiteRow = {
    id: "site_1",
    workspaceId: "ws_1",
    name: "Test site",
    slug: "test-site",
    template: "editorial",
    status: "draft",
    document: JSON.stringify(emptySiteDocument("editorial")),
    publishedVersionId: null,
    ...siteOverrides,
  };
  db.sites.push(site);
  return site;
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

beforeEach(() => {
  db.workspaces.length = 0;
  db.sites.length = 0;
  db.versions.length = 0;
  db.audits.length = 0;
  db.events.length = 0;
  db.seq = 0;
  session.user = { id: OWNER };
});

/* ═══════════════════════════════════════════════════ pure core: numbering */

describe("nextVersionNumber", () => {
  it("starts a fresh site at 1", () => {
    expect(nextVersionNumber([])).toBe(1);
  });

  it("is max + 1", () => {
    expect(nextVersionNumber([1, 2, 3])).toBe(4);
  });

  it("does not require sorted input", () => {
    expect(nextVersionNumber([3, 1, 2])).toBe(4);
  });

  it("tolerates gaps left by deleted versions", () => {
    expect(nextVersionNumber([1, 7])).toBe(8);
  });
});

/* ════════════════════════════════════════════════════════ pure core: diff */

describe("diffDocuments", () => {
  const base = emptySiteDocument("editorial");

  it("reports an unchanged document as empty", () => {
    expect(diffDocuments(base, structuredClone(base))).toEqual({
      pagesAdded: [],
      pagesRemoved: [],
      sectionsChanged: 0,
      blocksChanged: 0,
    });
  });

  it("ignores object key order — a storage round-trip is not a change", () => {
    const reordered = {
      pages: base.pages,
      effects: base.effects,
      theme: base.theme,
      template: base.template,
      version: base.version,
    } as SiteDocument;
    expect(diffDocuments(base, reordered).sectionsChanged).toBe(0);
    expect(diffDocuments(base, reordered).blocksChanged).toBe(0);
  });

  it("reports an added page by path, without counting its sections or blocks", () => {
    const next = withExtraPage(base, "/about");
    expect(diffDocuments(base, next)).toEqual({
      pagesAdded: ["/about"],
      pagesRemoved: [],
      sectionsChanged: 0,
      blocksChanged: 0,
    });
  });

  it("reports a removed page by path", () => {
    const bigger = withExtraPage(base, "/about");
    expect(diffDocuments(bigger, base)).toEqual({
      pagesAdded: [],
      pagesRemoved: ["/about"],
      sectionsChanged: 0,
      blocksChanged: 0,
    });
  });

  it("reads a renamed path as remove + add", () => {
    const before = withExtraPage(base, "/about");
    const after = structuredClone(before);
    after.pages[1].path = "/story";
    expect(diffDocuments(before, after).pagesAdded).toEqual(["/story"]);
    expect(diffDocuments(before, after).pagesRemoved).toEqual(["/about"]);
  });

  it("counts a section edit once, with no block changes", () => {
    const next = structuredClone(base);
    next.pages[0].sections[0].title = "Welcome";
    expect(diffDocuments(base, next)).toEqual({
      pagesAdded: [],
      pagesRemoved: [],
      sectionsChanged: 1,
      blocksChanged: 0,
    });
  });

  it("counts an added section once and does not leak its blocks into blocksChanged", () => {
    const next = structuredClone(base);
    next.pages[0].sections.push({
      id: newId("sc"),
      kind: "faq",
      title: "FAQ",
      blocks: [makeBlock(newId("bl")), makeBlock(newId("bl"))],
      effects: {},
    });
    expect(diffDocuments(base, next)).toEqual({
      pagesAdded: [],
      pagesRemoved: [],
      sectionsChanged: 1,
      blocksChanged: 0,
    });
  });

  it("counts a removed section once", () => {
    const next = structuredClone(base);
    next.pages[0].sections.splice(1, 1);
    expect(diffDocuments(base, next).sectionsChanged).toBe(1);
  });

  it("counts a block add — and the enclosing section, whose JSON now differs", () => {
    const next = structuredClone(base);
    next.pages[0].sections[1].blocks.push(makeBlock("bl_added", "New link"));
    expect(diffDocuments(base, next)).toEqual({
      pagesAdded: [],
      pagesRemoved: [],
      sectionsChanged: 1,
      blocksChanged: 1,
    });
  });

  it("counts a block edit and a block remove by id", () => {
    const before = structuredClone(base);
    before.pages[0].sections[1].blocks.push(makeBlock("bl_a", "A"), makeBlock("bl_b", "B"));

    const after = structuredClone(before);
    after.pages[0].sections[1].blocks = [makeBlock("bl_a", "A, edited")]; // bl_b removed

    expect(diffDocuments(before, after)).toEqual({
      pagesAdded: [],
      pagesRemoved: [],
      sectionsChanged: 1,
      blocksChanged: 2,
    });
  });

  it("treats reordered sections as no section edits — each section's own JSON is unchanged", () => {
    const next = structuredClone(base);
    next.pages[0].sections.reverse();
    expect(diffDocuments(base, next)).toEqual({
      pagesAdded: [],
      pagesRemoved: [],
      sectionsChanged: 0,
      blocksChanged: 0,
    });
  });
});

/* ═══════════════════════════════════════════════════════ store: ownership */

describe("site-store access control", () => {
  it("throws UNAUTHENTICATED without a session", async () => {
    seedSite();
    session.user = null;
    await expect(getSiteForUser("site_1")).rejects.toThrow("UNAUTHENTICATED");
  });

  it("throws NOT_FOUND for a site that does not exist", async () => {
    await expect(getSiteForUser("site_missing")).rejects.toThrow("NOT_FOUND");
  });

  it("throws FORBIDDEN when the workspace belongs to someone else", async () => {
    seedSite({ ownerId: STRANGER });
    await expect(getSiteForUser("site_1")).rejects.toThrow("FORBIDDEN");
  });

  it("rejects every mutation the same way", async () => {
    seedSite({ ownerId: STRANGER });
    await expect(saveDraft("site_1", emptySiteDocument("editorial"))).rejects.toThrow("FORBIDDEN");
    await expect(publishSite("site_1")).rejects.toThrow("FORBIDDEN");
    await expect(rollbackSite("site_1", 1)).rejects.toThrow("FORBIDDEN");
    await expect(listVersions("site_1")).rejects.toThrow("FORBIDDEN");
    expect(db.versions).toHaveLength(0);
    expect(db.audits).toHaveLength(0);
  });

  it("returns the owner's site with its workspace", async () => {
    seedSite();
    const site = await getSiteForUser("site_1");
    expect(site.id).toBe("site_1");
    expect(site.workspace.ownerId).toBe(OWNER);
  });
});

/* ══════════════════════════════════════════════════════════ store: drafts */

describe("saveDraft", () => {
  it("rejects a document that fails the schema and writes nothing", async () => {
    const site = seedSite();
    const before = site.document;

    const result = await saveDraft("site_1", { version: 1, nonsense: true });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Invalid site document");
    expect(db.sites[0].document).toBe(before);
    expect(db.audits).toHaveLength(0);
  });

  it("stores a valid document and audits site.save with a diff summary", async () => {
    seedSite();
    const next = withExtraPage(emptySiteDocument("editorial"), "/shop");

    const result = await saveDraft("site_1", next);

    expect(result).toEqual({ ok: true });
    expect(JSON.parse(db.sites[0].document).pages).toHaveLength(2);

    expect(db.audits).toHaveLength(1);
    expect(db.audits[0]).toMatchObject({ userId: OWNER, siteId: "site_1", action: "site.save" });
    expect(JSON.parse(db.audits[0].after).pagesAdded).toEqual(["/shop"]);
  });
});

/* ═════════════════════════════════════════════════════════ store: publish */

describe("publishSite", () => {
  it("snapshots the draft as version 1 and marks it live", async () => {
    const site = seedSite();

    const result = await publishSite("site_1", "First release");

    expect(result).toEqual({ ok: true, versionNumber: 1 });
    expect(db.versions).toHaveLength(1);
    expect(db.versions[0]).toMatchObject({
      siteId: "site_1",
      number: 1,
      note: "First release",
      createdById: OWNER,
    });
    expect(JSON.parse(db.versions[0].document)).toEqual(JSON.parse(site.document));
    expect(db.sites[0].publishedVersionId).toBe(db.versions[0].id);
    expect(db.sites[0].status).toBe("published");

    const audit = db.audits.find((a) => a.action === "site.publish");
    expect(audit).toMatchObject({ userId: OWNER, siteId: "site_1", after: '{"version":1}' });
    const event = db.events.find((e) => e.type === "publish");
    expect(event).toMatchObject({ userId: OWNER, siteId: "site_1" });
    expect(JSON.parse(event!.data)).toEqual({ version: 1 });
  });

  it("numbers versions monotonically across publishes, tolerating gaps", async () => {
    seedSite();
    expect(await publishSite("site_1")).toEqual({ ok: true, versionNumber: 1 });
    expect(await publishSite("site_1")).toEqual({ ok: true, versionNumber: 2 });

    // A gap (say, a pruned version) must not derail numbering.
    db.versions.push({
      id: "ver_stray",
      siteId: "site_1",
      number: 7,
      document: db.versions[0].document,
      note: "",
      createdById: null,
      createdAt: new Date(),
    });
    expect(await publishSite("site_1")).toEqual({ ok: true, versionNumber: 8 });
  });

  it("refuses to publish a draft that no longer parses", async () => {
    seedSite({ document: "{}" });

    const result = await publishSite("site_1");

    expect(result.ok).toBe(false);
    expect(db.versions).toHaveLength(0);
    expect(db.sites[0].status).toBe("draft");
  });
});

/* ════════════════════════════════════════════════════════ store: rollback */

describe("rollbackSite", () => {
  it("restores a version as a NEW version — history is never rewritten", async () => {
    seedSite();
    const v1Document = db.sites[0].document;
    await publishSite("site_1", "v1");

    await saveDraft("site_1", withExtraPage(emptySiteDocument("editorial"), "/blog"));
    await publishSite("site_1", "v2");
    expect(JSON.parse(db.sites[0].document).pages).toHaveLength(2);

    const result = await rollbackSite("site_1", 1);

    expect(result).toEqual({ ok: true, versionNumber: 3 });
    expect(db.versions).toHaveLength(3);

    const v3 = db.versions.find((v) => v.number === 3)!;
    expect(v3.note).toBe("Rollback to v1");
    expect(JSON.parse(v3.document)).toEqual(JSON.parse(v1Document));

    // Draft and live pointer both moved to the restored snapshot.
    expect(JSON.parse(db.sites[0].document)).toEqual(JSON.parse(v1Document));
    expect(db.sites[0].publishedVersionId).toBe(v3.id);

    // Versions 1 and 2 are untouched.
    expect(db.versions.find((v) => v.number === 2)!.note).toBe("v2");

    const audit = db.audits.find((a) => a.action === "site.rollback");
    expect(JSON.parse(audit!.after)).toEqual({ version: 3, restoredFrom: 1 });
    const event = db.events.find((e) => e.type === "rollback");
    expect(JSON.parse(event!.data)).toEqual({ version: 3, restoredFrom: 1 });
  });

  it("returns ok: false for a version number that does not exist", async () => {
    seedSite();
    await publishSite("site_1");

    const result = await rollbackSite("site_1", 9);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("9");
    expect(db.versions).toHaveLength(1);
  });
});

/* ═════════════════════════════════════════════════════════ store: history */

describe("listVersions", () => {
  it("lists newest first and flags only the live version", async () => {
    seedSite();
    await publishSite("site_1", "first");
    await publishSite("site_1", "second");
    await publishSite("site_1", "third");

    const versions = await listVersions("site_1");

    expect(versions.map((v) => v.number)).toEqual([3, 2, 1]);
    expect(versions.map((v) => v.isPublished)).toEqual([true, false, false]);
    expect(versions[0]).toMatchObject({ note: "third" });
    expect(versions[0].id).toBeTruthy();
    expect(versions[0].createdAt).toBeInstanceOf(Date);
  });
});

/* ══════════════════════════════════════════════════ store: audit & events */

describe("writeAudit / logEvent", () => {
  it("fills optional fields with the columns' defaults", async () => {
    await writeAudit({ action: "brief.submit" });
    expect(db.audits[0]).toMatchObject({
      userId: null,
      siteId: null,
      action: "brief.submit",
      before: "",
      after: "",
    });

    await logEvent({ type: "ai_proposal_kept" });
    expect(db.events[0]).toMatchObject({ userId: null, siteId: null, data: "{}" });
  });

  it("serializes event data as JSON", async () => {
    await logEvent({ userId: OWNER, siteId: "site_1", type: "publish", data: { version: 4 } });
    expect(JSON.parse(db.events[0].data)).toEqual({ version: 4 });
  });
});
