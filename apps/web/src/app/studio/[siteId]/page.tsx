import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ClipboardList, ExternalLink, Image as ImageIcon, Sparkles } from "lucide-react";
import { safeParseSiteDocument } from "@plink/core/site-schema";
import { getSiteForUser, listVersions } from "@/lib/site-store";
import { PageHeader, StatusBadge } from "../_components/primitives";
import { SiteEditor } from "./_components/site-editor";
import { DraftRecovery } from "./_components/draft-recovery";
import type { VersionRow } from "./actions";

type Params = { params: Promise<{ siteId: string }> };

export const metadata: Metadata = {
  title: "Site editor · Plink",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The operator's site editor. Access, the draft document and the version
 * history are resolved here; everything interactive lives in `SiteEditor`.
 *
 * The store throws for access failures and the three cases map differently:
 * an unauthenticated visitor is sent to sign in, while a missing site and
 * someone else's site are indistinguishable 404s — a foreign site must not be
 * detectable from the outside (constitution I.1).
 */
export default async function SiteEditorPage({ params }: Params) {
  const { siteId } = await params;

  const site = await getSiteForUser(siteId).catch((error: Error) => {
    if (error.message === "UNAUTHENTICATED") redirect("/login");
    if (error.message === "NOT_FOUND" || error.message === "FORBIDDEN") notFound();
    throw error;
  });

  const document = safeParseSiteDocument(readJson(site.document));
  const versions: VersionRow[] = (await listVersions(site.id)).map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          href="/studio"
          className="text-[13px] tracking-[-0.01em] text-ink-muted transition-colors hover:text-ink"
        >
          ← Back to studio
        </Link>
        <span className="eyebrow text-ink-muted">{site.workspace.name}</span>
      </div>

      <PageHeader
        title={site.name}
        description={`The working draft for ${site.clientName || "this client"}. Edits autosave; publishing snapshots them as a version.`}
        actions={<StatusBadge status={site.status} />}
      />

      <nav aria-label="Site tools" className="mt-5 flex flex-wrap items-center gap-2">
        <ShellLink href={`/studio/brief/${site.id}`} icon={ClipboardList}>
          Brief
        </ShellLink>
        {/* Owned by feat/website-generator and feat/asset-pipeline — the link
            contract is fixed here even while the routes are still landing. */}
        <ShellLink href={`/studio/${site.id}/generate`} icon={Sparkles}>
          Generate
        </ShellLink>
        <ShellLink href={`/studio/${site.id}/assets`} icon={ImageIcon}>
          Assets
        </ShellLink>
        <ShellLink href={`/s/${site.slug}`} icon={ExternalLink} external>
          View live
        </ShellLink>
      </nav>

      {document ? (
        <div className="mt-6">
          <SiteEditor
            // Publish and rollback both replace what the server holds; keying
            // on the live version remounts the editor onto that document
            // instead of leaving stale client state on screen.
            key={site.publishedVersionId ?? "draft"}
            siteId={site.id}
            initialDocument={document}
            initialVersions={versions}
          />
        </div>
      ) : (
        <DraftRecovery siteId={site.id} versions={versions} />
      )}
    </main>
  );
}

function ShellLink({
  href,
  icon: Icon,
  external,
  children,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  external?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-[14px] font-medium tracking-[-0.02em] text-ink-soft transition-colors hover:border-line-strong/50 hover:bg-canvas-deep hover:text-ink"
    >
      <Icon className="size-3.5" aria-hidden />
      {children}
    </Link>
  );
}

function readJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
