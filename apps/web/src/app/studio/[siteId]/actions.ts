"use server";

import { revalidatePath } from "next/cache";
import {
  getSiteForUser,
  listVersions,
  publishSite,
  rollbackSite,
  saveDraft,
} from "@/lib/site-store";
import { safeParseSiteDocument, SITE_TEMPLATES } from "@plink/core/site-schema";

/**
 * The studio editor's server boundary. Thin wrappers over
 * `@/lib/site-store` — the store owns ownership checks, document validation,
 * version numbering, audit rows and event rows; nothing here duplicates any of
 * that (constitution III.3).
 *
 * A Server Action is a public endpoint (Art. I.2): every argument arrives
 * untrusted. `document` is passed through as `unknown` so the store's
 * `parseSiteDocument` is the single validator, `template` is checked against
 * `SITE_TEMPLATES` before use, and `siteId` is only ever meaningful after
 * `requireSiteAccess` inside the store has matched it to the caller.
 */

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; field?: string };

/** `VersionSummary` with `createdAt` as ISO — nothing depends on a Date crossing the wire. */
export type VersionRow = {
  id: string;
  number: number;
  note: string;
  createdAt: string;
  isPublished: boolean;
};

const ACCESS_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Sign in to edit this site",
  FORBIDDEN: "This site belongs to another account",
  NOT_FOUND: "This site no longer exists",
};

/**
 * Turns the store's thrown access errors into `ActionResult` failures. The
 * store deliberately throws for access and returns for domain failures; the
 * studio wants one channel, and an ordinary "you don't own this" must never
 * surface to the operator as a 500.
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

/* ------------------------------------------------------------------ draft */

/** Autosave. The document is `unknown` by design — the store validates it. */
export async function saveSiteDraft(siteId: string, document: unknown): Promise<ActionResult> {
  return withStore(async () => saveDraft(siteId, document));
}

/**
 * Swap the template without touching anything else. The stored draft is
 * re-read rather than taking a document from the caller, so a switch can never
 * roll back concurrent edits to an older client-side body.
 */
export async function switchTemplate(siteId: string, template: string): Promise<ActionResult> {
  return withStore(async () => {
    if (!(SITE_TEMPLATES as readonly string[]).includes(template)) {
      return { ok: false, error: "That template does not exist" };
    }

    const site = await getSiteForUser(siteId);
    const current = safeParseSiteDocument(readJson(site.document));
    if (!current) {
      return { ok: false, error: "The draft is not a valid site document" };
    }
    if (current.template === template) return { ok: true };

    const result = await saveDraft(siteId, { ...current, template });
    if (result.ok) revalidatePath(`/studio/${siteId}`);
    return result;
  });
}

function readJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------ publish & history */

export async function publish(
  siteId: string,
  note?: string,
): Promise<ActionResult<{ versionNumber: number }>> {
  return withStore(async () => {
    const result = await publishSite(siteId, (note ?? "").trim().slice(0, 200));
    if (!result.ok) return { ok: false, error: result.error };

    revalidatePath("/studio");
    revalidatePath(`/studio/${siteId}`);
    return { ok: true, data: { versionNumber: result.versionNumber } };
  });
}

/**
 * Restore version `number`. The store publishes the restored snapshot as a
 * brand-new version rather than rewinding history, so the returned number is
 * the *new* one — not the one that was restored.
 */
export async function rollback(
  siteId: string,
  number: number,
): Promise<ActionResult<{ versionNumber: number }>> {
  return withStore(async () => {
    if (!Number.isInteger(number) || number < 1) {
      return { ok: false, error: "That version number is not valid" };
    }

    const result = await rollbackSite(siteId, number);
    if (!result.ok) return { ok: false, error: result.error };

    revalidatePath("/studio");
    revalidatePath(`/studio/${siteId}`);
    return { ok: true, data: { versionNumber: result.versionNumber } };
  });
}

export async function versions(siteId: string): Promise<ActionResult<VersionRow[]>> {
  return withStore(async () => {
    const rows = await listVersions(siteId);
    return {
      ok: true,
      data: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    };
  });
}
