"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@plink/db";
import { requireSite } from "@/lib/workspace";
import { logEvent, saveDraft, writeAudit } from "@/lib/site-store";
import { safeParseSiteDocument, type SiteDocument } from "@plink/core/site-schema";

/**
 * The human half of the AI website generator: keep the proposal or throw it
 * away. Both are recorded (constitution III.3/III.4) — the `AiGeneration` row
 * carries provenance, the `EventLog` row carries the delivery metric.
 *
 * Neither action accepts a document from the browser. A server action is a
 * public endpoint, and the cheapest way to make a tampered proposal impossible
 * is never to take one: the stored `AiGeneration.output` is re-read and
 * re-validated here, and the client sends only ids.
 */

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; field?: string };

/** The generation row, scoped to the caller's site *and* the caller. */
async function requireProposal(siteId: string, generationId: string, userId: string) {
  return prisma.aiGeneration.findFirst({
    where: { id: generationId, siteId, userId, kind: "site" },
    select: { id: true, output: true, status: true },
  });
}

function shape(document: SiteDocument) {
  const sections = document.pages.reduce((n, page) => n + page.sections.length, 0);
  const blocks = document.pages.reduce(
    (n, page) => n + page.sections.reduce((m, section) => m + section.blocks.length, 0),
    0,
  );
  return { pages: document.pages.length, sections, blocks };
}

function readDocument(raw: string): SiteDocument | null {
  try {
    return safeParseSiteDocument(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Writes the proposal into the site's working draft. Never publishes — the
 * operator reviews the draft in the editor and publishes when they mean to.
 */
export async function applyProposal(
  siteId: string,
  generationId: string,
): Promise<ActionResult<{ pages: number }>> {
  const { site, userId } = await requireSite(siteId);

  const proposal = await requireProposal(site.id, generationId, userId);
  if (!proposal) return { ok: false, error: "That proposal is no longer available" };
  if (proposal.status === "applied") return { ok: false, error: "That proposal was already applied" };

  const document = readDocument(proposal.output);
  if (!document) {
    return { ok: false, error: "That proposal is no longer a valid site document" };
  }

  const saved = await saveDraft(site.id, document);
  if (!saved.ok) return { ok: false, error: saved.error };

  const summary = shape(document);

  await prisma.aiGeneration.update({
    where: { id: proposal.id },
    // V1 applies the proposal verbatim, so `finalApplied` equals `output`. The
    // column earns its keep once the editor can hand back an edited document
    // (the `ai_proposal_edited` path — docs/specs/website-generator/spec.md).
    data: { status: "applied", finalApplied: proposal.output },
  });

  // The brief has done its job once a site came out of it.
  await prisma.brief.updateMany({ where: { siteId: site.id }, data: { status: "generated" } });

  await writeAudit({
    userId,
    siteId: site.id,
    action: "ai.site.apply",
    after: JSON.stringify({ generationId: proposal.id, ...summary }),
  });
  await logEvent({
    userId,
    siteId: site.id,
    type: "ai_proposal_kept",
    data: { generationId: proposal.id, ...summary },
  });

  revalidatePath("/studio");
  revalidatePath(`/studio/${site.id}`);
  revalidatePath(`/studio/${site.id}/generate`);
  return { ok: true, data: { pages: summary.pages } };
}

/** Marks a proposal rejected. The row stays — a discard is data, not a delete. */
export async function discardProposal(
  siteId: string,
  generationId: string,
): Promise<ActionResult> {
  const { site, userId } = await requireSite(siteId);

  const proposal = await requireProposal(site.id, generationId, userId);
  if (!proposal) return { ok: false, error: "That proposal is no longer available" };
  // Applying is final; a later discard would rewrite what actually happened.
  if (proposal.status === "applied") return { ok: false, error: "That proposal was already applied" };
  if (proposal.status === "discarded") return { ok: true };

  await prisma.aiGeneration.update({
    where: { id: proposal.id },
    data: { status: "discarded" },
  });

  await writeAudit({
    userId,
    siteId: site.id,
    action: "ai.site.discard",
    after: JSON.stringify({ generationId: proposal.id }),
  });
  await logEvent({
    userId,
    siteId: site.id,
    type: "ai_proposal_discarded",
    data: { generationId: proposal.id },
  });

  revalidatePath(`/studio/${site.id}/generate`);
  return { ok: true };
}
