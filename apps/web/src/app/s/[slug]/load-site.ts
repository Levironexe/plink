import { prisma } from "@plink/db";
import { safeParseSiteDocument, type SiteDocument } from "@plink/core/site-schema";

export type PublishedSite = {
  name: string;
  slug: string;
  document: SiteDocument;
};

/**
 * The public loading rule, shared by both `/s/[slug]` routes.
 *
 * Only a published site renders, and only its published SiteVersion snapshot —
 * never `Site.document`, which is the working draft and must not leak. Every
 * failure (missing site, draft status, no published version, unparseable or
 * invalid JSON) collapses to null; the routes turn null into `notFound()`, so
 * a bad row can never break the page with anything worse than a 404.
 */
export async function loadPublishedSite(slug: string): Promise<PublishedSite | null> {
  const site = await prisma.site.findUnique({
    where: { slug },
    select: { name: true, slug: true, status: true, publishedVersionId: true },
  });
  if (!site || site.status !== "published" || !site.publishedVersionId) return null;

  const version = await prisma.siteVersion.findUnique({
    where: { id: site.publishedVersionId },
    select: { document: true },
  });
  if (!version) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(version.document);
  } catch {
    return null;
  }
  const document = safeParseSiteDocument(raw);
  if (!document) return null;

  return { name: site.name, slug: site.slug, document };
}
