"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@plink/db";
import { getCurrentUser } from "@/lib/auth";
import { baseSlug, requireSite, requireWorkspace, resolveTemplate, uniqueSlug, validateBrief } from "@/lib/workspace";
import { emptyBrief, emptySiteDocument } from "@plink/core/site-schema";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; field?: string };

async function requireUserId() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user.id;
}

/**
 * Direct audit write — Feature D's `writeAudit` helper replaces these call
 * sites later; the action strings below are frozen because rows already
 * reference them.
 */
async function audit(entry: { userId: string; siteId?: string; action: string; after?: string }) {
  await prisma.auditLog.create({ data: entry });
}

/** Prisma unique-constraint violation — the slug lost a race. */
function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

/* -------------------------------------------------------------- workspaces */

export async function createWorkspace(name: string): Promise<ActionResult<{ id: string; slug: string }>> {
  const userId = await requireUserId();

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Give the workspace a name", field: "name" };
  if (trimmed.length > 120) return { ok: false, error: "That name is too long", field: "name" };

  const slug = await uniqueSlug(baseSlug(trimmed, "workspace"), async (candidate) => {
    const existing = await prisma.workspace.findUnique({ where: { slug: candidate }, select: { id: true } });
    return existing !== null;
  });

  try {
    const workspace = await prisma.workspace.create({
      data: { ownerId: userId, name: trimmed, slug },
      select: { id: true, slug: true },
    });

    await audit({
      userId,
      action: "workspace.create",
      after: JSON.stringify({ workspaceId: workspace.id, name: trimmed, slug }),
    });

    revalidatePath("/studio");
    return { ok: true, data: workspace };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "That name is taken — try again", field: "name" };
    throw error;
  }
}

/* ------------------------------------------------------------------- sites */

const createSiteSchema = z.object({
  name: z.string().trim().min(1, "Give the site a name").max(120, "That name is too long"),
  template: z.string().max(40).default(""),
  clientName: z.string().trim().max(120, "Client name is too long").optional(),
  clientEmail: z
    .union([z.literal(""), z.string().email("Enter a valid client email")])
    .optional(),
});

export async function createSite(
  workspaceId: string,
  input: { name: string; template: string; clientName?: string; clientEmail?: string },
): Promise<ActionResult<{ id: string; slug: string }>> {
  const { userId, workspace } = await requireWorkspace(workspaceId);

  const parsed = createSiteSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "Check the details", field: issue?.path.join(".") };
  }

  const template = resolveTemplate(parsed.data.template);
  const slug = await uniqueSlug(baseSlug(parsed.data.name), async (candidate) => {
    const existing = await prisma.site.findUnique({ where: { slug: candidate }, select: { id: true } });
    return existing !== null;
  });

  try {
    const site = await prisma.site.create({
      data: {
        workspaceId: workspace.id,
        name: parsed.data.name,
        slug,
        template,
        document: JSON.stringify(emptySiteDocument(template)),
        clientName: parsed.data.clientName ?? "",
        clientEmail: parsed.data.clientEmail ?? "",
        // Every site starts with an empty brief so intake always has a row.
        brief: { create: { data: JSON.stringify(emptyBrief()) } },
      },
      select: { id: true, slug: true },
    });

    await audit({
      userId,
      siteId: site.id,
      action: "site.create",
      after: JSON.stringify({ workspaceId: workspace.id, name: parsed.data.name, slug, template }),
    });

    revalidatePath("/studio");
    return { ok: true, data: site };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "That name is taken — try again", field: "name" };
    throw error;
  }
}

/* ------------------------------------------------------------------- brief */

export async function saveBrief(siteId: string, data: unknown): Promise<ActionResult> {
  const { site, userId } = await requireSite(siteId);

  // A Server Action is a public endpoint — the payload is unknown until the
  // schema says otherwise (constitution Art. I).
  const brief = validateBrief(data);
  if (!brief.ok) return { ok: false, error: brief.error };

  const json = JSON.stringify(brief.data);
  await prisma.brief.upsert({
    where: { siteId: site.id },
    create: { siteId: site.id, data: json, status: "draft" },
    update: { data: json, status: "draft" },
  });

  await audit({ userId, siteId: site.id, action: "brief.save", after: json });

  revalidatePath("/studio");
  revalidatePath(`/studio/brief/${site.id}`);
  return { ok: true };
}

export async function submitBrief(siteId: string): Promise<ActionResult> {
  const { site, userId } = await requireSite(siteId);

  await prisma.brief.upsert({
    where: { siteId: site.id },
    create: { siteId: site.id, data: JSON.stringify(emptyBrief()), status: "submitted" },
    update: { status: "submitted" },
  });

  await audit({ userId, siteId: site.id, action: "brief.submit", after: JSON.stringify({ status: "submitted" }) });

  revalidatePath("/studio");
  revalidatePath(`/studio/brief/${site.id}`);
  return { ok: true };
}
