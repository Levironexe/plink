import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteRenderer } from "@/components/site/site-renderer";
import { pathFromSegments, resolveSitePage, siteDescription } from "@/components/site/site-model";
import { loadPublishedSite } from "../load-site";

type Params = { params: Promise<{ slug: string; path: string[] }> };

// A re-publish must show immediately — same rule as the profile page.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, path } = await params;
  const loaded = await loadPublishedSite(slug);
  if (!loaded) return { title: "Site not found" };

  const page = resolveSitePage(loaded.document, path);
  if (!page) return { title: "Page not found" };

  const title = `${page.title} · ${loaded.name}`;
  const description = siteDescription(loaded.document) || `${loaded.name}, made with Plink.`;
  const url = `/s/${loaded.slug}${pathFromSegments(path)}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SiteSubPage({ params }: Params) {
  const { slug, path } = await params;
  const loaded = await loadPublishedSite(slug);
  if (!loaded) notFound();

  // Unknown paths 404 here, before the renderer's root-page fallback can hide them.
  const page = resolveSitePage(loaded.document, path);
  if (!page) notFound();

  return (
    <SiteRenderer
      document={loaded.document}
      mode="live"
      basePath={`/s/${loaded.slug}`}
      path={pathFromSegments(path)}
    />
  );
}
