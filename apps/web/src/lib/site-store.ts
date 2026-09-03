import "server-only";
import { prisma } from "@plink/db";
import { getCurrentUser } from "@/lib/auth";
import {
  parseSiteDocument,
  safeParseSiteDocument,
  type SiteDocument,
} from "@plink/core/site-schema";
import {
  diffDocuments,
  nextVersionNumber,
  type DocumentDiff,
} from "@plink/core/site-versioning";

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

/* -------------------------------------------- AI proposal outcome metrics */

/**
 * The two events that credit a generation with a published outcome. Their
 * presence in `EventLog` *is* the record that a generation has been measured
 * — with the Prisma schema frozen there is no `AiGeneration.creditedAt` to
 * consult (docs/spikes/2026-09-03-proposal-edited-at-publish-time.md).
 */
const AI_OUTCOME_EVENTS = ["ai_proposal_kept_verified", "ai_proposal_edited"] as const;

function readGenerationId(raw: string): string | null {
  const parsed = readStoredDocument(raw) as { generationId?: unknown } | null;
  return typeof parsed?.generationId === "string" ? parsed.generationId : null;
}

function isUnchanged(diff: DocumentDiff): boolean {
  return (
    diff.pagesAdded.length === 0 &&
    diff.pagesRemoved.length === 0 &&
    diff.sectionsChanged === 0 &&
    diff.blocksChanged === 0
  );
}

/**
 * Records how much of the shipped site the model actually wrote (plan §6,
 * constitution III.4 — human edits of AI generations are recorded).
 *
 * Publish is the moment a human has finished editing and committed to a
 * result, so that is where the signal fires: the just-published document is
 * diffed against the proposal that seeded it, and the outcome is logged as
 * `ai_proposal_kept_verified` (shipped verbatim) or `ai_proposal_edited`
 * (rewritten, with the real diff counts). A site with no applied proposal
 * emits nothing — a hand-built site must not show up as an AI metric — and
 * each generation is credited exactly once, however often the site is
 * republished afterwards.
 *
 * SWALLOWS EVERY ERROR, DELIBERATELY. This observes an operation that has
 * already committed; the audit row and `publish` event that *describe* the
 * publish stay inside its transaction, but a failed measurement must never
 * cost an operator their version snapshot or turn a successful publish into
 * a reported failure. Metrics do not get to break the product. The cost is
 * an occasional missing row, which the next publish of that generation
 * re-attempts.
 */
async function recordAiProposalOutcome(
  userId: string,
  siteId: string,
  published: SiteDocument,
): Promise<void> {
  try {
    // A row can only be read after it was written, so the `createdAt` bound
    // is defensive; `lte` keeps a generation that landed in the same
    // millisecond as the publish.
    const generation = await prisma.aiGeneration.findFirst({
      where: {
        siteId,
        kind: "site",
        status: "applied",
        createdAt: { lte: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, output: true },
    });
    if (!generation) return;

    const credited = await prisma.eventLog.findMany({
      where: { siteId, type: { in: [...AI_OUTCOME_EVENTS] } },
      select: { data: true },
    });
    if (credited.some((row) => readGenerationId(row.data) === generation.id)) return;

    // An unattributable publish beats a guessed metric: `output` is a string
    // column that may predate the current schema revision.
    const proposal = safeParseSiteDocument(readStoredDocument(generation.output));
    if (!proposal) return;

    const diff = diffDocuments(proposal, published);
    await logEvent({
      userId,
      siteId,
      type: isUnchanged(diff) ? "ai_proposal_kept_verified" : "ai_proposal_edited",
      data: { generationId: generation.id, ...diff },
    });
  } catch {
    // Intentionally silent — see the note above.
  }
}

/* ----------------------------------------------------- publish & rollback */

/**
 * Snapshots the draft into an immutable `SiteVersion` and marks it live.
 * Number assignment, snapshot, site update, audit and event commit in one
 * transaction — an important operation without its audit row must not
 * commit (constitution III.3); `@@unique([siteId, number])` backstops the
 * monotonic numbering against a concurrent publish.
 *
 * Once the snapshot is safely committed, `recordAiProposalOutcome` measures
 * the published document against the AI proposal that seeded it. That step is
 * outside the transaction and cannot fail the publish.
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

  // Post-commit and non-fatal by construction: the version is already frozen,
  // and this only measures how much of it the model wrote.
  await recordAiProposalOutcome(user.id, site.id, draft);

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
