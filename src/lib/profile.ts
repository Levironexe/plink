import "server-only";
import { prisma } from "@/lib/prisma";
import { DEFAULT_THEME, type ThemeShape } from "@/lib/themes";
import { DEMO_BY_USERNAME } from "@/lib/demo-profiles";
import type { PublicProfile } from "@/components/profile/types";

export async function loadPublicProfile(username: string): Promise<PublicProfile | null> {
  const clean = username.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { username: clean },
    include: {
      theme: true,
      blocks: { where: { visible: true }, orderBy: { position: "asc" } },
      socials: { orderBy: { position: "asc" } },
      products: { where: { published: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!user) return DEMO_BY_USERNAME.get(clean) ?? null;

  const theme: ThemeShape = user.theme
    ? {
        presetId: user.theme.presetId,
        bgType: user.theme.bgType,
        bgColor: user.theme.bgColor,
        bgColorTwo: user.theme.bgColorTwo,
        bgImageUrl: user.theme.bgImageUrl,
        bgPattern: user.theme.bgPattern,
        textColor: user.theme.textColor,
        mutedColor: user.theme.mutedColor,
        accentColor: user.theme.accentColor,
        buttonStyle: user.theme.buttonStyle,
        buttonRadius: user.theme.buttonRadius,
        buttonColor: user.theme.buttonColor,
        buttonTextColor: user.theme.buttonTextColor,
        fontFamily: user.theme.fontFamily,
        avatarShape: user.theme.avatarShape,
        hideBranding: user.theme.hideBranding,
      }
    : DEFAULT_THEME;

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    bannerUrl: user.bannerUrl,
    verified: user.verified,
    category: user.category,
    location: user.location,
    theme,
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

export function isDemoId(id: string) {
  return id.startsWith("demo-");
}
