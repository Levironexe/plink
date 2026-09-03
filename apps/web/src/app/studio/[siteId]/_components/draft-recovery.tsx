"use client";

import { TriangleAlert } from "lucide-react";
import { PublishPanel } from "./publish-panel";
import type { VersionRow } from "../actions";

/**
 * The draft in `Site.document` no longer parses as a `SiteDocument`.
 *
 * That should not happen — every write goes through `parseSiteDocument` — but a
 * hand-edited row or a schema change could produce one, and the operator must
 * not meet a white screen. Version history stays reachable, so an earlier
 * snapshot can be rolled back into the draft and editing resumes.
 */
export function DraftRecovery({
  siteId,
  versions,
}: {
  siteId: string;
  versions: VersionRow[];
}) {
  return (
    <div className="card mt-8 p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md border border-warning-soft bg-warning-soft text-warning-deep">
          <TriangleAlert className="size-4.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-[16px] font-medium tracking-[-0.02em] text-ink">
            This draft cannot be opened
          </h2>
          <p className="mt-1.5 max-w-xl text-[14px] leading-5 tracking-[-0.02em] text-ink-soft">
            The stored document does not match the site schema, so the editor has nothing valid to
            load. Published versions are unaffected — restore one below and it becomes the draft you
            can edit again.
          </p>
          {versions.length === 0 && (
            <p className="mt-3 text-[13px] leading-5 text-ink-muted">
              There are no published versions to restore. Generating the site again from its brief
              will replace the draft.
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <PublishPanel siteId={siteId} initialVersions={versions} />
          </div>
        </div>
      </div>
    </div>
  );
}
