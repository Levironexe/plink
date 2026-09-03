import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@plink/db";
import { getSessionUserId } from "@/lib/auth";
import { parseBriefJson } from "@/lib/workspace";
import { PageHeader, StatusBadge } from "../../_components/primitives";
import { BriefForm } from "./_components/brief-form";

type Params = { params: Promise<{ siteId: string }> };

export const metadata: Metadata = {
  title: "Brief · Plink",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function BriefPage({ params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const { siteId } = await params;
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      workspace: { select: { ownerId: true, name: true } },
      brief: { select: { data: true, status: true } },
    },
  });
  // Missing and foreign sites are indistinguishable — both 404 (Art. I).
  if (!site || site.workspace.ownerId !== userId) notFound();

  const brief = parseBriefJson(site.brief?.data);
  const status = site.brief?.status ?? "draft";

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-4">
        <Link href="/studio" className="text-[13px] tracking-[-0.01em] text-ink-muted transition-colors hover:text-ink">
          ← Back to studio
        </Link>
      </div>

      <PageHeader
        title={`Brief — ${site.name}`}
        description={`Everything the site build needs from ${site.clientName || "the client"}, in one structured intake.`}
        actions={<StatusBadge status={status} />}
      />

      <div className="mt-8">
        <BriefForm siteId={site.id} initial={brief} status={status} />
      </div>
    </main>
  );
}
