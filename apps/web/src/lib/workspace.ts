/**
 * Tenancy guards and pure helpers for the studio (agency) layer.
 *
 * `requireWorkspace` / `requireSite` are the single ownership chokepoint —
 * every studio action, page, and API route reads or writes through them
 * (constitution Article I). "Not found" and "not owned" both throw FORBIDDEN
 * so a probing request can never learn whether another tenant's row exists.
 *
 * The pure pieces (slugs, template fallback, brief validation) live here too
 * so unit tests can exercise them with `@plink/db` and `@/lib/auth` mocked.
 */

import { prisma, type Site } from "@plink/db";
import { getSessionUserId } from "@/lib/auth";
import {
  briefSchema,
  emptyBrief,
  SITE_TEMPLATES,
  type BriefData,
  type SiteTemplateId,
} from "@plink/core/site-schema";

/* ------------------------------------------------------------------- slugs */

/**
 * Lowercase, dash-separated slug from a human name. Empty input (or input
 * with no usable characters) falls back to the given noun so a slug is never
 * blank — uniqueness suffixing handles the rest.
 */
export function baseSlug(input: string, fallback = "site"): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/, "");
  return slug || fallback;
}

/**
 * First free slug: the base itself, then `base-2`, `base-3`, … The taken
 * probe is injected so this stays pure; callers hand it a unique-column
 * lookup. The final fallback can't realistically be reached but guarantees
 * termination.
 */
export async function uniqueSlug(
  base: string,
  isTaken: (slug: string) => boolean | Promise<boolean>,
): Promise<string> {
  if (!(await isTaken(base))) return base;
  for (let n = 2; n <= 500; n++) {
    const candidate = `${base}-${n}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/* --------------------------------------------------------------- templates */

/** Unknown or missing template ids quietly become the default template. */
export function resolveTemplate(input: string): SiteTemplateId {
  return (SITE_TEMPLATES as readonly string[]).includes(input)
    ? (input as SiteTemplateId)
    : "editorial";
}

/* ------------------------------------------------------------------- brief */

/**
 * Gate for brief payloads at the server boundary. A Server Action is a public
 * endpoint, so the wild `unknown` is never trusted past this point.
 */
export function validateBrief(
  data: unknown,
): { ok: true; data: BriefData } | { ok: false; error: string } {
  const parsed = briefSchema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".");
    return { ok: false, error: path ? `${path}: ${issue.message}` : (issue?.message ?? "Invalid brief") };
  }
  return { ok: true, data: parsed.data };
}

/** Stored `Brief.data` JSON → BriefData; anything unusable becomes a fresh brief. */
export function parseBriefJson(raw: string | null | undefined): BriefData {
  if (!raw) return emptyBrief();
  try {
    const parsed = briefSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : emptyBrief();
  } catch {
    return emptyBrief();
  }
}

/* ------------------------------------------------------------------ guards */

export type WorkspaceContext = {
  workspace: { id: string; ownerId: string; name: string; slug: string };
  userId: string;
};

export async function requireWorkspace(workspaceId: string): Promise<WorkspaceContext> {
  const userId = await getSessionUserId();
  if (!userId) throw new Error("UNAUTHENTICATED");

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, ownerId: true, name: true, slug: true },
  });
  if (!workspace || workspace.ownerId !== userId) throw new Error("FORBIDDEN");

  return { workspace, userId };
}

export async function requireSite(siteId: string): Promise<{ site: Site; userId: string }> {
  const userId = await getSessionUserId();
  if (!userId) throw new Error("UNAUTHENTICATED");

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { workspace: { select: { ownerId: true } } },
  });
  if (!site || site.workspace.ownerId !== userId) throw new Error("FORBIDDEN");

  return { site, userId };
}
