"use server";

import { revalidatePath } from "next/cache";
import { safeHttpUrl } from "@plink/ai";
import { safeParseSiteDocument } from "@plink/core/site-schema";
import { getSiteForUser, logEvent, saveDraft, writeAudit } from "@/lib/site-store";
import { applyAssetToDocument, isAssetTarget, type AssetTarget } from "./_lib/apply-asset";

/**
 * The asset library's server boundary — one action, one job: put a generated
 * image into the site's **draft**.
 *
 * A Server Action is a public endpoint (Art. I.2), so every argument arrives
 * untrusted and is re-validated here even though the picker only ever sends
 * values it was given: the target shape through `isAssetTarget`, the URL
 * through `safeHttpUrl` (http(s) only, no `data:`, no protocol-relative) and
 * the schema's own `imageUrl` ceiling. Ownership is `getSiteForUser`'s job and
 * the document's validity is `saveDraft`'s — nothing here duplicates either.
 *
 * Publishing is deliberately not part of this: the draft changes, the live page
 * does not, and the operator publishes when they are ready (Art. III.3).
 */

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; field?: string };

/** `SiteBlock.imageUrl` is `z.string().max(600)`; refuse rather than truncate. */
const IMAGE_URL_MAX = 600;

const ACCESS_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Sign in to edit this site",
  FORBIDDEN: "This site belongs to another account",
  NOT_FOUND: "This site no longer exists",
};

/**
 * Maps the store's thrown access errors onto `ActionResult`, exactly as
 * `studio/[siteId]/actions.ts` does — an ordinary "you don't own this" must
 * never reach the operator as a 500.
 */
async function withStore<T>(run: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await run();
  } catch (error) {
    const message = ACCESS_MESSAGES[(error as Error)?.message];
    if (message) return { ok: false, error: message };
    throw error;
  }
}

function readJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Place `url` at `target` in the site's draft document.
 *
 * Returns "That placement no longer exists" when the target does not resolve
 * against the *stored* draft — the picker was built from a document that may
 * have been edited in another tab since, and a save that changes nothing is
 * worse than an honest refusal.
 */
export async function applyAsset(
  siteId: string,
  target: AssetTarget,
  url: string,
): Promise<ActionResult> {
  return withStore(async () => {
    if (!isAssetTarget(target)) {
      return { ok: false, error: "That placement is not one we can apply to" };
    }

    const safe = safeHttpUrl(url);
    if (!safe || safe.length > IMAGE_URL_MAX) {
      return { ok: false, error: "An image needs a plain http(s) link" };
    }

    const site = await getSiteForUser(siteId);
    const current = safeParseSiteDocument(readJson(site.document));
    if (!current) {
      return { ok: false, error: "The draft is not a valid site document" };
    }

    const next = applyAssetToDocument(current, target, safe);
    if (next === current) {
      return { ok: false, error: "That placement no longer exists" };
    }

    const result = await saveDraft(siteId, next);
    if (!result.ok) return result;

    // `saveDraft` records *what* moved as a document diff; this pair records
    // *why* — which image, which placement (Art. III.3). The owner is the
    // caller: `getSiteForUser` has already refused everyone else.
    const userId = site.workspace.ownerId;
    await writeAudit({
      userId,
      siteId: site.id,
      action: "asset.apply",
      after: JSON.stringify({ url: safe, target }),
    });
    await logEvent({
      userId,
      siteId: site.id,
      type: "asset_applied",
      data: { url: safe, target },
    });

    // The editor now has a different draft; the library's own placement list is
    // also stale whenever the apply created a hero section, so both routes are
    // refreshed — matching `generate/actions.ts`, which revalidates its own page
    // alongside the editor's.
    revalidatePath(`/studio/${siteId}`);
    revalidatePath(`/studio/${siteId}/assets`);
    return { ok: true };
  });
}
