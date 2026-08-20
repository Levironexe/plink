import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { DEMO_PROFILES } from "@/lib/demo-profiles";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = ["", "/pricing", "/templates", "/explore", "/terms", "/privacy"].map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));

  let creators: { username: string; updatedAt: Date }[] = [];
  try {
    creators = await prisma.user.findMany({
      where: { onboarded: true },
      select: { username: true, updatedAt: true },
      take: 5000,
    });
  } catch {
    // A sitemap should never take the build down.
  }

  const demoRoutes = DEMO_PROFILES.map((p) => ({
    url: `${siteUrl}/${p.username}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  return [
    ...staticRoutes,
    ...creators.map((c) => ({
      url: `${siteUrl}/${c.username}`,
      lastModified: c.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
    ...demoRoutes,
  ];
}
