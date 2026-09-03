import "server-only";
import { prisma } from "@plink/db";
import { getCurrentUser } from "@/lib/auth";
import {
  parseSiteDocument,
  safeParseSiteDocument,
  type SiteDocument,
} from "@plink/core/site-schema";
import { diffDocuments, nextVersionNumber } from "@plink/core/site-versioning";

/**
 * The publish pipeline: draft save, versioned publish, rollback, audit log
 * and event store (Feature D — docs/specs/versioning-audit/spec.md).
 *
 * Two error channels, deliberately distinct:
 * - Access failures THROW `Error("UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND")`
 *   — checked in that order — and API routes map them to 401/403/404.
 * - Domain failures (invalid document, unknown version) RETURN
 *   `{ ok: false; error }` so the studio can show the message.
 *
 * Rollback never rewrites history (constitution III.3): restoring vN copies
 * its frozen snapshot into the draft and publishes it as a brand-new version.
 */

export type StoreResult = { ok: true } | { ok: false; error: string };

export type PublishResult =
  | { ok: true; versionNumber: number }
  | { ok: false; error: string };

export interface VersionSummary {
  id: string;
  number: number;
  note: string;
  createdAt: Date;
  isPublished: boolean;
}

export interface AuditEntry {
  userId?: string;
  siteId?: string;
  action: string;
  before?: string;
  after?: string;
}

export interface EventEntry {
  userId?: string;
  siteId?: string;
  type: string;
  data?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ access */

async function requireSiteAccess(siteId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { workspace: true },
  });
  if (!site) throw new Error("NOT_FOUND");
  if (site.workspace.ownerId !== user.id) throw new Error("FORBIDDEN");

  return { user, site };
}

/** The site row (workspace included) if — and only if — the caller owns it. */
export async function getSiteForUser(siteId: string) {
  const { site } = await requireSiteAccess(siteId);
  return site;
}

/* --------------------------------------------------------- audit & events */

function auditData(entry: AuditEntry) {
  return {
    userId: entry.userId ?? null,
    siteId: entry.siteId ?? null,
    action: entry.action,
    before: entry.before ?? "",
    after: entry.after ?? "",
  };
}

function eventData(entry: EventEntry) {
  return {
    userId: entry.userId ?? null,
    siteId: entry.siteId ?? null,
    type: entry.type,
    data: JSON.stringify(entry.data ?? {}),
  };
}

/** Append one audit row (who/what/when, before/after). Reused by C/E/F. */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({ data: auditData(entry) });
}

/** Append one delivery-metrics event (Product Plan VI §6). Reused by C/E/F. */
export async function logEvent(entry: EventEntry): Promise<void> {
  await prisma.eventLog.create({ data: eventData(entry) });
}

/* ------------------------------------------------------------------ drafts */

function readStoredDocument(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function invalidDocumentMessage(error: unknown): string {
  const issues = (error as { issues?: Array<{ path?: PropertyKey[]; message?: string }> })?.issues;
  const first = issues?.[0];
  if (!first?.message) return "Invalid site document";
  const path = first.path?.length ? ` at ${first.path.map(String).join(".")}` : "";
  return `Invalid site document${path}: ${first.message}`;
}

/**
 * Validates and stores the working draft. The audit row's `after` column
 * carries a `diffDocuments` summary against the previous draft — compact and
 * human-readable; full document history lives in `SiteVersion`, not here.
 */
export async function saveDraft(siteId: string, document: unknown): Promise<StoreResult> {
  const { user, site } = await requireSiteAccess(siteId);

  let parsed: SiteDocument;
  try {
    parsed = parseSiteDocument(document);
  } catch (error) {
    return { ok: false, error: invalidDocumentMessage(error) };
  }

  const previous = safeParseSiteDocument(readStoredDocument(site.document));
  const summary = previous ? diffDocuments(previous, parsed) : { pages: parsed.pages.length };

  await prisma.site.update({
    where: { id: site.id },
    data: { document: JSON.stringify(parsed) },
  });
  await writeAudit({
    userId: user.id,
    siteId: site.id,
    action: "site.save",
    after: JSON.stringify(summary),
  });

  return { ok: true };
}

/* ----------------------------------------------------- publish & rollback */

/**
 * Snapshots the draft into an immutable `SiteVersion` and marks it live.
 * Number assignment, snapshot, site update, audit and event commit in one
 * transaction — an important operation without its audit row must not
 * commit (constitution III.3); `@@unique([siteId, number])` backstops the
 * monotonic numbering against a concurrent publish.
 */
export async function publishSite(siteId: string, note?: string): Promise<PublishResult> {
  const { user, site } = await requireSiteAccess(siteId);

  const draft = safeParseSiteDocument(readStoredDocument(site.document));
  if (!draft) {
    return { ok: false, error: "The draft is not a valid site document and cannot be published" };
  }
  const snapshot = JSON.stringify(draft);

  const versionNumber = await prisma.$transaction(async (tx) => {
    const existing = await tx.siteVersion.findMany({
      where: { siteId: site.id },
      select: { number: true },
    });
    const number = nextVersionNumber(existing.map((v) => v.number));

    const version = await tx.siteVersion.create({
      data: {
        siteId: site.id,
        number,
        document: snapshot,
        note: note ?? "",
        createdById: user.id,
      },
    });
    await tx.site.update({
      where: { id: site.id },
      data: { publishedVersionId: version.id, status: "published" },
    });
    await tx.auditLog.create({
      data: auditData({
        userId: user.id,
        siteId: site.id,
        action: "site.publish",
        after: JSON.stringify({ version: number }),
      }),
    });
    await tx.eventLog.create({
      data: eventData({
        userId: user.id,
        siteId: site.id,
        type: "publish",
        data: { version: number },
      }),
    });
    return number;
  });

  return { ok: true, versionNumber };
}

/**
 * Restores version N by copying its frozen snapshot into the draft and
 * publishing that as a NEW version (note `Rollback to vN`). History is
 * never rewritten; a rollback is itself rollback-able.
 */
export async function rollbackSite(siteId: string, versionNumber: number): Promise<PublishResult> {
  const { user, site } = await requireSiteAccess(siteId);

  const target = await prisma.siteVersion.findFirst({
    where: { siteId: site.id, number: versionNumber },
  });
  if (!target) {
    return { ok: false, error: `Version ${versionNumber} does not exist for this site` };
  }

  const newNumber = await prisma.$transaction(async (tx) => {
    const existing = await tx.siteVersion.findMany({
      where: { siteId: site.id },
      select: { number: true },
    });
    const number = nextVersionNumber(existing.map((v) => v.number));

    const version = await tx.siteVersion.create({
      data: {
        siteId: site.id,
        number,
        document: target.document,
        note: `Rollback to v${versionNumber}`,
        createdById: user.id,
      },
    });
    await tx.site.update({
      where: { id: site.id },
      data: { document: target.document, publishedVersionId: version.id, status: "published" },
    });
    await tx.auditLog.create({
      data: auditData({
        userId: user.id,
        siteId: site.id,
        action: "site.rollback",
        after: JSON.stringify({ version: number, restoredFrom: versionNumber }),
      }),
    });
    await tx.eventLog.create({
      data: eventData({
        userId: user.id,
        siteId: site.id,
        type: "rollback",
        data: { version: number, restoredFrom: versionNumber },
      }),
    });
    return number;
  });

  return { ok: true, versionNumber: newNumber };
}

/* ---------------------------------------------------------------- history */

/** Version history, newest first; `isPublished` marks the live snapshot. */
export async function listVersions(siteId: string): Promise<VersionSummary[]> {
  const { site } = await requireSiteAccess(siteId);

  const rows = await prisma.siteVersion.findMany({
    where: { siteId: site.id },
    orderBy: { number: "desc" },
    select: { id: true, number: true, note: true, createdAt: true },
  });

  return rows.map((row) => ({ ...row, isPublished: row.id === site.publishedVersionId }));
}
