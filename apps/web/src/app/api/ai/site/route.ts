import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@plink/db";
import { getSessionUserId } from "@/lib/auth";
import { fail, ok, readJson, tooMany } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { logEvent } from "@/lib/site-store";
import { parseBriefJson, requireSite, resolveTemplate } from "@/lib/workspace";
import { aiEnabled } from "@plink/ai";
import { generateSiteDocument, siteUserPrompt } from "@plink/ai/site";
import type { BriefData, SiteDocument } from "@plink/core/site-schema";
import { storeErrorResponse } from "../../sites/store-errors";

/** A whole website is the slowest structured call in the app. */
export const maxDuration = 60;

/** Generation costs real money, and a site costs more than a page. */
const HOURLY_LIMIT = 6;
const WINDOW_MS = 60 * 60_000;

const schema = z.object({ siteId: z.string().trim().min(1).max(64) });

/**
 * A brief with nothing in it produces a site about nothing. This is the
 * cheapest possible check — the intake form owns real validation.
 */
function briefHasContent(brief: BriefData): boolean {
  return Boolean(
    brief.businessName ||
      brief.tagline ||
      brief.description ||
      brief.products.length ||
      brief.links.length,
  );
}

function shape(document: SiteDocument) {
  const sections = document.pages.reduce((n, page) => n + page.sections.length, 0);
  const blocks = document.pages.reduce(
    (n, page) => n + page.sections.reduce((m, section) => m + section.blocks.length, 0),
    0,
  );
  return { pages: document.pages.length, sections, blocks };
}

/**
 * Turns a site's brief into a complete `SiteDocument` proposal.
 *
 * Nothing about the site changes here (constitution III.2): the proposal is
 * recorded as an `AiGeneration` row with status `proposed` and handed back for
 * a human to review. Applying it is a separate, explicit server action, and
 * even that only writes the draft — publishing stays a deliberate act.
 */
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return fail("Not signed in", 401);

  if (!aiEnabled()) {
    return fail("AI is not configured on this server", 503, { code: "ai_disabled" });
  }

  const limit = rateLimit(`ai:site:${userId}`, HOURLY_LIMIT, WINDOW_MS);
  if (!limit.ok) return tooMany(limit.retryAfter);

  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return fail("Which site should I build?", 422);

  let site;
  try {
    ({ site } = await requireSite(parsed.data.siteId));
  } catch (error) {
    return storeErrorResponse(error);
  }

  const briefRow = await prisma.brief.findUnique({
    where: { siteId: site.id },
    select: { data: true },
  });
  const brief = parseBriefJson(briefRow?.data);
  if (!briefHasContent(brief)) {
    return fail("Fill in the brief before generating a site", 400, { code: "no_brief" });
  }

  const template = resolveTemplate(site.template);
  // Stored verbatim: a provenance record that is not the string the model saw
  // is not a provenance record (plan §6).
  const prompt = siteUserPrompt(brief, template);

  try {
    const document = await generateSiteDocument({ brief, template });

    const generation = await prisma.aiGeneration.create({
      data: {
        userId,
        siteId: site.id,
        kind: "site",
        prompt,
        output: JSON.stringify(document),
        status: "proposed",
      },
      select: { id: true },
    });

    await logEvent({
      userId,
      siteId: site.id,
      type: "ai_proposal_created",
      data: { generationId: generation.id, template, ...shape(document) },
    });

    return ok({ generationId: generation.id, document, remaining: limit.remaining });
  } catch (error) {
    // Deliberately coarse: the brief, the prompt and the gateway key must
    // never reach the log.
    console.error("[ai/site] generation failed:", (error as Error)?.name ?? "unknown");
    return fail("The website generator is busy right now. Try again in a moment.", 502);
  }
}
