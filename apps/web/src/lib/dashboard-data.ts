import "server-only";
import { prisma } from "@plink/db";
import { DEFAULT_THEME, type ThemeShape } from "@plink/core/themes";
import type { EditorData } from "@plink/core/editor-types";

export function themeFromRow(row: {
  presetId: string; bgType: string; bgColor: string; bgColorTwo: string;
  bgImageUrl: string | null; bgPattern: string; textColor: string; mutedColor: string;
  accentColor: string; buttonStyle: string; buttonRadius: string; buttonColor: string;
  buttonTextColor: string; buttonEffect: string; fontFamily: string; avatarShape: string;
  hideBranding: boolean;
} | null): ThemeShape {
  if (!row) return DEFAULT_THEME;
  return {
    presetId: row.presetId,
    bgType: row.bgType,
    bgColor: row.bgColor,
    bgColorTwo: row.bgColorTwo,
    bgImageUrl: row.bgImageUrl,
    bgPattern: row.bgPattern,
    textColor: row.textColor,
    mutedColor: row.mutedColor,
    accentColor: row.accentColor,
    buttonStyle: row.buttonStyle,
    buttonRadius: row.buttonRadius,
    buttonColor: row.buttonColor,
    buttonTextColor: row.buttonTextColor,
    buttonEffect: row.buttonEffect,
    fontFamily: row.fontFamily,
    avatarShape: row.avatarShape,
    hideBranding: row.hideBranding,
  };
}

export async function loadEditorData(userId: string): Promise<EditorData | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      theme: true,
      blocks: { orderBy: { position: "asc" } },
      socials: { orderBy: { position: "asc" } },
      products: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!user) return null;

  return {
    profile: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      bannerUrl: user.bannerUrl,
      verified: user.verified,
      category: user.category,
      location: user.location,
      plan: user.plan,
    },
    theme: themeFromRow(user.theme),
    blocks: user.blocks.map((b) => ({
      id: b.id,
      type: b.type,
      title: b.title,
      subtitle: b.subtitle,
      url: b.url,
      imageUrl: b.imageUrl,
      config: b.config,
      visible: b.visible,
      highlight: b.highlight,
      clicks: b.clicks,
      startsAt: b.startsAt?.toISOString() ?? null,
      endsAt: b.endsAt?.toISOString() ?? null,
    })),
    socials: user.socials.map((s) => ({ id: s.id, platform: s.platform, url: s.url })),
    products: user.products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      priceCents: p.priceCents,
      currency: p.currency,
      imageUrl: p.imageUrl,
      type: p.type,
    })),
  };
}
