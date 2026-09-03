import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@plink/db";
import { aiEnabled } from "@plink/ai";
import { ASSET_KINDS, ASSET_PROMPT_MAX, type AssetKind } from "@plink/ai/assets";
import { requireSite } from "@/lib/workspace";
import { PageHeader } from "../../_components/primitives";
import { AssetStudio, type AssetSummary } from "./_components/asset-studio";

type Params = { params: Promise<{ siteId: string }> };

export const metadata: Metadata = {
  title: "Assets · Plink",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** `Asset.meta` is a JSON string column; anything unreadable falls back. */
function assetKindFrom(meta: string): AssetKind {
  try {
    const parsed: unknown = JSON.parse(meta || "{}");
    const value = (parsed as { assetKind?: unknown } | null)?.assetKind;
    return ASSET_KINDS.includes(value as AssetKind) ? (value as AssetKind) : "hero";
  } catch {
    return "hero";
  }
}

export default async function AssetsPage({ params }: Params) {
  const { siteId } = await params;

  let site: { id: string; name: string };
  try {
    site = (await requireSite(siteId)).site;
  } catch (error) {
    // A signed-out visitor gets the login page; everyone else gets a 404, so a
    // probe can never learn whether another tenant's site exists (Art. I.1).
    if (error instanceof Error && error.message === "UNAUTHENTICATED") redirect("/login");
    notFound();
  }

  const rows = await prisma.asset.findMany({
    where: { siteId: site.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, kind: true, url: true, mimeType: true, prompt: true, meta: true, createdAt: true },
  });

  const assets: AssetSummary[] = rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    assetKind: assetKindFrom(row.meta),
    url: row.url,
    mimeType: row.mimeType,
    prompt: row.prompt,
    createdAt: row.createdAt.toISOString(),
  }));

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="mb-4">
        <Link href="/studio" className="text-[13px] tracking-[-0.01em] text-ink-muted transition-colors hover:text-ink">
          ← Back to studio
        </Link>
      </div>

      <PageHeader
        title={`Assets — ${site.name}`}
        description="Describe a hero, banner or thumbnail and the generator draws it. Everything you make stays in this site's library."
      />

      <div className="mt-8">
        {/* The kind list and the prompt ceiling cross the boundary as data, so
            the client bundle never imports the AI SDK. */}
        <AssetStudio
          siteId={site.id}
          initialAssets={assets}
          configured={aiEnabled()}
          kinds={ASSET_KINDS}
          promptMax={ASSET_PROMPT_MAX}
        />
      </div>
    </main>
  );
}
