"use client";

import * as React from "react";
import { Monitor, Smartphone } from "lucide-react";
import type { SiteDocument } from "@plink/core/site-schema";
import { cn } from "@plink/core/utils";
import { SiteRenderer } from "@/components/site/site-renderer";

/**
 * The live preview: the real renderer, in `preview` mode, on the document
 * currently in the editor's state — not the saved one. Edits appear before
 * autosave lands, which is the whole point of the pane.
 *
 * `basePath` is deliberately omitted: preview nav is inert, and the page shown
 * follows the editor's page tabs rather than clicks inside the frame.
 *
 * Isolation runs both ways (constitution IV.3). `SiteRenderer` sets the site's
 * whole `--pl-*` palette on its own root, so nothing inside inherits an admin
 * token; `isolate` and the scroll container keep the site's stacking and
 * overflow from reaching the admin chrome around it.
 */
export function PreviewPane({ document, path }: { document: SiteDocument; path: string }) {
  const [width, setWidth] = React.useState<"desktop" | "mobile">("desktop");

  return (
    <div className="card flex min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-canvas px-3 py-2">
        <p className="eyebrow uppercase">preview · {path}</p>
        <div className="flex items-center gap-1" role="group" aria-label="Preview width">
          <WidthButton
            label="Desktop"
            icon={Monitor}
            active={width === "desktop"}
            onClick={() => setWidth("desktop")}
          />
          <WidthButton
            label="Mobile"
            icon={Smartphone}
            active={width === "mobile"}
            onClick={() => setWidth("mobile")}
          />
        </div>
      </div>

      <div className="isolate flex-1 overflow-auto bg-canvas-deep p-3">
        <div
          className={cn(
            "mx-auto overflow-hidden rounded-md border border-line bg-surface transition-[max-width] duration-200",
            width === "mobile" ? "max-w-[390px]" : "max-w-none",
          )}
        >
          <SiteRenderer document={document} mode="preview" path={path} />
        </div>
      </div>
    </div>
  );
}

function WidthButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${label} width`}
      title={`${label} width`}
      className={cn(
        "grid size-7 place-items-center rounded-md transition-colors",
        active ? "bg-ink text-white" : "text-ink-muted hover:bg-canvas-deep hover:text-ink",
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}
