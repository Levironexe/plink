import Link from "next/link";
import { ArrowUpRight, ClipboardList } from "lucide-react";
import { StatusBadge } from "./primitives";

export type SiteCardData = {
  id: string;
  name: string;
  slug: string;
  template: string;
  status: string;
  clientName: string;
  briefStatus: string | null;
};

/**
 * One client site. "Open" points at Feature E's editor route (`/studio/[siteId]`)
 * which may 404 until that feature merges — the link contract is fixed here.
 */
export function SiteCard({ site }: { site: SiteCardData }) {
  return (
    <div className="card flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow uppercase">{site.template}</p>
          <h3 className="mt-1 truncate text-[16px] font-medium tracking-[-0.02em] text-ink">{site.name}</h3>
        </div>
        <StatusBadge status={site.status} />
      </div>

      <dl className="space-y-1 text-[13px] leading-5 text-ink-soft">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">Client</dt>
          <dd className="truncate">{site.clientName || "—"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">Brief</dt>
          <dd>{site.briefStatus ?? "not started"}</dd>
        </div>
      </dl>

      <div className="mt-auto flex items-center gap-2 border-t border-line pt-3">
        <Link
          href={`/studio/${site.id}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[14px] font-medium tracking-[-0.02em] text-ink-soft transition-colors hover:bg-canvas-deep hover:text-ink"
        >
          Open
          <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
        <Link
          href={`/studio/brief/${site.id}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[14px] font-medium tracking-[-0.02em] text-ink-soft transition-colors hover:bg-canvas-deep hover:text-ink"
        >
          <ClipboardList className="size-3.5" aria-hidden />
          Brief
        </Link>
      </div>
    </div>
  );
}
