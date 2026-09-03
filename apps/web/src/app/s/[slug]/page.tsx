import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteRenderer } from "@/components/site/site-renderer";
import { siteDescription } from "@/components/site/site-model";
import { loadPublishedSite } from "./load-site";

type Params = { params: Promise<{ slug: string }> };

// A re-publish must show immediately — same rule as the profile page.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await loadPublishedSite(slug);
  if (!loaded) return { title: "Site not found" };

  const title = loaded.name;
  const description = siteDescription(loaded.document) || `${loaded.name}, made with Plink.`;
  return {
    title,
    description,
    alternates: { canonical: `/s/${loaded.slug}` },
    openGraph: { title, description, url: `/s/${loaded.slug}`, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SiteRootPage({ params }: Params) {
  const { slug } = await params;
  const loaded = await loadPublishedSite(slug);
  if (!loaded) notFound();

  return (
    <SiteRenderer document={loaded.document} mode="live" basePath={`/s/${loaded.slug}`} path="/" />
  );
}
