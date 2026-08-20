"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@plink/db";
import { createSession, getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { blockDefinition, BLOCK_LIBRARY } from "@plink/core/blocks";
import { isReservedUsername, slugifyUsername } from "@plink/core/utils";
import { DEMO_BY_USERNAME } from "@plink/core/demo-profiles";
import { profileSchema } from "@plink/core/validation";
import { socialPlatform } from "@plink/core/socials";
import { THEME_PRESETS } from "@plink/core/themes";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; field?: string };

async function requireUserId() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user.id;
}

/** The columns `Theme` actually has — guards the AI-generated theme write. */
const DEFAULT_THEME_KEYS = {
  presetId: 1, bgType: 1, bgColor: 1, bgColorTwo: 1, bgImageUrl: 1, bgPattern: 1,
  textColor: 1, mutedColor: 1, accentColor: 1, buttonStyle: 1, buttonRadius: 1,
  buttonColor: 1, buttonTextColor: 1, fontFamily: 1, avatarShape: 1, hideBranding: 1,
} as const;

function revalidateAll(username?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/appearance");
  revalidatePath("/dashboard/analytics");
  if (username) revalidatePath(`/${username}`);
}

/* ---------------------------------------------------------------- ai build */

/**
 * Replaces the page with an AI-generated proposal the creator has explicitly
 * accepted. The payload is already sanitised by `sanitizeGeneratedPage`, but we
 * re-validate here because a Server Action is a public endpoint.
 */
const generatedPageSchema = z.object({
  profile: z.object({
    displayName: z.string().trim().max(60),
    bio: z.string().trim().max(300),
    category: z.string().trim().max(60),
  }),
  theme: z.record(z.string(), z.unknown()),
  blocks: z
    .array(
      z.object({
        type: z.string(),
        title: z.string().max(200),
        subtitle: z.string().max(300),
        url: z.string().max(2000),
        config: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .max(12),
});

export async function applyGeneratedPage(
  input: z.input<typeof generatedPageSchema>,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = generatedPageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That page couldn’t be applied" };

  const { profile, theme, blocks } = parsed.data;

  // Only block types the app can actually render survive.
  const safeBlocks = blocks.filter((b) => blockDefinition(b.type));

  const themeData = Object.fromEntries(
    Object.entries(theme).filter(([k, v]) => k in DEFAULT_THEME_KEYS && v !== undefined),
  );

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        displayName: profile.displayName || undefined,
        bio: profile.bio,
        category: profile.category || null,
      },
    });

    await tx.theme.upsert({
      where: { userId },
      create: { userId, ...themeData },
      update: themeData,
    });

    // Replacing wholesale is what the creator accepted in the preview.
    await tx.block.deleteMany({ where: { userId } });
    if (safeBlocks.length > 0) {
      await tx.block.createMany({
        data: safeBlocks.map((b, i) => ({
          userId,
          type: b.type,
          title: b.title,
          subtitle: b.subtitle,
          url: b.url,
          config: JSON.stringify(b.config ?? {}),
          position: i,
        })),
      });
    }
  });

  revalidateAll();
  return { ok: true };
}

/* ------------------------------------------------------------------ blocks */

export async function createBlock(type: string): Promise<ActionResult<{ id: string }>> {
  const userId = await requireUserId();
  const def = blockDefinition(type) ?? BLOCK_LIBRARY[0];

  const last = await prisma.block.findFirst({
    where: { userId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const block = await prisma.block.create({
    data: {
      userId,
      type: def.type,
      title: def.defaults.title ?? "",
      subtitle: def.defaults.subtitle ?? "",
      url: def.defaults.url ?? "",
      config: JSON.stringify(def.defaults.config ?? {}),
      position: (last?.position ?? -1) + 1,
    },
    select: { id: true },
  });

  revalidateAll();
  return { ok: true, data: block };
}

const updateBlockSchema = z.object({
  title: z.string().max(160).optional(),
  subtitle: z.string().max(400).optional(),
  url: z.string().max(600).optional(),
  imageUrl: z.string().max(600).nullable().optional(),
  config: z.string().max(8000).optional(),
  visible: z.boolean().optional(),
  highlight: z.boolean().optional(),
  // Either bound may be cleared back to an open window with null.
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
});

export async function updateBlock(
  id: string,
  data: z.input<typeof updateBlockSchema>,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = updateBlockSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: "That value is too long" };

  const result = await prisma.block.updateMany({
    where: { id, userId },
    data: parsed.data,
  });
  if (result.count === 0) return { ok: false, error: "Block not found" };

  revalidateAll();
  return { ok: true };
}

export async function deleteBlock(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  await prisma.block.deleteMany({ where: { id, userId } });
  revalidateAll();
  return { ok: true };
}

export async function duplicateBlock(id: string): Promise<ActionResult<{ id: string }>> {
  const userId = await requireUserId();
  const source = await prisma.block.findFirst({ where: { id, userId } });
  if (!source) return { ok: false, error: "Block not found" };

  await prisma.block.updateMany({
    where: { userId, position: { gt: source.position } },
    data: { position: { increment: 1 } },
  });

  const copy = await prisma.block.create({
    data: {
      userId,
      type: source.type,
      title: source.title,
      subtitle: source.subtitle,
      url: source.url,
      imageUrl: source.imageUrl,
      config: source.config,
      visible: source.visible,
      highlight: source.highlight,
      position: source.position + 1,
    },
    select: { id: true },
  });

  revalidateAll();
  return { ok: true, data: copy };
}

export async function reorderBlocks(orderedIds: string[]): Promise<ActionResult> {
  const userId = await requireUserId();
  const owned = await prisma.block.findMany({ where: { userId }, select: { id: true } });
  const ownedIds = new Set(owned.map((b) => b.id));
  const clean = orderedIds.filter((id) => ownedIds.has(id));

  await prisma.$transaction(
    clean.map((id, index) =>
      prisma.block.update({ where: { id }, data: { position: index } }),
    ),
  );

  revalidateAll();
  return { ok: true };
}

/* ------------------------------------------------------------------- theme */

const themeSchema = z.object({
  presetId: z.string().max(40).optional(),
  bgType: z.string().max(20).optional(),
  bgColor: z.string().max(30).optional(),
  bgColorTwo: z.string().max(30).optional(),
  bgImageUrl: z.string().max(600).nullable().optional(),
  bgPattern: z.string().max(20).optional(),
  textColor: z.string().max(30).optional(),
  mutedColor: z.string().max(30).optional(),
  accentColor: z.string().max(30).optional(),
  buttonStyle: z.string().max(20).optional(),
  buttonRadius: z.string().max(20).optional(),
  buttonColor: z.string().max(30).optional(),
  buttonTextColor: z.string().max(30).optional(),
  fontFamily: z.string().max(20).optional(),
  avatarShape: z.string().max(20).optional(),
  hideBranding: z.boolean().optional(),
});

export async function updateTheme(data: z.input<typeof themeSchema>): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = themeSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: "Invalid theme value" };

  await prisma.theme.upsert({
    where: { userId },
    create: { userId, ...parsed.data },
    update: parsed.data,
  });

  revalidateAll();
  return { ok: true };
}

/* ----------------------------------------------------------------- profile */

export async function updateProfile(data: z.input<typeof profileSchema>): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = profileSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your details" };
  }
  await prisma.user.update({ where: { id: userId }, data: parsed.data });
  revalidateAll();
  return { ok: true };
}

export async function completeOnboarding(data: {
  displayName: string;
  bio: string;
  category: string | null;
  avatarUrl: string | null;
  presetId: string;
  links: { title: string; url: string }[];
  socials: { platform: string; url: string }[];
}): Promise<ActionResult> {
  const userId = await requireUserId();

  const profile = profileSchema.safeParse({
    displayName: data.displayName,
    bio: data.bio,
    category: data.category,
    avatarUrl: data.avatarUrl,
  });
  if (!profile.success) {
    return { ok: false, error: profile.error.issues[0]?.message ?? "Check your details" };
  }

  const links = data.links.filter((l) => l.title.trim() && l.url.trim()).slice(0, 10);
  const socials = data.socials.filter((s) => s.url.trim() && socialPlatform(s.platform)).slice(0, 14);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { ...profile.data, onboarded: true },
    });

    await tx.block.deleteMany({ where: { userId } });
    await tx.socialLink.deleteMany({ where: { userId } });

    await tx.block.createMany({
      data: [
        ...links.map((l, i) => ({
          userId,
          type: "link",
          title: l.title.trim(),
          url: l.url.trim(),
          position: i,
        })),
        ...(socials.length > 0
          ? [{ userId, type: "socials", title: "", position: links.length }]
          : []),
      ],
    });

    if (socials.length > 0) {
      await tx.socialLink.createMany({
        data: socials.map((s, i) => ({
          userId,
          platform: s.platform,
          url: socialPlatform(s.platform)!.toUrl(s.url.trim()),
          position: i,
        })),
      });
    }

    await tx.theme.upsert({
      where: { userId },
      create: { userId, presetId: data.presetId },
      update: { presetId: data.presetId },
    });
  });

  // Apply the chosen preset's values on top of the row we just wrote.
  const preset = THEME_PRESETS.find((p) => p.id === data.presetId);
  if (preset) {
    await prisma.theme.update({ where: { userId }, data: { ...preset.values, presetId: preset.id } });
  }

  revalidateAll();
  return { ok: true };
}

/* ----------------------------------------------------------------- socials */

const socialSchema = z.object({
  platform: z.string().min(1).max(40),
  url: z.string().min(1).max(500),
});

export async function addSocial(data: z.input<typeof socialSchema>): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = socialSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: "Add a handle or link" };

  const platform = socialPlatform(parsed.data.platform);
  if (!platform) return { ok: false, error: "Unknown platform" };

  const existing = await prisma.socialLink.findFirst({
    where: { userId, platform: parsed.data.platform },
    select: { id: true },
  });
  const url = platform.toUrl(parsed.data.url);

  if (existing) {
    await prisma.socialLink.update({ where: { id: existing.id }, data: { url } });
  } else {
    const count = await prisma.socialLink.count({ where: { userId } });
    await prisma.socialLink.create({
      data: { userId, platform: parsed.data.platform, url, position: count },
    });
  }

  revalidateAll();
  return { ok: true };
}

export async function deleteSocial(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  await prisma.socialLink.deleteMany({ where: { id, userId } });
  revalidateAll();
  return { ok: true };
}

/* ---------------------------------------------------------------- products */

const productSchema = z.object({
  name: z.string().min(1, "Give your product a name").max(120),
  description: z.string().max(600).optional(),
  priceCents: z.number().int().min(0).max(10_000_00),
  currency: z.string().length(3).optional(),
  imageUrl: z.string().max(600).nullable().optional(),
  fileUrl: z.string().max(600).nullable().optional(),
  type: z.string().max(20).optional(),
  published: z.boolean().optional(),
});

export async function createProduct(data: z.input<typeof productSchema>): Promise<ActionResult<{ id: string }>> {
  const userId = await requireUserId();
  const parsed = productSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details" };

  const product = await prisma.product.create({
    data: { userId, ...parsed.data },
    select: { id: true },
  });
  revalidateAll();
  return { ok: true, data: product };
}

export async function updateProduct(
  id: string,
  data: z.input<typeof productSchema>,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = productSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details" };

  const result = await prisma.product.updateMany({ where: { id, userId }, data: parsed.data });
  if (result.count === 0) return { ok: false, error: "Product not found" };

  revalidateAll();
  return { ok: true };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  await prisma.product.deleteMany({ where: { id, userId } });
  revalidateAll();
  return { ok: true };
}

/* --------------------------------------------------------------- audience */

export async function deleteSubscriber(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  await prisma.subscriber.deleteMany({ where: { id, userId } });
  revalidatePath("/dashboard/audience");
  return { ok: true };
}

/* --------------------------------------------------------------- mediakit */

const mediaKitSchema = z.object({
  headline: z.string().max(160).optional(),
  about: z.string().max(1200).optional(),
  rateCard: z.string().max(6000).optional(),
  audience: z.string().max(4000).optional(),
  brands: z.string().max(2000).optional(),
  published: z.boolean().optional(),
});

export async function updateMediaKit(data: z.input<typeof mediaKitSchema>): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = mediaKitSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: "That entry is too long" };

  await prisma.mediaKit.upsert({
    where: { userId },
    create: { userId, ...parsed.data },
    update: parsed.data,
  });
  revalidatePath("/dashboard/media-kit");
  return { ok: true };
}

/* --------------------------------------------------------------- settings */

export async function changeUsername(raw: string): Promise<ActionResult<{ username: string }>> {
  const userId = await requireUserId();
  const username = slugifyUsername(raw);

  if (username.length < 3) return { ok: false, error: "At least 3 characters", field: "username" };
  if (isReservedUsername(username) || DEMO_BY_USERNAME.has(username)) {
    return { ok: false, error: "That name is reserved", field: "username" };
  }

  const taken = await prisma.user.findFirst({
    where: { username, NOT: { id: userId } },
    select: { id: true },
  });
  if (taken) return { ok: false, error: "That name is taken", field: "username" };

  await prisma.user.update({ where: { id: userId }, data: { username } });
  revalidateAll(username);
  return { ok: true, data: { username } };
}

export async function changePassword(current: string, next: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (next.length < 8) return { ok: false, error: "New password must be at least 8 characters", field: "next" };

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user) return { ok: false, error: "Account not found" };

  if (!(await verifyPassword(current, user.passwordHash))) {
    return { ok: false, error: "Current password is incorrect", field: "current" };
  }

  const passwordHash = await hashPassword(next);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    // Changing a password should sign out every other device.
    prisma.session.deleteMany({ where: { userId } }),
  ]);
  await createSession(userId);

  return { ok: true };
}

export async function changePlan(plan: "free" | "pro" | "vip"): Promise<ActionResult> {
  const userId = await requireUserId();
  await prisma.user.update({ where: { id: userId }, data: { plan } });
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function deleteAccount(): Promise<ActionResult> {
  const userId = await requireUserId();
  await prisma.user.delete({ where: { id: userId } });
  return { ok: true };
}
