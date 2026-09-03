import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { prisma } from "@plink/db";
import { ButtonLink } from "@plink/ui/button";
import { getSessionUserId } from "@/lib/auth";
import { parseBriefJson, requireSite, resolveTemplate } from "@/lib/workspace";
import { aiEnabled } from "@plink/ai";
import type { BriefData } from "@plink/core/site-schema";
import { EmptyState, PageHeader, StatusBadge } from "../../_components/primitives";
import { GenerateFlow, NotConfigured } from "./_components/generate-flow";

type Params = { params: Promise<{ siteId: string }> };

export const metadata: Metadata = {
  title: "Generate · Plink",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** The same emptiness rule the API route applies, so the two states agree. */
function briefHasContent(brief: BriefData): boolean {
  return Boolean(
    brief.businessName ||
      brief.tagline ||
      brief.description ||
      brief.products.length ||
      brief.links.length,
  );
}

export default async function GeneratePage({ params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const { siteId } = await params;

  // Missing and foreign sites are indistinguishable — both 404 (Art. I).
  let site;
  try {
    ({ site } = await requireSite(siteId));
  } catch {
    notFound();
  }

  const briefRow = await prisma.brief.findUnique({
    where: { siteId: site.id },
    select: { data: true, status: true },
  });
  const brief = parseBriefJson(briefRow?.data);
  const template = resolveTemplate(site.template);
  const configured = aiEnabled();
  const ready = briefHasContent(brief);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="mb-4">
        <Link
          href="/studio"
          className="text-[13px] tracking-[-0.01em] text-ink-muted transition-colors hover:text-ink"
        >
          ← Back to studio
        </Link>
      </div>

      <PageHeader
        title={`Generate — ${site.name}`}
        description="The brief becomes a complete draft site: pages, sections, blocks and a theme. You review it before anything is saved."
        actions={<StatusBadge status={briefRow?.status ?? "draft"} />}
      />

      <div className="mt-8 flex flex-col gap-5">
        <BriefSummary brief={brief} siteId={site.id} template={template} ready={ready} />

        {!configured ? (
          <NotConfigured />
        ) : !ready ? (
          <EmptyState
            icon={FileText}
            title="No brief yet"
            body="The generator works from the client's brief — who they are, what they sell, how they want to sound. Fill it in and come back."
            action={
              <ButtonLink href={`/studio/brief/${site.id}`}>Open the brief</ButtonLink>
            }
          />
        ) : (
          <GenerateFlow siteId={site.id} siteName={site.name} template={template} enabled />
        )}
      </div>
    </main>
  );
}

/* ─────────────────────────────────────────────────────────── */

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="w-24 shrink-0 font-mono text-[12px] text-ink-muted">{label}</dt>
      <dd className="min-w-0 flex-1 text-[14px] leading-5 tracking-[-0.01em] text-ink">{value}</dd>
    </div>
  );
}

function BriefSummary({
  brief,
  siteId,
  template,
  ready,
}: {
  brief: BriefData;
  siteId: string;
  template: string;
  ready: boolean;
}) {
  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[16px] font-medium tracking-[-0.02em] text-ink">What the brief says</h2>
        <Link
          href={`/studio/brief/${siteId}`}
          className="text-[13px] tracking-[-0.01em] text-ink-muted transition-colors hover:text-ink"
        >
          Edit brief →
        </Link>
      </div>

      {ready ? (
        <dl className="mt-4 flex flex-col gap-2.5">
          <Row label="Business" value={brief.businessName || "—"} />
          {brief.tagline && <Row label="Tagline" value={brief.tagline} />}
          <Row label="Category" value={brief.category || "—"} />
          <Row label="Tone" value={brief.tone} />
          <Row label="Template" value={template} />
          <Row label="Pages" value={brief.pages.length ? brief.pages.join(", ") : "bio"} />
          <Row
            label="Content"
            value={`${brief.products.length} product${brief.products.length === 1 ? "" : "s"} · ${brief.links.length} link${brief.links.length === 1 ? "" : "s"} · ${brief.socials.length} social${brief.socials.length === 1 ? "" : "s"}`}
          />
          <div className="flex items-baseline gap-3">
            <dt className="w-24 shrink-0 font-mono text-[12px] text-ink-muted">Brand</dt>
            <dd className="flex min-w-0 flex-1 items-center gap-2">
              {/* Client brand colours are data, not design tokens. */}
              <span
                className="size-4 rounded-full border border-line"
                style={{ background: brief.brandColors.primary }}
                aria-hidden
              />
              <span
                className="size-4 rounded-full border border-line"
                style={{ background: brief.brandColors.accent }}
                aria-hidden
              />
              <span className="font-mono text-[12px] text-ink-muted">
                {brief.brandColors.primary} · {brief.brandColors.accent}
              </span>
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
          This brief is still empty.
        </p>
      )}
    </section>
  );
}
