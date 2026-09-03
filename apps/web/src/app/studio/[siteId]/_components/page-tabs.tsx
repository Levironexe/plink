"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import type { EffectTarget, SiteDocument, SitePage } from "@plink/core/site-schema";
import { cn } from "@plink/core/utils";
import { TextField } from "@plink/ui/field";
import {
  ChoiceDialog,
  IconButton,
  PAGE_KIND_CHOICES,
  PAGE_KIND_LABELS,
} from "./editor-chrome";
import { EffectsButton } from "./effects-button";
import { LIMITS } from "../_lib/document-ops";

/**
 * The page strip: one tab per page of the document plus the settings for
 * whichever is active (title, path, effects, delete).
 *
 * Path is edited as free text and normalised by the algebra on the way in, so
 * the field can never hold something `parseSiteDocument` would refuse — the
 * operator sees the corrected value immediately rather than a save error later.
 */
export function PageTabs({
  document,
  activePageId,
  onSelect,
  onAdd,
  onUpdate,
  onDelete,
  onEffect,
  palette,
}: {
  document: SiteDocument;
  activePageId: string;
  onSelect: (pageId: string) => void;
  onAdd: (kind: SitePage["kind"]) => void;
  onUpdate: (patch: { title?: string; path?: string }) => void;
  onDelete: () => void;
  onEffect: (target: EffectTarget, id: string | undefined) => void;
  palette?: React.CSSProperties;
}) {
  const [adding, setAdding] = React.useState(false);
  const active = document.pages.find((page) => page.id === activePageId) ?? document.pages[0];
  const full = document.pages.length >= LIMITS.pages;
  const onlyPage = document.pages.length <= 1;
  const kindLabel = PAGE_KIND_LABELS.get(active.kind) ?? active.kind;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-1 overflow-x-auto border-b border-line bg-canvas px-2 py-2 no-scrollbar">
        {document.pages.map((page) => {
          const current = page.id === active.id;
          return (
            <button
              key={page.id}
              type="button"
              aria-current={current ? "page" : undefined}
              onClick={() => onSelect(page.id)}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-2 rounded-md px-3 text-[14px] font-medium tracking-[-0.02em] transition-colors",
                current
                  ? "bg-surface text-ink shadow-[0_0_0_1px_var(--color-line)]"
                  : "text-ink-muted hover:bg-canvas-deep hover:text-ink",
              )}
            >
              {page.title || "Untitled"}
              <span className="eyebrow text-ink-muted">{page.path}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={full}
          title={full ? `A site holds at most ${LIMITS.pages} pages` : "Add page"}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[14px] font-medium tracking-[-0.02em] text-ink-muted transition-colors hover:bg-canvas-deep hover:text-ink disabled:pointer-events-none disabled:opacity-40"
        >
          <Plus className="size-4" aria-hidden />
          Page
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[10rem] flex-1">
          <TextField
            label="Page title"
            value={active.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            maxLength={120}
            placeholder="Home"
          />
        </div>
        <div className="min-w-[10rem] flex-1">
          <TextField
            label="Path"
            value={active.path}
            onChange={(e) => onUpdate({ path: e.target.value })}
            maxLength={120}
            placeholder="/shop"
            hint="Lowercase, slash-rooted. Kept unique automatically."
          />
        </div>
        <div className="flex items-center gap-2 pb-0.5">
          <EffectsButton
            level="page"
            label={`${active.title || kindLabel} page`}
            effects={active.effects}
            palette={palette}
            onChange={onEffect}
          />
          <IconButton
            label={onlyPage ? "A site needs at least one page" : `Delete the ${active.title} page`}
            onClick={onDelete}
            disabled={onlyPage}
            destructive
          >
            <Trash2 className="size-4" aria-hidden />
          </IconButton>
        </div>
      </div>

      <ChoiceDialog
        open={adding}
        onClose={() => setAdding(false)}
        title="Add a page"
        description="The path is derived from the kind and kept unique — you can rename it after."
        choices={PAGE_KIND_CHOICES}
        onPick={onAdd}
      />
    </div>
  );
}
